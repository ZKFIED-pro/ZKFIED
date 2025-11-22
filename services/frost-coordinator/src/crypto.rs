
use blake2::{Blake2b512, Digest};

use crate::types::{BoardCategory, BoardMember};
use crate::ApiError;

pub fn generate_board_id(
    category: &BoardCategory,
    members: &[BoardMember],
) -> Result<String, ApiError> {
    let mut hasher = Blake2b512::new();

    let category_byte = match category {
        BoardCategory::Government => 0x01u8,
        BoardCategory::Healthcare => 0x02,
        BoardCategory::Corporate => 0x03,
        BoardCategory::Media => 0x04,
        BoardCategory::Environment => 0x05,
        BoardCategory::Legal => 0x06,
        BoardCategory::Education => 0x07,
        BoardCategory::CivilSociety => 0x08,
    };
    hasher.update(&[category_byte]);

    let mut member_data: Vec<_> = members
        .iter()
        .map(|m| {
            let mut data = Vec::new();
            data.extend_from_slice(m.id.as_bytes());
            data.extend_from_slice(&m.public_key);
            data
        })
        .collect();
    member_data.sort();

    for data in member_data {
        hasher.update(&data);
    }

    let result = hasher.finalize();
    Ok(hex::encode(&result[..32]))
}

pub fn generate_request_id(board_id: &str, message: &[u8]) -> Result<String, ApiError> {
    let mut hasher = Blake2b512::new();
    hasher.update(board_id.as_bytes());
    hasher.update(message);

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| ApiError::Internal(format!("Time error: {}", e)))?
        .as_secs();
    hasher.update(&timestamp.to_le_bytes());

    let result = hasher.finalize();
    Ok(hex::encode(&result[..32]))
}

pub fn hash_message(message: &[u8]) -> [u8; 64] {
    let mut hasher = Blake2b512::new();
    hasher.update(message);
    let result = hasher.finalize();
    let mut output = [0u8; 64];
    output.copy_from_slice(&result);
    output
}

pub fn validate_participant_id(id: u16, max_participants: u16) -> Result<(), ApiError> {
    if id == 0 {
        return Err(ApiError::InvalidInput(
            "Participant ID must be > 0".to_string(),
        ));
    }

    if id > max_participants {
        return Err(ApiError::InvalidInput(format!(
            "Participant ID {} exceeds max participants {}",
            id, max_participants
        )));
    }

    Ok(())
}

pub fn validate_threshold(threshold: u16, total_participants: u16) -> Result<(), ApiError> {
    if threshold == 0 {
        return Err(ApiError::InvalidInput(
            "Threshold must be > 0".to_string(),
        ));
    }

    if threshold > total_participants {
        return Err(ApiError::InvalidInput(format!(
            "Threshold {} cannot exceed total participants {}",
            threshold, total_participants
        )));
    }

    if threshold == 1 && total_participants > 1 {
        tracing::warn!(
            "Threshold of 1 with {} participants is insecure",
            total_participants
        );
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_board_id_deterministic() {
        let members = vec![
            BoardMember {
                id: "alice".to_string(),
                organization: "Org A".to_string(),
                public_key: vec![0x01; 32],
                participant_id: 1,
            },
            BoardMember {
                id: "bob".to_string(),
                organization: "Org B".to_string(),
                public_key: vec![0x02; 32],
                participant_id: 2,
            },
        ];

        let id1 = generate_board_id(&BoardCategory::Healthcare, &members).unwrap();
        let id2 = generate_board_id(&BoardCategory::Healthcare, &members).unwrap();

        assert_eq!(id1, id2);
    }

    #[test]
    fn test_validate_threshold() {
        assert!(validate_threshold(2, 3).is_ok());
        assert!(validate_threshold(3, 3).is_ok());
        assert!(validate_threshold(0, 3).is_err());
        assert!(validate_threshold(4, 3).is_err());
    }

    #[test]
    fn test_validate_participant_id() {
        assert!(validate_participant_id(1, 5).is_ok());
        assert!(validate_participant_id(5, 5).is_ok());
        assert!(validate_participant_id(0, 5).is_err());
        assert!(validate_participant_id(6, 5).is_err());
    }
}
