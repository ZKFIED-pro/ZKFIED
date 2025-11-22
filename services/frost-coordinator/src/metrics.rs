use lazy_static::lazy_static;
use prometheus::{
    register_counter_vec, register_gauge, register_histogram_vec,
    CounterVec, Encoder, Gauge, HistogramVec, TextEncoder,
};

lazy_static! {
    pub static ref HTTP_REQUESTS_TOTAL: CounterVec = register_counter_vec!(
        "http_requests_total",
        "Total number of HTTP requests",
        &["method", "endpoint", "status"]
    )
    .unwrap();
    pub static ref HTTP_REQUEST_DURATION_SECONDS: HistogramVec = register_histogram_vec!(
        "http_request_duration_seconds",
        "HTTP request latencies in seconds",
        &["method", "endpoint"],
        vec![0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]
    )
    .unwrap();
    pub static ref FROST_SESSIONS_ACTIVE: Gauge = register_gauge!(
        "frost_sessions_active",
        "Number of active FROST signing sessions"
    )
    .unwrap();
    pub static ref FROST_SESSIONS_TOTAL: CounterVec = register_counter_vec!(
        "frost_sessions_total",
        "Total number of FROST sessions",
        &["status"]
    )
    .unwrap();
    pub static ref FROST_ROUND_DURATION_SECONDS: HistogramVec = register_histogram_vec!(
        "frost_round_duration_seconds",
        "FROST round completion time in seconds",
        &["round"],
        vec![0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 60.0]
    )
    .unwrap();
    pub static ref EVIDENCE_SUBMISSIONS_TOTAL: CounterVec = register_counter_vec!(
        "evidence_submissions_total",
        "Total number of evidence submissions",
        &["board", "status"]
    )
    .unwrap();
    pub static ref IPFS_OPERATIONS_TOTAL: CounterVec = register_counter_vec!(
        "ipfs_operations_total",
        "Total number of IPFS operations",
        &["operation", "status"]
    )
    .unwrap();
    pub static ref IPFS_OPERATION_DURATION_SECONDS: HistogramVec = register_histogram_vec!(
        "ipfs_operation_duration_seconds",
        "IPFS operation duration in seconds",
        &["operation"],
        vec![0.1, 0.5, 1.0, 5.0, 10.0, 30.0, 60.0]
    )
    .unwrap();
    pub static ref ZCASH_RPC_CALLS_TOTAL: CounterVec = register_counter_vec!(
        "zcash_rpc_calls_total",
        "Total number of Zcash RPC calls",
        &["method", "status"]
    )
    .unwrap();
    pub static ref ZCASH_RPC_DURATION_SECONDS: HistogramVec = register_histogram_vec!(
        "zcash_rpc_duration_seconds",
        "Zcash RPC call duration in seconds",
        &["method"],
        vec![0.01, 0.05, 0.1, 0.5, 1.0, 5.0, 10.0]
    )
    .unwrap();
    pub static ref DB_QUERIES_TOTAL: CounterVec = register_counter_vec!(
        "db_queries_total",
        "Total number of database queries",
        &["query_type", "status"]
    )
    .unwrap();
    pub static ref DB_QUERY_DURATION_SECONDS: HistogramVec = register_histogram_vec!(
        "db_query_duration_seconds",
        "Database query duration in seconds",
        &["query_type"],
        vec![0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0]
    )
    .unwrap();
    pub static ref DB_CONNECTIONS_ACTIVE: Gauge = register_gauge!(
        "db_connections_active",
        "Number of active database connections"
    )
    .unwrap();
    pub static ref WALLET_BALANCE_ZATOSHI: Gauge = register_gauge!(
        "wallet_balance_zatoshi",
        "Wallet balance in zatoshi"
    )
    .unwrap();
    pub static ref CHAIN_HEIGHT: Gauge = register_gauge!(
        "chain_height",
        "Current blockchain height"
    )
    .unwrap();
    pub static ref ZSA_MINT_OPERATIONS_TOTAL: CounterVec = register_counter_vec!(
        "zsa_mint_operations_total",
        "Total number of ZSA mint operations",
        &["asset_type", "status"]
    )
    .unwrap();
    pub static ref PAYMENT_DISCLOSURE_PROOFS_GENERATED: CounterVec = register_counter_vec!(
        "payment_disclosure_proofs_generated",
        "Total number of payment disclosure proofs generated",
        &["status"]
    )
    .unwrap();
}

pub fn gather_metrics() -> String {
    let encoder = TextEncoder::new();
    let metric_families = prometheus::gather();
    let mut buffer = vec![];
    encoder.encode(&metric_families, &mut buffer).unwrap();
    String::from_utf8(buffer).unwrap()
}
