use pasta_curves::pallas;
use group::{Curve, Group, GroupEncoding};
use ff::PrimeField;
use orchard::{
    value::NoteValue,
    note::ExtractedNoteCommitment,
};

use crate::error::{Result, ZKFIEDError};
use super::AssetBase;

pub struct ValueCommitment(pallas::Point);

pub fn value_commit_zsa(
    value: i64,
    asset_base: &AssetBase,
    rcv: &pallas::Scalar,
) -> Result<ValueCommitment> {
    let value_scalar = if value >= 0 {
        pallas::Scalar::from(value as u64)
    } else {
        -pallas::Scalar::from((-value) as u64)
    };

    let r_point = pallas::Point::generator() * pallas::Scalar::from(2u64);

    let cv = (asset_base.inner() * value_scalar) + (r_point * rcv);

    Ok(ValueCommitment(cv))
}

impl ValueCommitment {
    pub fn inner(&self) -> &pallas::Point {
        &self.0
    }

    pub fn to_bytes(&self) -> [u8; 32] {
        self.0.to_bytes()
    }
}

pub fn note_commit_zsa(
    diversifier: &[u8; 11],
    pk_d: &pallas::Point,
    value: NoteValue,
    asset_base: &AssetBase,
    rho: &pallas::Base,
    psi: &pallas::Base,
    rcm: &pallas::Scalar,
) -> Result<ExtractedNoteCommitment> {
    use blake2b_simd::Params as Blake2bParams;

    let mut hasher = Blake2bParams::new()
        .hash_length(64)
        .personal(b"ZSA_NoteCommit__")
        .to_state();

    hasher.update(diversifier);
    hasher.update(&pk_d.to_bytes());
    hasher.update(&value.inner().to_le_bytes());
    hasher.update(&asset_base.to_bytes());
    hasher.update(&rho.to_repr());
    hasher.update(&psi.to_repr());
    hasher.update(&rcm.to_repr());

    let hash = hasher.finalize();

    let commitment_bytes: [u8; 32] = hash.as_bytes()[0..32].try_into()
        .map_err(|_| ZKFIEDError::Crypto("Hash length mismatch".to_string()))?;

    let point = pallas::Point::from_bytes(&commitment_bytes);
    if bool::from(point.is_none()) {
        return Err(ZKFIEDError::Crypto("Invalid commitment point".to_string()));
    }

    Ok(ExtractedNoteCommitment::from_bytes(&commitment_bytes).unwrap())
}

#[cfg(test)]
mod tests {
    use super::*;
    use ff::Field;

    #[test]
    fn test_value_commit_zsa() {
        let asset_base = AssetBase::native();
        let rcv = pallas::Scalar::random(&mut rand::thread_rng());

        let cv = value_commit_zsa(1000, &asset_base, &rcv).unwrap();
        assert_eq!(cv.to_bytes().len(), 32);
    }

    #[test]
    fn test_value_commit_negative() {
        let asset_base = AssetBase::native();
        let rcv = pallas::Scalar::random(&mut rand::thread_rng());

        let cv = value_commit_zsa(-1000, &asset_base, &rcv).unwrap();
        assert_eq!(cv.to_bytes().len(), 32);
    }
}
