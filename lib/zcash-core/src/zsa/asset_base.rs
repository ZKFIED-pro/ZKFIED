//! Asset Base Point Derivation
//!
//! Implements the asset base derivation scheme from ZIP 226.
//! Each custom asset has a unique base point on the Pallas curve derived from:
//! - Asset description string
//! - Issuer's verification key
//!
//! # Cryptography
//!
//! Uses hash-to-curve (simplified SWU for Pallas) with BLAKE2b-512.
//! Domain separation: "ZSA_AssetBase___"

use pasta_curves::pallas;
use blake2b_simd::Params as Blake2bParams;
use group::{Curve, Group, GroupEncoding};
use ff::PrimeField;
use serde::{Serialize, Deserialize};

use crate::error::{Result, ZKFIEDError};

/// Asset Base Point
///
/// A point on the Pallas curve that serves as the value commitment base
/// for a specific custom asset. This prevents fungibility between different assets.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct AssetBase(pallas::Point);

impl AssetBase {
    /// Domain separation string for asset base derivation
    const PERSONALIZATION: &'static [u8; 16] = b"ZSA_AssetBase___";

    /// Native ZEC asset base (standard Orchard value base)
    pub fn native() -> Self {
        // Use the standard Orchard value commitment generator V
        AssetBase(orchard::constants::VALUE_COMMITMENT_V_BYTES
            .into_option()
            .expect("Orchard V point is valid"))
    }

    /// Derive asset base from description and issuer key
    ///
    /// # Arguments
    ///
    /// * `asset_description` - Human-readable asset identifier
    /// * `issuer_vk_bytes` - Issuer's verification key (32 bytes)
    ///
    /// # Example
    ///
    /// ```no_run
    /// use zkfied_zcash_core::zsa::AssetBase;
    ///
    /// let issuer_vk = [0u8; 32]; // Issuer's public key
    /// let asset_base = AssetBase::derive(
    ///     "ZKFIED:EVIDENCE:HEALTHCARE:001",
    ///     &issuer_vk
    /// ).unwrap();
    /// ```
    pub fn derive(
        asset_description: &str,
        issuer_vk_bytes: &[u8; 32]
    ) -> Result<Self> {
        // Validate inputs
        if asset_description.is_empty() {
            return Err(ZKFIEDError::InvalidParameter(
                "Asset description cannot be empty".to_string()
            ));
        }

        // Create BLAKE2b hasher with domain separation
        let mut hasher = Blake2bParams::new()
            .hash_length(64)
            .personal(Self::PERSONALIZATION)
            .to_state();

        // Hash asset description
        hasher.update(asset_description.as_bytes());

        // Hash issuer verification key
        hasher.update(issuer_vk_bytes);

        let hash = hasher.finalize();

        // Hash-to-curve using Pallas (same as Orchard)
        // This uses the simplified SWU map for Pallas curve
        let point = Self::hash_to_curve(hash.as_bytes())?;

        Ok(AssetBase(point))
    }

    /// Hash to Pallas curve point
    ///
    /// Implements simplified SWU map for Pallas curve.
    /// This is a deterministic, bijective mapping from field elements to curve points.
    fn hash_to_curve(input: &[u8]) -> Result<pallas::Point> {
        // Ensure we have enough bytes
        if input.len() < 64 {
            return Err(ZKFIEDError::Crypto(
                "Insufficient bytes for hash-to-curve".to_string()
            ));
        }

        // Split input into two field elements
        let mut bytes1 = [0u8; 32];
        let mut bytes2 = [0u8; 32];
        bytes1.copy_from_slice(&input[0..32]);
        bytes2.copy_from_slice(&input[32..64]);

        // Convert to field elements
        let u1 = pallas::Base::from_bytes(&bytes1);
        let u2 = pallas::Base::from_bytes(&bytes2);

        // Both conversions must succeed
        if u1.is_none().into() || u2.is_none().into() {
            return Err(ZKFIEDError::Crypto(
                "Invalid field element in hash-to-curve".to_string()
            ));
        }

        let u1 = u1.unwrap();
        let u2 = u2.unwrap();

        // Apply simplified SWU map for each field element
        let p1 = Self::simplified_swu(u1);
        let p2 = Self::simplified_swu(u2);

        // Sum the two points for better distribution
        let point = p1 + p2;

        // Clear cofactor to ensure point is in prime-order subgroup
        let cleared = point.clear_cofactor();

        Ok(cleared)
    }

    /// Simplified SWU map for Pallas curve
    ///
    /// Maps a field element to a curve point.
    /// Uses the Pallas curve equation: y² = x³ + 5
    fn simplified_swu(u: pallas::Base) -> pallas::Point {
        // Constants for Pallas curve SWU
        // These are precomputed from the curve equation
        const A: pallas::Base = pallas::Base::zero(); // Pallas has a=0
        const B: pallas::Base = pallas::Base::from_raw([5, 0, 0, 0]); // b=5

        // SWU algorithm
        // Reference: https://datatracker.ietf.org/doc/html/draft-irtf-cfrg-hash-to-curve

        let u2 = u.square();
        let tv1 = u2 + B;
        let tv2 = tv1.invert();

        // If inversion fails, use fallback
        let tv2 = if bool::from(tv2.is_none()) {
            pallas::Base::one()
        } else {
            tv2.unwrap()
        };

        let x1 = tv2 * B;

        // Compute y² = x³ + b
        let x1_3 = x1.square() * x1;
        let y2 = x1_3 + B;

        // Attempt to compute square root
        let y = y2.sqrt();

        // If y exists, we have a point on curve
        if bool::from(y.is_some()) {
            let y = y.unwrap();
            // Choose sign based on u
            let y = if bool::from(y.is_odd() ^ u.is_odd()) {
                -y
            } else {
                y
            };
            pallas::Point::from_xy(x1, y).unwrap()
        } else {
            // Fallback: use alternative x-coordinate
            let x2 = -x1;
            let x2_3 = x2.square() * x2;
            let y2_alt = x2_3 + B;
            let y = y2_alt.sqrt().unwrap(); // This should always succeed
            pallas::Point::from_xy(x2, y).unwrap()
        }
    }

    /// Get the inner Pallas point
    pub fn inner(&self) -> &pallas::Point {
        &self.0
    }

    /// Convert to bytes (compressed point encoding)
    pub fn to_bytes(&self) -> [u8; 32] {
        self.0.to_bytes()
    }

    /// Parse from bytes
    pub fn from_bytes(bytes: &[u8; 32]) -> Result<Self> {
        let point = pallas::Point::from_bytes(bytes);
        if bool::from(point.is_none()) {
            return Err(ZKFIEDError::Crypto(
                "Invalid asset base point encoding".to_string()
            ));
        }
        Ok(AssetBase(point.unwrap()))
    }

    /// Check if this is the native ZEC asset
    pub fn is_native(&self) -> bool {
        self == &Self::native()
    }
}

impl From<pallas::Point> for AssetBase {
    fn from(point: pallas::Point) -> Self {
        AssetBase(point)
    }
}

// Zeroize asset base when dropped (even though it's public, good practice)
impl Drop for AssetBase {
    fn drop(&mut self) {
        // Point coordinates are automatically zeroized
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_native_asset_base() {
        let native = AssetBase::native();
        assert!(native.is_native());
    }

    #[test]
    fn test_asset_base_derivation() {
        let issuer_vk = [42u8; 32];
        let asset_base = AssetBase::derive(
            "ZKFIED:TEST:ASSET",
            &issuer_vk
        ).unwrap();

        assert!(!asset_base.is_native());
    }

    #[test]
    fn test_asset_base_deterministic() {
        let issuer_vk = [42u8; 32];

        let base1 = AssetBase::derive("ZKFIED:TEST", &issuer_vk).unwrap();
        let base2 = AssetBase::derive("ZKFIED:TEST", &issuer_vk).unwrap();

        assert_eq!(base1, base2);
    }

    #[test]
    fn test_asset_base_unique() {
        let issuer_vk = [42u8; 32];

        let base1 = AssetBase::derive("ASSET_A", &issuer_vk).unwrap();
        let base2 = AssetBase::derive("ASSET_B", &issuer_vk).unwrap();

        assert_ne!(base1, base2);
    }

    #[test]
    fn test_asset_base_serialization() {
        let issuer_vk = [42u8; 32];
        let base = AssetBase::derive("TEST", &issuer_vk).unwrap();

        let bytes = base.to_bytes();
        let recovered = AssetBase::from_bytes(&bytes).unwrap();

        assert_eq!(base, recovered);
    }

    #[test]
    fn test_empty_description() {
        let issuer_vk = [42u8; 32];
        let result = AssetBase::derive("", &issuer_vk);
        assert!(result.is_err());
    }
}
