use crate::error::{Result, ZKFIEDError};

pub struct FROSTSigner {
    key_data: Vec<u8>,
}

impl FROSTSigner {
    pub fn new(key_data: Vec<u8>) -> Self {
        FROSTSigner { key_data }
    }

    pub fn sign(&self, message: &[u8]) -> Result<Vec<u8>> {
        use blake2b_simd::Params as Blake2bParams;

        let mut hasher = Blake2bParams::new()
            .hash_length(64)
            .personal(b"ZKFIED_Sign_____")
            .to_state();

        hasher.update(&self.key_data);
        hasher.update(message);

        let hash = hasher.finalize();
        Ok(hash.as_bytes().to_vec())
    }
}
