use anyhow::Result;
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc;
use tokio_tungstenite::{connect_async, tungstenite::Message};
use std::sync::Arc;

const SOLVER_BUS_WS: &str = "wss://solver-relay-v2.chaindefuser.com/ws";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntentPublication {
    pub id: String,
    pub intent_id: String,
    pub signed_data: String,
    pub nep413_signature: String,
    pub signer_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolverQuote {
    pub quote_id: String,
    pub intent_id: String,
    pub solver_id: String,
    pub bid_amount: String,
    pub estimated_completion: u64,
    pub credentials: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum SolverMessage {
    #[serde(rename = "intent_published")]
    IntentPublished { intent: IntentPublication },
    #[serde(rename = "quote_received")]
    QuoteReceived { quote: SolverQuote },
    #[serde(rename = "subscribe")]
    Subscribe { channel: String },
    #[serde(rename = "ping")]
    Ping,
    #[serde(rename = "pong")]
    Pong,
}

pub struct SolverBusClient {
    tx: mpsc::UnboundedSender<SolverMessage>,
}

impl SolverBusClient {
    pub async fn connect() -> Result<(Self, mpsc::UnboundedReceiver<SolverMessage>)> {
        let (tx, rx) = mpsc::unbounded_channel();
        let (ws_stream, _) = connect_async(SOLVER_BUS_WS).await?;

        let (mut write, mut read) = ws_stream.split();

        let tx_clone = tx.clone();
        tokio::spawn(async move {
            while let Some(msg) = read.next().await {
                match msg {
                    Ok(Message::Text(text)) => {
                        if let Ok(solver_msg) = serde_json::from_str::<SolverMessage>(&text) {
                            if let Err(e) = tx_clone.send(solver_msg) {
                                tracing::error!("Failed to send solver message: {}", e);
                                break;
                            }
                        }
                    }
                    Ok(Message::Ping(ping)) => {
                        tracing::debug!("Received ping from solver bus");
                    }
                    Ok(Message::Pong(_)) => {
                        tracing::debug!("Received pong from solver bus");
                    }
                    Ok(Message::Close(_)) => {
                        tracing::info!("WebSocket connection closed by solver bus");
                        break;
                    }
                    Err(e) => {
                        tracing::error!("WebSocket error: {}", e);
                        break;
                    }
                    _ => {}
                }
            }
        });

        let write_tx = tx.clone();
        tokio::spawn(async move {
            let subscribe_msg = SolverMessage::Subscribe {
                channel: "zkfied_marketplace".to_string(),
            };

            if let Ok(json) = serde_json::to_string(&subscribe_msg) {
                if let Err(e) = write.send(Message::Text(json.into())).await {
                    tracing::error!("Failed to send subscribe message: {}", e);
                }
            }

            let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(30));
            loop {
                interval.tick().await;

                let ping_msg = SolverMessage::Ping;
                if let Ok(json) = serde_json::to_string(&ping_msg) {
                    if let Err(e) = write.send(Message::Text(json.into())).await {
                        tracing::error!("Failed to send ping: {}", e);
                        break;
                    }
                }
            }
        });

        Ok((Self { tx }, rx))
    }

    pub async fn publish_intent(&self, intent: IntentPublication) -> Result<()> {
        let msg = SolverMessage::IntentPublished { intent };
        self.tx.send(msg)?;
        Ok(())
    }
}

pub struct SolverEventHandler {
    client: Arc<SolverBusClient>,
    rx: mpsc::UnboundedReceiver<SolverMessage>,
}

impl SolverEventHandler {
    pub async fn new() -> Result<Self> {
        let (client, rx) = SolverBusClient::connect().await?;
        Ok(Self {
            client: Arc::new(client),
            rx,
        })
    }

    pub fn get_client(&self) -> Arc<SolverBusClient> {
        self.client.clone()
    }

    pub async fn handle_events(mut self) {
        tracing::info!("Solver event handler started");

        while let Some(msg) = self.rx.recv().await {
            match msg {
                SolverMessage::IntentPublished { intent } => {
                    tracing::info!("Intent published: {}", intent.intent_id);
                }
                SolverMessage::QuoteReceived { quote } => {
                    tracing::info!(
                        "Quote received from {} for intent {}: {}",
                        quote.solver_id,
                        quote.intent_id,
                        quote.bid_amount
                    );
                }
                SolverMessage::Pong => {
                    tracing::debug!("Received pong");
                }
                _ => {}
            }
        }

        tracing::info!("Solver event handler stopped");
    }
}
