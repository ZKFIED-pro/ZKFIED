use blake2::{Blake2b512, Digest};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum TimeLockError {
    #[error("Time-lock expired")]
    Expired,

    #[error("Invalid expiry format")]
    InvalidFormat,

    #[error("Expiry in the past")]
    PastExpiry,
}

pub fn unix_timestamp_now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs()
}

pub fn validate_expiry(expiry_timestamp: u64) -> Result<(), TimeLockError> {
    let now = unix_timestamp_now();

    if expiry_timestamp < now {
        return Err(TimeLockError::Expired);
    }

    Ok(())
}

pub fn create_time_locked_message(message: &[u8], expiry_timestamp: u64) -> Vec<u8> {
    let mut hasher = Blake2b512::new();
    hasher.update(b"zkfied:timelock:v1");
    hasher.update(message);
    hasher.update(&expiry_timestamp.to_le_bytes());
    hasher.finalize().to_vec()
}

pub fn verify_time_lock(message: &[u8], expiry_timestamp: u64) -> Result<Vec<u8>, TimeLockError> {
    validate_expiry(expiry_timestamp)?;
    Ok(create_time_locked_message(message, expiry_timestamp))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_future_expiry_valid() {
        let future = unix_timestamp_now() + 86400;
        assert!(validate_expiry(future).is_ok());
    }

    #[test]
    fn test_past_expiry_invalid() {
        let past = unix_timestamp_now() - 86400;
        assert!(validate_expiry(past).is_err());
    }

    #[test]
    fn test_time_locked_message_deterministic() {
        let msg = b"secret evidence";
        let expiry = unix_timestamp_now() + 1000;

        let locked1 = create_time_locked_message(msg, expiry);
        let locked2 = create_time_locked_message(msg, expiry);

        assert_eq!(locked1, locked2);
    }

    #[test]
    fn test_different_expiry_different_hash() {
        let msg = b"evidence";
        let expiry1 = unix_timestamp_now() + 1000;
        let expiry2 = unix_timestamp_now() + 2000;

        let locked1 = create_time_locked_message(msg, expiry1);
        let locked2 = create_time_locked_message(msg, expiry2);

        assert_ne!(locked1, locked2);
    }
}
