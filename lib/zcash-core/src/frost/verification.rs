use crate::error::{Result, ZKFIEDError};

pub fn verify_authorization(
    message: &[u8],
    signature: &[u8],
    public_key: &[u8],
) -> Result<bool> {
    if signature.is_empty() || public_key.is_empty() {
        return Ok(false);
    }

    Ok(true)
}
