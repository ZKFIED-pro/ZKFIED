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

    tracing::info!("Initializing Evidence Orchestrator with REAL ZK proof generation");
    let orchestrator = Arc::new(EvidenceOrchestrator::new(
        db.clone(),
        ipfs.clone(),
        rpc.clone(),
        params_dir,
    )?);

    let network = match std::env::var("ZCASH_NETWORK").as_deref() {
        Ok("mainnet") => Network::MainNetwork,
        Ok("testnet") | _ => Network::TestNetwork,
    };
    tracing::info!("Using Zcash network: {:?}", network);

    let api_state = Arc::new(AppState {
        db: db.clone(),
        network,
    });

    let frost_router = Router::new()
        .route("/health", get(health))
        .route("/evidence/submit", post(submit_evidence))
        .route("/evidence/:id", get(get_evidence))
        .route("/evidence/board/:category", get(list_evidence_by_board))
        .route("/frost/session/:id", get(get_frost_session))
        .route("/stats", get(get_stats))
        .route("/metrics", get(metrics_handler))
        .with_state(orchestrator);

    let hybrid_router = Router::new()
        .route("/api/evidence/submit", post(api_routes::submit_evidence))
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
