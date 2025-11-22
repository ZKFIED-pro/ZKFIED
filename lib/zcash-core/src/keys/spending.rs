use orchard::keys::SpendingKey;
use crate::error::Result;

pub struct SpendingKeyManager;

impl SpendingKeyManager {
    pub fn from_sk(sk: SpendingKey) -> Self {
        SpendingKeyManager
    }
}
