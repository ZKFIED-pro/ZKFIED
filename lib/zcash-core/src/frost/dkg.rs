use frost_rerandomized::frost_core;
use rand::rngs::OsRng;
use std::collections::HashMap;

use crate::error::{Result, ZKFIEDError};
use super::{BoardGroup, Participant};
use crate::zsa::BoardCategory;

pub struct BoardDKG {
    threshold: u16,
    num_participants: u16,
}

impl BoardDKG {
    pub fn new(threshold: u16, num_participants: u16) -> Result<Self> {
        if threshold > num_participants {
            return Err(ZKFIEDError::FROST(
                "Threshold exceeds participants".to_string()
            ));
        }

        Ok(BoardDKG {
            threshold,
            num_participants,
        })
    }

    pub fn execute(
        &self,
        board: BoardCategory,
        organizations: Vec<String>,
    ) -> Result<BoardGroup> {
        if organizations.len() != self.num_participants as usize {
            return Err(ZKFIEDError::FROST(
                "Organizations count mismatch".to_string()
            ));
        }

        let group_id = Self::derive_group_id(board, &organizations);

        let participants: Vec<Participant> = organizations.iter()
            .enumerate()
            .map(|(i, org)| Participant {
                identifier: vec![(i + 1) as u8],
                organization: org.clone(),
                index: (i + 1) as u16,
                public_key_share: vec![],
            })
            .collect();

        let board_group = BoardGroup {
            group_id,
            board,
            threshold: self.threshold,
            total_participants: self.num_participants,
            participants,
            group_public_key: vec![],
        };

        Ok(board_group)
    }

    fn derive_group_id(board: BoardCategory, organizations: &[String]) -> [u8; 32] {
        use blake2b_simd::Params as Blake2bParams;

        let mut hasher = Blake2bParams::new()
            .hash_length(32)
            .personal(b"ZKFIED_GroupID__")
            .to_state();

        hasher.update(&[board.to_u8()]);
        for org in organizations {
            hasher.update(org.as_bytes());
        }

        let hash = hasher.finalize();
        let mut result = [0u8; 32];
        result.copy_from_slice(hash.as_bytes());
        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_board_dkg_creation() {
        let dkg = BoardDKG::new(3, 5).unwrap();
        assert_eq!(dkg.threshold, 3);
        assert_eq!(dkg.num_participants, 5);
    }

    #[test]
    fn test_invalid_threshold() {
        let result = BoardDKG::new(6, 5);
        assert!(result.is_err());
    }

    #[test]
    fn test_dkg_execution() {
        let dkg = BoardDKG::new(2, 3).unwrap();
        let orgs = vec!["NGO1".to_string(), "NGO2".to_string(), "NGO3".to_string()];

        let result = dkg.execute(BoardCategory::Healthcare, orgs);
        assert!(result.is_ok());

        let board_group = result.unwrap();
        assert_eq!(board_group.participants.len(), 3);
        assert_eq!(board_group.threshold, 2);
    }
}
