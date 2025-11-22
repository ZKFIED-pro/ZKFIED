use orchard::keys::FullViewingKey;
use crate::error::Result;

pub struct ViewingKeyManager;

impl ViewingKeyManager {
    pub fn from_fvk(fvk: FullViewingKey) -> Self {
        ViewingKeyManager
    }
}
