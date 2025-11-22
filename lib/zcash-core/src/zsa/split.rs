use pasta_curves::pallas;
use orchard::{
    note::{Rho, RandomSeed},
    value::NoteValue,
    Address,
};
use ff::Field;

use crate::error::{Result, ZKFIEDError};
use super::{AssetBase, OrchardZSANote};

pub struct SplitNote {
    note: OrchardZSANote,
    is_split: bool,
}

impl SplitNote {
    pub fn create_padding(
        address: Address,
        asset_base: AssetBase,
        rho: Rho,
    ) -> Self {
        let zero_value = NoteValue::from_raw(0);
        let rseed = RandomSeed::random(&mut rand::thread_rng());

        let note = OrchardZSANote::new(
            address,
            zero_value,
            asset_base,
            rho,
            rseed,
        );

        SplitNote {
            note,
            is_split: true,
        }
    }

    pub fn from_note(note: OrchardZSANote) -> Self {
        SplitNote {
            note,
            is_split: false,
        }
    }

    pub fn is_split(&self) -> bool {
        self.is_split
    }

    pub fn note(&self) -> &OrchardZSANote {
        &self.note
    }

    pub fn note_ref(&self) -> &OrchardZSANote {
        &self.note
    }

    pub fn value_is_zero(&self) -> bool {
        self.note.value().inner() == 0
    }
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_split_note_padding() {
        use orchard::keys::{SpendingKey, FullViewingKey};

        let sk = SpendingKey::random(&mut rand::thread_rng());
        let fvk = FullViewingKey::from(&sk);
        let address = fvk.address_at(0u32.into());

        let asset_base = AssetBase::native();
        let rho = Rho::from_nf_old(pallas::Base::random(&mut rand::thread_rng()).into());

        let split = SplitNote::create_padding(address, asset_base, rho);

        assert!(split.is_split());
        assert!(split.value_is_zero());
    }

    #[test]
    fn test_split_note_from_note() {
        use orchard::keys::{SpendingKey, FullViewingKey};

        let sk = SpendingKey::random(&mut rand::thread_rng());
        let fvk = FullViewingKey::from(&sk);
        let address = fvk.address_at(0u32.into());

        let value = NoteValue::from_raw(1000);
        let asset_base = AssetBase::native();
        let rho = Rho::from_nf_old(pallas::Base::random(&mut rand::thread_rng()).into());
        let rseed = RandomSeed::random(&mut rand::thread_rng());

        let note = OrchardZSANote::new(address, value, asset_base, rho, rseed);
        let split = SplitNote::from_note(note);

        assert!(!split.is_split());
        assert!(!split.value_is_zero());
    }
}
