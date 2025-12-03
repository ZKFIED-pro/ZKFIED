use axum::{
    debug_handler,
    extract::{Json, Path, State},
    response::{IntoResponse, Response},
    routing::{get, post},
    Router,
};
use serde_json::json;
use std::sync::Arc;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use zkfied_frost_coordinator::{
    api_routes::{self, AppState},
    db::Database,
    ipfs_client::IpfsClient,
    lightclient::LightClient,
    metrics,
    mina_verifier::{MinaProofVerifier, MinaCredentialProof},
    near_client::{NearTransactionManager, NearNetwork},
    params_downloader::ParamsDownloader,
    rpc_client::ZcashRpcClient,
    orchestrator::{
        EvidenceOrchestrator,
        EvidenceSubmissionRequest,
    },
    types::ApiError,
};
use zcash_primitives::consensus::Network;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "zkfied_frost_coordinator=info,tower_http=debug,axum=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Starting ZKFIED FROST Coordinator");

    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite://zkfied.db".to_string());

    let ipfs_url = std::env::var("IPFS_URL")
        .unwrap_or_else(|_| "http://127.0.0.1:5001".to_string());

    let lightwalletd_url = std::env::var("LIGHTWALLETD_URL")
        .unwrap_or_else(|_| "https://testnet.zec.rocks:443".to_string());

    let zcash_rpc_url = std::env::var("ZCASH_RPC_URL")
        .unwrap_or_else(|_| "http://127.0.0.1:8232".to_string());

    let zcash_rpc_user = std::env::var("ZCASH_RPC_USER")
        .unwrap_or_else(|_| "user".to_string());

    let zcash_rpc_pass = std::env::var("ZCASH_RPC_PASS")
        .unwrap_or_else(|_| "pass".to_string());

    tracing::info!("Connecting to database: {}", database_url);
    let db = Arc::new(Database::new(&database_url).await?);

    tracing::info!("Running database migrations");
    db.migrate().await?;

    tracing::info!("Connecting to IPFS: {}", ipfs_url);
    let ipfs = if ipfs_url == "http://127.0.0.1:5001" {
        Arc::new(IpfsClient::new()?)
    } else {
        Arc::new(IpfsClient::with_uri(&ipfs_url)?)
    };

    match ipfs.version().await {
        Ok(version) => tracing::info!("IPFS connected: {}", version),
        Err(e) => tracing::warn!("IPFS connection failed: {} (continuing anyway)", e),
    }

    tracing::info!("Connecting to Lightwalletd: {}", lightwalletd_url);
    let lightclient_result = LightClient::new(lightwalletd_url.clone()).await;
    match &lightclient_result {
        Ok(_) => {
            tracing::info!("Lightwalletd connected: {}", lightwalletd_url);
            // Test fetching latest block
            if let Ok(mut client) = lightclient_result {
                match client.get_latest_block().await {
                    Ok(height) => tracing::info!("Lightwalletd latest block: {}", u32::from(height)),
                    Err(e) => tracing::warn!("Failed to get latest block: {}", e),
                }
            }
        }
        Err(e) => tracing::warn!("Lightwalletd connection failed: {} (continuing anyway)", e),
    }

    tracing::info!("Connecting to Zcash RPC: {}", zcash_rpc_url);
    let rpc = Arc::new(ZcashRpcClient::new(
        zcash_rpc_url,
        zcash_rpc_user,
        zcash_rpc_pass,
    )?);

    match rpc.get_blockchain_info().await {
        Ok(info) => tracing::info!(
            "Zcash connected: {} (block {})",
            info.chain,
            info.blocks
        ),
        Err(e) => tracing::warn!("Zcash connection failed: {} (continuing anyway)", e),
    }

    let params_dir = std::env::var("ZCASH_PARAMS_DIR")
        .map(|p| std::path::PathBuf::from(p))
        .unwrap_or_else(|_| {
            let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
            std::path::PathBuf::from(home).join(".zcash-params")
        });

    tracing::info!("Using Zcash params directory: {}", params_dir.display());

    // Ensure Sapling parameters are downloaded before starting
    tracing::info!("Ensuring Zcash Sapling parameters are present...");
    let downloader = ParamsDownloader::new(params_dir.clone());
    downloader.ensure_params().await?;
    tracing::info!("Sapling parameters verified and ready");

    let near_contract_id = std::env::var("NEAR_CONTRACT_ID")
        .unwrap_or_else(|_| "zkfied-evidence.reg.mrhashfox.testnet".to_string())
        .parse()
        .expect("Invalid NEAR contract ID");

    let near_network = match std::env::var("NEAR_NETWORK").as_deref() {
        Ok("mainnet") => NearNetwork::Mainnet,
        Ok("testnet") | _ => NearNetwork::Testnet,
    };

    let near_manager = Arc::new(NearTransactionManager::new(
        near_contract_id,
        near_network,
        db.clone(),
    ));

    tracing::info!("NEAR transaction manager initialized");

    // Initialize NEAR account if credentials are provided
    if let (Ok(account_id_str), Ok(private_key_str)) = (
        std::env::var("NEAR_ACCOUNT_ID"),
        std::env::var("NEAR_PRIVATE_KEY"),
    ) {
        use zkfied_frost_coordinator::near_client::NearAccount;
        match (account_id_str.parse(), private_key_str.parse()) {
            (Ok(account_id), Ok(secret_key)) => {
                let near_account = NearAccount::from_secret_key(account_id, secret_key);
                let public_key = near_account.public_key();
                tracing::info!("NEAR account: {}, derived public key: {}", account_id_str, public_key);
                if let Err(e) = near_manager.initialize_account(near_account).await {
                    tracing::error!("Failed to initialize NEAR account: {}", e);
                } else {
                    tracing::info!("NEAR account initialized successfully");
                }
            }
            (Err(e), _) => tracing::error!("Invalid NEAR account ID: {}", e),
            (_, Err(e)) => tracing::error!("Invalid NEAR private key: {}", e),
        }
    } else {
        tracing::warn!("NEAR_ACCOUNT_ID or NEAR_PRIVATE_KEY not set - NEAR functionality disabled");
    }

    let mina_graphql_endpoint = std::env::var("MINA_GRAPHQL_ENDPOINT")
        .unwrap_or_else(|_| "https://api.minascan.io/node/devnet/v1/graphql".to_string());

    let mina_zkapp_address = std::env::var("MINA_ZKAPP_ADDRESS")
        .unwrap_or_else(|_| "B62qjLQo287BXoYZBweHfRN5bikWUFdc81rqECVEiRCBEoYBEGCbNc3".to_string());

    let mina_verifier = Arc::new(MinaProofVerifier::new(
        mina_graphql_endpoint.clone(),
        mina_zkapp_address.clone(),
        db.clone(),
    ));

    tracing::info!("Mina proof verifier initialized: {}", mina_zkapp_address);

    let lightclient_for_orchestrator = LightClient::new(lightwalletd_url.clone()).await.ok();
    if lightclient_for_orchestrator.is_some() {
        tracing::info!("LightClient connected for orchestrator");
    } else {
        tracing::warn!("LightClient connection failed for orchestrator, will rely on RPC only");
    }

    tracing::info!("Initializing Evidence Orchestrator with REAL ZK proof generation");
    let orchestrator = Arc::new(EvidenceOrchestrator::new(
        db.clone(),
        ipfs.clone(),
        rpc.clone(),
        lightclient_for_orchestrator,
        near_manager.clone(),
        mina_verifier.clone(),
        params_dir,
    )?);

    let network = match std::env::var("ZCASH_NETWORK").as_deref() {
        Ok("mainnet") => Network::MainNetwork,
        Ok("testnet") | _ => Network::TestNetwork,
    };
    tracing::info!("Using Zcash network: {:?}", network);

    let resend_api_key = std::env::var("RESEND_API_KEY")
        .unwrap_or_else(|_| "re_PyJTCJRZ_KurHiSo5MjzcqYVV4ycZRbLR".to_string());

    let otp_manager = Arc::new(zkfied_frost_coordinator::otp::OtpManager::new(
        db.clone(),
        resend_api_key,
    ));

    tracing::info!("OTP manager initialized");

    let api_state = Arc::new(AppState {
        db: db.clone(),
        network,
        otp_manager,
        mina_verifier: mina_verifier.clone(),
        ipfs: ipfs.clone(),
    });

    let frost_router = Router::new()
        .route("/health", get(health))
        .route("/evidence/submit", post(submit_evidence))
        .route("/evidence/:id", get(get_evidence))
        .route("/evidence/:id/link-tx", post(link_zcash_tx))
        .route("/evidence/board/:category", get(list_evidence_by_board))
        .route("/frost/session/:id", get(get_frost_session))
        .route("/stats", get(get_stats))
        .route("/metrics", get(metrics_handler))
        .route("/ipfs/evidence/:cid", get(get_ipfs_evidence))
        .route("/ipfs/file/:cid", get(get_ipfs_file))
        .route("/zcash/transaction/:txid", get(get_zcash_transaction))
        .route("/wallet/info/:address", get(get_wallet_info))
        .route("/mina/verify-credential", post(verify_mina_credential))
        .route("/mina/credential/:hash", get(get_mina_credential))
        .with_state(orchestrator);

    let hybrid_router = Router::new()
        .route("/api/auth/request-otp", post(api_routes::request_otp))
        .route("/api/auth/verify-otp", post(api_routes::verify_otp))
        .route("/api/auth/session", post(api_routes::get_session))
        .route("/api/evidence/submit", post(api_routes::submit_evidence))
        .route("/api/evidence/my-evidence", post(api_routes::get_my_evidence))
        .route("/api/wallet/address", get(api_routes::get_wallet_address))
        .route("/api/stats", get(api_routes::get_stats))
        .with_state(api_state);

    let app = frost_router
        .merge(hybrid_router)
        .layer(tower_http::cors::CorsLayer::permissive())
        .layer(tower_http::trace::TraceLayer::new_for_http());

    let port = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(3000);

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port))
        .await?;

    tracing::info!("ZKFIED FROST Coordinator listening on http://0.0.0.0:{}", port);
    tracing::info!("API Endpoints:");
    tracing::info!("");
    tracing::info!("   === FROST Threshold Signature Endpoints ===");
    tracing::info!("   POST   /evidence/submit          - Submit new evidence (full FROST workflow)");
    tracing::info!("   GET    /evidence/:id             - Get evidence status");
    tracing::info!("   GET    /evidence/board/:category - List evidence by board");
    tracing::info!("   GET    /frost/session/:id        - Get FROST session info");
    tracing::info!("   GET    /stats                    - Get database statistics");
    tracing::info!("   GET    /health                   - Health check");
    tracing::info!("");
    tracing::info!("   === IPFS Data Retrieval ===");
    tracing::info!("   GET    /ipfs/evidence/:cid       - Retrieve evidence metadata from IPFS");
    tracing::info!("   GET    /ipfs/file/:cid           - Retrieve file data from IPFS");
    tracing::info!("");
    tracing::info!("   === Zcash Blockchain Queries ===");
    tracing::info!("   GET    /zcash/transaction/:txid  - Get transaction details");
    tracing::info!("   GET    /wallet/info/:address     - Get wallet information");
    tracing::info!("");
    tracing::info!("   === Hybrid Mode (Zashi Wallet + ZK Proofs) ===");
    tracing::info!("   POST   /api/evidence/submit      - Submit evidence, get ZK proof + instructions");
    tracing::info!("   GET    /api/wallet/address       - Get wallet address for funding");
    tracing::info!("   GET    /api/stats                - Get hybrid mode status");
    tracing::info!("");
    tracing::info!("Hybrid Mode: Use Zashi wallet for transactions, ZKFIED for zero-knowledge proofs");

    axum::serve(listener, app).await?;

    Ok(())
}


async fn health() -> &'static str {
    "OK"
}

#[debug_handler]
async fn submit_evidence(
    State(orchestrator): State<Arc<EvidenceOrchestrator>>,
    Json(request): Json<EvidenceSubmissionRequest>,
) -> Response {
    tracing::info!("Received evidence submission: {}", request.title);

    match orchestrator.submit_evidence(request).await {
        Ok(response) => {
            tracing::info!("Evidence submission completed: {}", response.evidence_id);
            Json(response).into_response()
        }
        Err(e) => ApiError::Internal(e.to_string()).into_response(),
    }
}

async fn get_evidence(
    State(orchestrator): State<Arc<EvidenceOrchestrator>>,
    Path(evidence_id): Path<String>,
) -> Response {
    tracing::debug!("Fetching evidence: {}", evidence_id);

    match orchestrator.get_evidence_status(&evidence_id).await {
        Ok(response) => Json(response).into_response(),
        Err(e) => {
            if e.to_string().contains("not found") {
                ApiError::NotFound(format!("Evidence not found: {}", evidence_id)).into_response()
            } else {
                ApiError::Internal(e.to_string()).into_response()
            }
        }
    }
}

async fn list_evidence_by_board(
    State(orchestrator): State<Arc<EvidenceOrchestrator>>,
    Path(category): Path<String>,
) -> Response {
    tracing::debug!("Listing evidence for board: {}", category);

    match orchestrator.list_evidence_by_board(&category).await {
        Ok(evidence_list) => Json(evidence_list).into_response(),
        Err(e) => ApiError::Internal(e.to_string()).into_response(),
    }
}

async fn get_frost_session(
    State(orchestrator): State<Arc<EvidenceOrchestrator>>,
    Path(session_id): Path<String>,
) -> Response {
    tracing::debug!("Fetching FROST session: {}", session_id);

    match orchestrator.get_frost_session_info(&session_id).await {
        Ok(session_info) => Json(session_info).into_response(),
        Err(e) => {
            if e.to_string().contains("not found") {
                ApiError::NotFound(format!("FROST session not found: {}", session_id)).into_response()
            } else {
                ApiError::Internal(e.to_string()).into_response()
            }
        }
    }
}

async fn get_stats(
    State(_orchestrator): State<Arc<EvidenceOrchestrator>>,
) -> Response {
    Json(json!({
        "status": "operational",
        "message": "Database stats coming soon"
    })).into_response()
}

async fn metrics_handler() -> Response {
    metrics::gather_metrics().into_response()
}

async fn get_ipfs_evidence(
    State(orchestrator): State<Arc<EvidenceOrchestrator>>,
    Path(cid): Path<String>,
) -> Response {
    tracing::debug!("Fetching IPFS evidence: {}", cid);

    match orchestrator.get_ipfs_evidence(&cid).await {
        Ok(evidence) => Json(evidence).into_response(),
        Err(e) => {
            tracing::error!("Failed to fetch evidence from IPFS: {}", e);
            ApiError::NotFound(format!("Evidence not found: {}", cid)).into_response()
        }
    }
}

async fn get_ipfs_file(
    State(orchestrator): State<Arc<EvidenceOrchestrator>>,
    Path(cid): Path<String>,
) -> Response {
    tracing::debug!("Fetching IPFS file: {}", cid);

    match orchestrator.get_ipfs_file(&cid).await {
        Ok(data) => {
            use axum::http::header;
            (
                [(header::CONTENT_TYPE, "application/octet-stream")],
                data
            ).into_response()
        }
        Err(e) => {
            tracing::error!("Failed to fetch file from IPFS: {}", e);
            ApiError::NotFound(format!("File not found: {}", cid)).into_response()
        }
    }
}

async fn get_zcash_transaction(
    State(orchestrator): State<Arc<EvidenceOrchestrator>>,
    Path(txid): Path<String>,
) -> Response {
    tracing::debug!("Fetching Zcash transaction: {}", txid);

    match orchestrator.get_transaction(&txid).await {
        Ok(tx_info) => Json(tx_info).into_response(),
        Err(e) => {
            tracing::error!("Failed to fetch transaction: {}", e);
            ApiError::NotFound(format!("Transaction not found: {}", txid)).into_response()
        }
    }
}

async fn get_wallet_info(
    State(orchestrator): State<Arc<EvidenceOrchestrator>>,
    Path(address): Path<String>,
) -> Response {
    tracing::debug!("Getting wallet info for: {}", address);

    match orchestrator.get_wallet_info(&address).await {
        Ok(info) => Json(info).into_response(),
        Err(e) => {
            tracing::error!("Failed to get wallet info: {}", e);
            ApiError::Internal(format!("Failed to get wallet info: {}", e)).into_response()
        }
    }
}

#[debug_handler]
async fn verify_mina_credential(
    State(orchestrator): State<Arc<EvidenceOrchestrator>>,
    Json(proof): Json<MinaCredentialProof>,
) -> Response {
    tracing::info!("Verifying Mina credential proof: holder={}", proof.holder_public_key);

    match orchestrator.verify_mina_credential(proof).await {
        Ok(verification) => {
            tracing::info!("Mina credential verified: {}", verification.credential_hash);
            Json(verification).into_response()
        }
        Err(e) => {
            tracing::error!("Failed to verify Mina credential: {}", e);
            ApiError::Internal(format!("Credential verification failed: {}", e)).into_response()
        }
    }
}

async fn get_mina_credential(
    State(orchestrator): State<Arc<EvidenceOrchestrator>>,
    Path(credential_hash): Path<String>,
) -> Response {
    tracing::debug!("Fetching Mina credential: {}", credential_hash);

    match orchestrator.get_mina_credential(&credential_hash).await {
        Ok(Some(verification)) => Json(verification).into_response(),
        Ok(None) => ApiError::NotFound(format!("Credential not found: {}", credential_hash)).into_response(),
        Err(e) => {
            tracing::error!("Failed to fetch Mina credential: {}", e);
            ApiError::Internal(format!("Failed to fetch credential: {}", e)).into_response()
        }
    }
}

#[derive(Debug, serde::Deserialize)]
struct LinkZcashTxRequest {
    zcash_txid: String,
}

#[debug_handler]
async fn link_zcash_tx(
    State(orchestrator): State<Arc<EvidenceOrchestrator>>,
    Path(evidence_id): Path<String>,
    Json(request): Json<LinkZcashTxRequest>,
) -> Response {
    tracing::info!("Linking Zcash txid {} to evidence {}", request.zcash_txid, evidence_id);

    match orchestrator.link_zcash_transaction_and_complete(&evidence_id, &request.zcash_txid).await {
        Ok(response) => {
            tracing::info!("Evidence flow completed: {}", evidence_id);
            Json(response).into_response()
        }
        Err(e) => {
            tracing::error!("Failed to link transaction: {}", e);
            ApiError::Internal(format!("Failed to complete flow: {}", e)).into_response()
        }
    }
}
