use crate::error::{Result, ZKFIEDError};

pub fn aggregate_signatures(
    shares: &[Vec<u8>],
) -> Result<Vec<u8>> {
    if shares.is_empty() {
        return Err(ZKFIEDError::FROST("No shares to aggregate".to_string()));
    }

    use blake2b_simd::Params as Blake2bParams;

    let mut hasher = Blake2bParams::new()
        .hash_length(64)
        .personal(b"ZKFIED_Aggregate")
        .to_state();

    for share in shares {
        hasher.update(share);
    }

    let hash = hasher.finalize();
    Ok(hash.as_bytes().to_vec())
}
