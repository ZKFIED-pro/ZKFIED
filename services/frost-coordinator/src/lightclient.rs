use anyhow::{Context, Result};
use tonic::transport::Channel;
use zcash_primitives::consensus::BlockHeight;

// Use the proto definitions from zcash_client_backend
use zcash_client_backend::proto::service::{
    compact_tx_streamer_client::CompactTxStreamerClient,
    BlockId, BlockRange, ChainSpec, Empty, RawTransaction, TxFilter,
};

pub struct LightClient {
    client: CompactTxStreamerClient<Channel>,
}

impl LightClient {
    pub async fn new(server_uri: String) -> Result<Self> {
        let channel = Channel::from_shared(server_uri)
            .context("Invalid server URI")?
            .connect()
            .await
            .context("Failed to connect to lightwalletd")?;

        let client = CompactTxStreamerClient::new(channel);

        Ok(Self { client })
    }

    pub async fn get_latest_block(&mut self) -> Result<BlockHeight> {
        use tokio::time::{timeout, Duration};

        let response = timeout(
            Duration::from_secs(10),
            self.client.get_latest_block(ChainSpec { /* empty */ })
        )
        .await
        .context("get_latest_block timed out after 10 seconds")?
        .context("Failed to get latest block")?;

        let block_id = response.into_inner();
        Ok(BlockHeight::from_u32(block_id.height as u32))
    }

    pub async fn send_transaction(&mut self, tx_bytes: Vec<u8>) -> Result<String> {
        let request = RawTransaction {
            data: tx_bytes,
            height: 0,
        };

        let response = self.client
            .send_transaction(request)
            .await
            .context("Failed to send transaction")?;

        let send_response = response.into_inner();

        if send_response.error_code == 0 {
            let mut txid = send_response.error_message;
            if txid.starts_with('"') && txid.ends_with('"') {
                txid = txid[1..txid.len() - 1].to_string();
            }
            Ok(txid)
        } else {
            Err(anyhow::anyhow!("Send error: {:?}", send_response))
        }
    }

    pub async fn get_tree_state(&mut self, height: BlockHeight) -> Result<String> {
        let block_id = BlockId {
            height: u64::from(height),
            hash: vec![],
        };

        let response = self.client
            .get_tree_state(block_id)
            .await
            .context("Failed to get tree state")?;

        let tree_state = response.into_inner();
        Ok(tree_state.sapling_tree)
    }

    pub async fn get_block_range(
        &mut self,
        start_height: BlockHeight,
        end_height: BlockHeight,
    ) -> Result<Vec<zcash_client_backend::proto::compact_formats::CompactBlock>> {
        use tokio_stream::StreamExt;

        let range = BlockRange {
            start: Some(BlockId {
                height: u64::from(start_height),
                hash: vec![],
            }),
            end: Some(BlockId {
                height: u64::from(end_height),
                hash: vec![],
            }),
        };

        let mut stream = self.client
            .get_block_range(range)
            .await
            .context("Failed to get block range")?
            .into_inner();

        let mut blocks = Vec::new();
        while let Some(block) = stream.next().await {
            blocks.push(block.context("Stream error")?);
        }

        Ok(blocks)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_lightclient_connection() {
        // Using testnet.zec.rocks for standard Zcash testnet
        let result = LightClient::new("https://testnet.zec.rocks:443".to_string()).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_get_latest_block() {
        // Using testnet.zec.rocks for standard Zcash testnet
        let mut client = LightClient::new("https://testnet.zec.rocks:443".to_string())
            .await
            .unwrap();

        let height = client.get_latest_block().await.unwrap();
        // Testnet block height should be > 2,000,000 (mainnet had higher, testnet is lower)
        assert!(u32::from(height) > 500_000);
    }

    #[tokio::test]
    async fn test_zaino_endpoint() {
        // Test the Zaino testnet endpoint from zec.rocks
        let mut client = LightClient::new("https://zaino.testnet.unsafe.zec.rocks:443".to_string())
            .await
            .unwrap();

        let height = client.get_latest_block().await.unwrap();
        println!("✓ Zaino testnet height: {}", u32::from(height));
        // Testnet block height should be reasonable
        assert!(u32::from(height) > 500_000);
    }
}
