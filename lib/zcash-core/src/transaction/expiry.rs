use crate::error::Result;

pub struct ExpiryHeight(pub u32);

impl ExpiryHeight {
    pub fn new(height: u32) -> Self {
        ExpiryHeight(height)
    }
}
