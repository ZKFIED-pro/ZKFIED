use pasta_curves::pallas;
use orchard::{
    note::{Nullifier, RandomSeed, Rho},
    value::NoteValue,
    keys::Diversifier,
    Address,
};
use serde::{Serialize, Deserialize};

use crate::error::{Result, ZKFIEDError};
use super::AssetBase;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[repr(u8)]
pub enum BoardCategory {
    Government = 0x01,
    Healthcare = 0x02,
    Corporate = 0x03,
    Media = 0x04,
    Environment = 0x05,
    Legal = 0x06,
    Education = 0x07,
    CivilSociety = 0x08,
}

impl BoardCategory {
    pub fn from_u8(byte: u8) -> Result<Self> {
        match byte {
            0x01 => Ok(Self::Government),
            0x02 => Ok(Self::Healthcare),
            0x03 => Ok(Self::Corporate),
            0x04 => Ok(Self::Media),
            0x05 => Ok(Self::Environment),
            0x06 => Ok(Self::Legal),
            0x07 => Ok(Self::Education),
            0x08 => Ok(Self::CivilSociety),
            _ => Err(ZKFIEDError::InvalidParameter(format!("Invalid board category: {}", byte))),
        }
    }

    pub fn to_u8(&self) -> u8 {
        *self as u8
    }
}

#[derive(Clone, Serialize, Deserialize)]
pub struct EvidenceMetadata {
    pub board: BoardCategory,
    pub ipfs_cid: String,
    pub commitment: [u8; 32],
    pub timestamp: u64,
    pub viewing_keys_hint: [u8; 32],
}

#[derive(Clone)]
pub struct OrchardZSANote {
    diversifier: Diversifier,
    pk_d: pallas::Point,
    value: NoteValue,
    asset_base: AssetBase,
    rho: Rho,
    psi: pallas::Base,
    rseed: RandomSeed,
}

impl OrchardZSANote {
    pub fn new(
        address: Address,
        value: NoteValue,
        asset_base: AssetBase,
        rho: Rho,
        rseed: RandomSeed,
    ) -> Self {
        use ff::Field;

        let diversifier = address.diversifier();
        let pk_d = *address.pk_d().inner();
        let psi = pallas::Base::random(&mut rand::thread_rng());

        OrchardZSANote {
            diversifier,
            pk_d,
            value,
            asset_base,
            rho,
            psi,
            rseed,
        }
    }

    pub fn diversifier(&self) -> &Diversifier {
        &self.diversifier
    }

    pub fn pk_d(&self) -> &pallas::Point {
        &self.pk_d
    }

    pub fn value(&self) -> NoteValue {
        self.value
    }

    pub fn asset_base(&self) -> &AssetBase {
        &self.asset_base
    }

    pub fn rho(&self) -> &Rho {
        &self.rho
    }

    pub fn psi(&self) -> &pallas::Base {
        &self.psi
    }

    pub fn rseed(&self) -> &RandomSeed {
        &self.rseed
    }

    pub fn is_native_asset(&self) -> bool {
        self.asset_base.is_native()
    }

    pub fn nullifier(&self, fvk: &orchard::keys::FullViewingKey) -> Nullifier {
        self.rho.derive_nullifier(fvk.nk())
    }
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_board_category_roundtrip() {
        let board = BoardCategory::Healthcare;
        let byte = board.to_u8();
        let recovered = BoardCategory::from_u8(byte).unwrap();
        assert_eq!(board as u8, recovered as u8);
    }

    #[test]
    fn test_invalid_board_category() {
        let result = BoardCategory::from_u8(0xFF);
        assert!(result.is_err());
    }
}
