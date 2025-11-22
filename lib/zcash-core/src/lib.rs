//! ZKFIED Zcash Core Library
//!
//! Production-grade cryptographic implementation for ZKFIED whistleblower platform.
//! Uses audited libraries from Zcash Foundation and implements ZIP specifications.
//!
//! # Security Notice
//!
//! This library handles sensitive cryptographic operations. All implementations
//! use constant-time operations where applicable and properly zeroize secrets.
//!
//! # Features
//!
//! - **ZSA (Zcash Shielded Assets)**: OrchardZSA protocol implementation (ZIP 226/227)
//! - **FROST**: Rerandomized threshold signatures for board authorization (ZIP 312)
//! - **Payment Disclosure**: Cryptographic proofs for evidence verification (ZIP 311)
//! - **Time-Lock**: Transaction expiry via nExpiryHeight (ZIP 203)
//! - **Secure Key Management**: Zeroized memory, HSM support

#![deny(unsafe_code)]
#![warn(missing_docs)]

pub mod zsa;
pub mod frost;
pub mod disclosure;
pub mod memo;
pub mod keys;
pub mod transaction;

/// Common error types
pub mod error {
    use thiserror::Error;

    /// Primary error type for ZKFIED operations
    #[derive(Error, Debug)]
    pub enum ZKFIEDError {
        /// Cryptographic operation failed
        #[error("Cryptographic error: {0}")]
        Crypto(String),

        /// Invalid parameters provided
        #[error("Invalid parameter: {0}")]
        InvalidParameter(String),

        /// FROST threshold signature error
        #[error("FROST error: {0}")]
        FROST(String),

        /// ZSA operation error
        #[error("ZSA error: {0}")]
        ZSA(String),

        /// Payment disclosure error
        #[error("Payment disclosure error: {0}")]
        PaymentDisclosure(String),

        /// Transaction building error
        #[error("Transaction error: {0}")]
        Transaction(String),

        /// Serialization error
        #[error("Serialization error: {0}")]
        Serialization(String),

        /// Generic error
        #[error("{0}")]
        Other(String),
    }

    /// Result type using ZKFIEDError
    pub type Result<T> = std::result::Result<T, ZKFIEDError>;
}

// Re-export commonly used types
pub use error::{Result, ZKFIEDError};

// Re-export key modules
pub use zsa::{AssetBase, OrchardZSANote, EvidenceMetadata, BoardCategory};
pub use frost::{BoardGroup, FROSTSigner, AuthorizationMemo};
pub use disclosure::PaymentDisclosureProof;
pub use memo::MemoEncoder;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_library_exports() {
        // Verify key types are accessible
        let _: Option<AssetBase> = None;
        let _: Option<BoardCategory> = None;
    }
}
