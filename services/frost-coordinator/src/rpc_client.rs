use serde::{Deserialize, Serialize};
use reqwest::{Client, header};
use base64::Engine;
use anyhow::{Result, Context};

#[derive(Debug, Clone)]
pub struct ZcashRpcClient {
    url: String,
    client: Client,
    auth_header: String,
}

#[derive(Debug, Serialize)]
struct RpcRequest {
    jsonrpc: String,
    id: String,
    method: String,
    params: serde_json::Value,
}

#[derive(Debug, Deserialize)]
struct RpcResponse<T> {
    result: Option<T>,
    error: Option<RpcError>,
    id: String,
}

#[derive(Debug, Deserialize)]
pub struct RpcError {
    pub code: i32,
    pub message: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct BlockchainInfo {
    pub chain: String,
    pub blocks: u32,
    #[serde(rename = "estimatedheight")]
    pub estimated_height: u32,
    #[serde(rename = "bestblockhash")]
    pub best_block_hash: String,
    pub consensus: ConsensusInfo,
    #[serde(default)]
    pub difficulty: Option<f64>,
    #[serde(rename = "verificationprogress", default)]
    pub verification_progress: Option<f64>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ConsensusInfo {
    #[serde(rename = "chaintip")]
    pub chain_tip: String,
    #[serde(rename = "nextblock")]
    pub next_block: String,
}

impl ZcashRpcClient {
    pub fn new(url: String, username: String, password: String) -> Result<Self> {
        let auth = format!("{}:{}", username, password);
        let auth_header = format!(
            "Basic {}",
            base64::engine::general_purpose::STANDARD.encode(auth.as_bytes())
        );

        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .context("Failed to build HTTP client")?;

        Ok(Self {
            url,
            client,
            auth_header,
        })
    }

    pub async fn call_method<T: serde::de::DeserializeOwned>(
        &self,
        method: &str,
        params: serde_json::Value,
    ) -> Result<T> {
        tracing::debug!("RPC request: {} with params: {}", method, params);

        let request = RpcRequest {
            jsonrpc: "1.0".to_string(),
            id: uuid::Uuid::new_v4().to_string(),
            method: method.to_string(),
            params,
        };

        let response = self.client
            .post(&self.url)
            .header(header::AUTHORIZATION, &self.auth_header)
            .header(header::CONTENT_TYPE, "text/plain")
            .json(&request)
            .send()
            .await
            .context(format!("Failed to send RPC request to {}", self.url))?;

        let status = response.status();
        if !status.is_success() {
            anyhow::bail!("RPC request failed with HTTP status: {}", status);
        }

        let rpc_response: RpcResponse<T> = response
            .json()
            .await
            .context("Failed to parse RPC response")?;

        if let Some(error) = rpc_response.error {
            anyhow::bail!("RPC error {}: {}", error.code, error.message);
        }

        rpc_response.result
            .context("RPC response missing result field")
    }

    pub async fn send_raw_transaction(
        &self,
        hex_string: &str,
        allow_high_fees: bool,
    ) -> Result<String> {
        let params = serde_json::json!([hex_string, allow_high_fees]);
        let txid: String = self.call_method("sendrawtransaction", params).await?;

        tracing::info!("Transaction broadcast successful: {}", txid);
        Ok(txid)
    }

    pub async fn get_blockchain_info(&self) -> Result<BlockchainInfo> {
        let info: BlockchainInfo = self.call_method("getblockchaininfo", serde_json::json!([])).await?;

        let sync_pct = info.verification_progress
            .map(|p| (p * 100.0) as u32)
            .unwrap_or(100);

        tracing::debug!(
            "Blockchain info: chain={}, blocks={}, sync={}%",
            info.chain,
            info.blocks,
            sync_pct
        );

        Ok(info)
    }

    pub async fn get_current_height(&self) -> Result<u32> {
        let info = self.get_blockchain_info().await?;
        Ok(info.blocks)
    }

    pub async fn get_consensus_branch_id(&self) -> Result<u32> {
        let info = self.get_blockchain_info().await?;

        let branch_id_hex = info.consensus.next_block.trim_start_matches("0x");
        let branch_id = u32::from_str_radix(branch_id_hex, 16)
            .context(format!("Invalid consensus branch ID: {}", branch_id_hex))?;

        Ok(branch_id)
    }

    pub async fn is_synced(&self) -> Result<bool> {
        let info = self.get_blockchain_info().await?;
        Ok(info.verification_progress.map(|p| p > 0.9999).unwrap_or(true))
    }

    pub async fn get_block_hash(&self, height: u32) -> Result<String> {
        let hash: String = self.call_method("getblockhash", serde_json::json!([height])).await?;
        Ok(hash)
    }

    pub async fn get_raw_transaction(&self, txid: &str, verbose: bool) -> Result<serde_json::Value> {
        let params = if verbose {
            serde_json::json!([txid, 1])
        } else {
            serde_json::json!([txid, 0])
        };

        self.call_method("getrawtransaction", params).await
    }

    pub async fn get_confirmations(&self, txid: &str) -> Result<u32> {
        let tx: serde_json::Value = self.get_raw_transaction(txid, true).await?;
        let confirmations = tx.get("confirmations")
            .and_then(|c| c.as_u64())
            .unwrap_or(0) as u32;

        Ok(confirmations)
    }

    pub async fn get_sapling_anchor(&self) -> Result<String> {
        // Get current blockchain height first
        let info = self.get_blockchain_info().await?;
        let height = info.blocks.to_string();

        // Get the latest block's Sapling tree state using the actual block height
        let tree_state: serde_json::Value = self.call_method("z_gettreestate", serde_json::json!([height])).await?;

        // Zebra uses "finalState" instead of "finalRoot"
        let sapling_anchor = tree_state
            .get("sapling")
            .and_then(|s| s.get("commitments"))
            .and_then(|c| c.get("finalState").or_else(|| c.get("finalRoot")))
            .and_then(|r| r.as_str())
            .context("Failed to extract Sapling anchor from tree state")?;

        tracing::debug!("Retrieved Sapling anchor from block {}: {}", height, sapling_anchor);
        Ok(sapling_anchor.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_client_creation() {
        let client = ZcashRpcClient::new(
            "http://localhost:8232".to_string(),
            "user".to_string(),
            "pass".to_string(),
        );

        assert!(client.is_ok());
    }

    #[test]
    fn test_auth_header_format() {
        let client = ZcashRpcClient::new(
            "http://localhost:8232".to_string(),
            "testuser".to_string(),
            "testpass".to_string(),
        ).unwrap();

        assert!(client.auth_header.starts_with("Basic "));
    }

    #[tokio::test]
    #[ignore]
    async fn test_get_blockchain_info() {
        let client = ZcashRpcClient::new(
            "http://localhost:8232".to_string(),
            "user".to_string(),
            "pass".to_string(),
        ).unwrap();

        let result = client.get_blockchain_info().await;
        if result.is_ok() {
            let info = result.unwrap();
            assert!(info.blocks > 0);
        }
    }

    #[tokio::test]
    #[ignore]
    async fn test_send_invalid_transaction() {
        let client = ZcashRpcClient::new(
            "http://localhost:8232".to_string(),
            "user".to_string(),
            "pass".to_string(),
        ).unwrap();

        let result = client.send_raw_transaction("deadbeef", false).await;
        assert!(result.is_err());
    }
}
