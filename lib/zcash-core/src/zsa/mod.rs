//! Zcash Shielded Assets (ZSA) Implementation
//!
//! Implements ZIP 226/227 - OrchardZSA protocol for privacy-preserving custom assets.
//!
//! # Overview
//!
//! Each evidence submission is represented as a unique ZSA token (non-fungible, amount=1).
//! The ZSA protocol extends Orchard with:
//! - Asset-specific base points on the Pallas curve
//! - Variable-base value commitments
//! - Split notes for asset padding
//! - Per-asset balance validation
//!
//! # Security
//!
//! - Uses audited `orchard` crate as foundation
//! - Implements proper note commitment schemes
//! - Prevents asset base substitution attacks
//! - Maintains backwards compatibility with native ZEC

pub mod asset_base;
pub mod note;
pub mod commitment;
pub mod split;

pub use asset_base::AssetBase;
pub use note::{OrchardZSANote, EvidenceMetadata, BoardCategory};
pub use commitment::{value_commit_zsa, note_commit_zsa};
pub use split::SplitNote;

use crate::error::{Result, ZKFIEDError};

/// Re-export commonly used Orchard types
pub use orchard::{
    note::{Nullifier, RandomSeed},
    value::NoteValue,
    keys::{FullViewingKey, SpendingKey},
    Address,
};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_zsa_module_exports() {
        // Verify all public types are accessible
        let _: Option<AssetBase> = None;
        let _: Option<BoardCategory> = None;
    }
}
