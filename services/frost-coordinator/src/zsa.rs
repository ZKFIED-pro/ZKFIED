use blake2::{Blake2b512, Blake2s256, Digest};
use group::{GroupEncoding, Group};
use rand_core::{CryptoRng, RngCore};
use serde::{Deserialize, Serialize};
use serde_big_array::BigArray;
use subtle::ConditionallySelectable;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ZsaError {
    #[error("Invalid asset description: {0}")]
    InvalidDescription(String),

    #[error("Invalid asset identifier: {0}")]
    InvalidAssetId(String),

    #[error("Asset finalized, no more issuance allowed")]
    AssetFinalized,

    #[error("Balance overflow: {0}")]
    BalanceOverflow(String),

    #[error("Serialization error: {0}")]
    SerializationError(String),
}

pub const MAX_ISSUE: u64 = u64::MAX - 1;

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct IssuerIdentifier(pub [u8; 32]);

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct AssetDescHash(pub [u8; 32]);

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct AssetId {
    pub issuer: IssuerIdentifier,
    pub asset_desc_hash: AssetDescHash,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct AssetBase(pub [u8; 32]);

impl AssetBase {
    pub fn from_evidence_id(evidence_id: &str) -> Result<Self, ZsaError> {
        let mut hasher = Blake2s256::new();
        hasher.update(b"ZKFIED-Evidence-AssetBase");
        hasher.update(evidence_id.as_bytes());
        let hash = hasher.finalize();
        let mut result = [0u8; 32];
        result.copy_from_slice(&hash[..]);
        Ok(AssetBase(result))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IssuanceAuthorizingKey(pub [u8; 32]);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IssuanceValidatingKey(pub [u8; 32]);

impl AssetDescHash {
    pub fn from_description(asset_desc: &str) -> Result<Self, ZsaError> {
        if !asset_desc.is_empty() && asset_desc.len() <= 512 {
            let mut hasher = Blake2s256::new();
            hasher.update(b"ZSA-AssetDescCRH");
            hasher.update(asset_desc.as_bytes());
            let hash = hasher.finalize();
            let mut result = [0u8; 32];
            result.copy_from_slice(&hash[..]);
            Ok(AssetDescHash(result))
        } else {
            Err(ZsaError::InvalidDescription(
                "Asset description must be 1-512 bytes".to_string()
            ))
        }
    }
}

impl AssetId {
    pub fn new(issuer: IssuerIdentifier, asset_desc: &str) -> Result<Self, ZsaError> {
        let asset_desc_hash = AssetDescHash::from_description(asset_desc)?;
        Ok(AssetId {
            issuer,
            asset_desc_hash,
        })
    }

    pub fn encode(&self) -> Vec<u8> {
        let mut encoded = vec![0x00];
        encoded.extend_from_slice(&self.issuer.0);
        encoded.extend_from_slice(&self.asset_desc_hash.0);
        encoded
    }

    pub fn decode(bytes: &[u8]) -> Result<Self, ZsaError> {
        if bytes.len() != 65 || bytes[0] != 0x00 {
            return Err(ZsaError::InvalidAssetId("Invalid encoding".to_string()));
        }

        let mut issuer_bytes = [0u8; 32];
        let mut desc_hash_bytes = [0u8; 32];

        issuer_bytes.copy_from_slice(&bytes[1..33]);
        desc_hash_bytes.copy_from_slice(&bytes[33..65]);

        Ok(AssetId {
            issuer: IssuerIdentifier(issuer_bytes),
            asset_desc_hash: AssetDescHash(desc_hash_bytes),
        })
    }

    pub fn asset_digest(&self) -> [u8; 64] {
        let mut hasher = Blake2b512::new();
        hasher.update(b"ZSA-Asset-Digest");
        hasher.update(&self.encode());
        let result = hasher.finalize();
        let mut digest = [0u8; 64];
        digest.copy_from_slice(&result[..]);
        digest
    }

    pub fn asset_base<G: Group + GroupEncoding + ConditionallySelectable>(&self) -> Result<AssetBase, ZsaError>
    where
        G::Repr: Default,
    {
        let digest = self.asset_digest();
        let point = group_hash::<G>(b"z.cash:OrchardZSA", &digest);

        let encoded = point.to_bytes();
        let mut base = [0u8; 32];
        base.copy_from_slice(encoded.as_ref());
        Ok(AssetBase(base))
    }
}

fn group_hash<G: Group + GroupEncoding + ConditionallySelectable>(domain: &[u8], data: &[u8]) -> G
where
    G::Repr: Default,
{
    let mut hasher = Blake2b512::new();
    hasher.update(domain);
    hasher.update(data);
    let hash = hasher.finalize();

    let mut repr = G::Repr::default();
    let bytes = repr.as_mut();
    let len = bytes.len().min(hash.len());
    bytes[..len].copy_from_slice(&hash[..len]);

    G::from_bytes(&repr).unwrap_or_else(|| G::identity())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IssueNote {
    pub diversifier: [u8; 11],
    pub transmission_key: [u8; 32],
    pub value: u64,
    pub asset_base: AssetBase,
    pub rho: [u8; 32],
    pub psi: [u8; 32],
    pub rcm: [u8; 32],
}

impl IssueNote {
    pub fn new<R: RngCore + CryptoRng>(
        rng: &mut R,
        recipient_address: &[u8],
        value: u64,
        asset_base: AssetBase,
        nf_old: &[u8; 32],
        action_index: u32,
        note_index: u32,
    ) -> Self {
        let mut diversifier = [0u8; 11];
        let mut transmission_key = [0u8; 32];
        let mut psi = [0u8; 32];
        let mut rcm = [0u8; 32];

        if recipient_address.len() >= 43 {
            diversifier.copy_from_slice(&recipient_address[0..11]);
            transmission_key.copy_from_slice(&recipient_address[11..43]);
        }

        rng.fill_bytes(&mut psi);
        rng.fill_bytes(&mut rcm);

        let rho = derive_issued_rho(nf_old, action_index, note_index);

        IssueNote {
            diversifier,
            transmission_key,
            value,
            asset_base,
            rho,
            psi,
            rcm,
        }
    }

    pub fn commitment(&self) -> [u8; 32] {
        let mut hasher = Blake2b512::new();
        hasher.update(b"ZSA-NoteCommit");
        hasher.update(&self.diversifier);
        hasher.update(&self.transmission_key);
        hasher.update(&self.value.to_le_bytes());
        hasher.update(&self.asset_base.0);
        hasher.update(&self.rho);
        hasher.update(&self.psi);
        hasher.update(&self.rcm);

        let result = hasher.finalize();
        let mut commitment = [0u8; 32];
        commitment.copy_from_slice(&result[..32]);
        commitment
    }
}

fn derive_issued_rho(nf_old: &[u8; 32], action_index: u32, note_index: u32) -> [u8; 32] {
    let mut hasher = Blake2b512::new();
    hasher.update(b"ZSA-DeriveIssuedRho");
    hasher.update(nf_old);
    hasher.update(&action_index.to_le_bytes());
    hasher.update(&note_index.to_le_bytes());

    let result = hasher.finalize();
    let mut rho = [0u8; 32];
    rho.copy_from_slice(&result[..32]);
    rho
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IssueAction {
    pub asset_desc_hash: AssetDescHash,
    pub notes: Vec<IssueNote>,
    pub finalize: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IssueBundle {
    pub ik: IssuanceValidatingKey,
    pub issue_actions: Vec<IssueAction>,
    #[serde(with = "BigArray")]
    pub isk_sig: [u8; 64],
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlobalAssetState {
    pub balance: u64,
    pub finalized: bool,
    pub reference_note_commitment: [u8; 32],
}

pub struct AssetRegistry {
    issued_assets: std::collections::HashMap<AssetBase, GlobalAssetState>,
}

impl AssetRegistry {
    pub fn new() -> Self {
        AssetRegistry {
            issued_assets: std::collections::HashMap::new(),
        }
    }

    pub fn process_issuance(
        &mut self,
        asset_base: &AssetBase,
        issue_action: &IssueAction,
    ) -> Result<(), ZsaError> {
        let total_issued: u64 = issue_action.notes.iter()
            .map(|note| note.value)
            .try_fold(0u64, |acc, v| {
                acc.checked_add(v)
                    .ok_or(ZsaError::BalanceOverflow("Issue action overflow".to_string()))
            })?;

        let current_state = self.issued_assets.get(asset_base);

        if let Some(state) = current_state {
            if state.finalized {
                return Err(ZsaError::AssetFinalized);
            }

            let new_balance = state.balance.checked_add(total_issued)
                .ok_or(ZsaError::BalanceOverflow("Global balance overflow".to_string()))?;

            if new_balance > MAX_ISSUE {
                return Err(ZsaError::BalanceOverflow(format!(
                    "Exceeds MAX_ISSUE: {} > {}",
                    new_balance, MAX_ISSUE
                )));
            }

            let new_state = GlobalAssetState {
                balance: new_balance,
                finalized: issue_action.finalize,
                reference_note_commitment: state.reference_note_commitment,
            };

            self.issued_assets.insert(asset_base.clone(), new_state);
        } else {
            if issue_action.notes.is_empty() {
                return Err(ZsaError::InvalidDescription(
                    "First issuance must have notes".to_string()
                ));
            }

            let reference_note = &issue_action.notes[0];
            let reference_commitment = reference_note.commitment();

            let new_state = GlobalAssetState {
                balance: total_issued,
                finalized: issue_action.finalize,
                reference_note_commitment: reference_commitment,
            };

            self.issued_assets.insert(asset_base.clone(), new_state);
        }

        Ok(())
    }

    pub fn get_asset_state(&self, asset_base: &AssetBase) -> Option<&GlobalAssetState> {
        self.issued_assets.get(asset_base)
    }
}

impl Default for AssetRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetBurn {
    pub asset_base: AssetBase,
    pub value: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_asset_desc_hash() {
        let desc = "Healthcare Evidence Token";
        let hash1 = AssetDescHash::from_description(desc).unwrap();
        let hash2 = AssetDescHash::from_description(desc).unwrap();

        assert_eq!(hash1, hash2);
        assert_eq!(hash1.0.len(), 32);
    }

    #[test]
    fn test_asset_id_encoding() {
        let issuer = IssuerIdentifier([42u8; 32]);
        let asset_id = AssetId::new(issuer, "Test Asset").unwrap();

        let encoded = asset_id.encode();
        assert_eq!(encoded.len(), 65);
        assert_eq!(encoded[0], 0x00);

        let decoded = AssetId::decode(&encoded).unwrap();
        assert_eq!(decoded.issuer, asset_id.issuer);
        assert_eq!(decoded.asset_desc_hash, asset_id.asset_desc_hash);
    }

    #[test]
    fn test_asset_digest() {
        let issuer = IssuerIdentifier([1u8; 32]);
        let asset_id = AssetId::new(issuer, "Evidence").unwrap();

        let digest = asset_id.asset_digest();
        assert_eq!(digest.len(), 64);
    }

    #[test]
    fn test_issue_note_commitment() {
        let mut rng = rand_core::OsRng;
        let asset_base = AssetBase([0u8; 32]);
        let recipient = [0u8; 43];
        let nf_old = [0u8; 32];

        let note = IssueNote::new(&mut rng, &recipient, 100, asset_base, &nf_old, 0, 0);
        let commitment = note.commitment();

        assert_eq!(commitment.len(), 32);
    }

    #[test]
    fn test_asset_registry_first_issuance() {
        let mut registry = AssetRegistry::new();
        let asset_base = AssetBase([1u8; 32]);

        let mut rng = rand_core::OsRng;
        let note = IssueNote::new(
            &mut rng,
            &[0u8; 43],
            1000,
            asset_base.clone(),
            &[0u8; 32],
            0,
            0
        );

        let issue_action = IssueAction {
            asset_desc_hash: AssetDescHash([0u8; 32]),
            notes: vec![note],
            finalize: false,
        };

        let result = registry.process_issuance(&asset_base, &issue_action);
        assert!(result.is_ok());

        let state = registry.get_asset_state(&asset_base).unwrap();
        assert_eq!(state.balance, 1000);
        assert!(!state.finalized);
    }

    #[test]
    fn test_asset_registry_finalization() {
        let mut registry = AssetRegistry::new();
        let asset_base = AssetBase([2u8; 32]);

        let mut rng = rand_core::OsRng;
        let note1 = IssueNote::new(&mut rng, &[0u8; 43], 500, asset_base.clone(), &[0u8; 32], 0, 0);

        let issue1 = IssueAction {
            asset_desc_hash: AssetDescHash([0u8; 32]),
            notes: vec![note1],
            finalize: false,
        };

        registry.process_issuance(&asset_base, &issue1).unwrap();

        let note2 = IssueNote::new(&mut rng, &[0u8; 43], 500, asset_base.clone(), &[0u8; 32], 0, 0);

        let issue2 = IssueAction {
            asset_desc_hash: AssetDescHash([0u8; 32]),
            notes: vec![note2],
            finalize: true,
        };

        registry.process_issuance(&asset_base, &issue2).unwrap();

        let state = registry.get_asset_state(&asset_base).unwrap();
        assert_eq!(state.balance, 1000);
        assert!(state.finalized);

        let note3 = IssueNote::new(&mut rng, &[0u8; 43], 100, asset_base.clone(), &[0u8; 32], 0, 0);
        let issue3 = IssueAction {
            asset_desc_hash: AssetDescHash([0u8; 32]),
            notes: vec![note3],
            finalize: false,
        };

        let result = registry.process_issuance(&asset_base, &issue3);
        assert!(result.is_err());
    }

    #[test]
    fn test_balance_overflow() {
        let mut registry = AssetRegistry::new();
        let asset_base = AssetBase([3u8; 32]);

        let mut rng = rand_core::OsRng;
        let note = IssueNote::new(&mut rng, &[0u8; 43], MAX_ISSUE, asset_base.clone(), &[0u8; 32], 0, 0);

        let issue1 = IssueAction {
            asset_desc_hash: AssetDescHash([0u8; 32]),
            notes: vec![note],
            finalize: false,
        };

        registry.process_issuance(&asset_base, &issue1).unwrap();

        let note2 = IssueNote::new(&mut rng, &[0u8; 43], 100, asset_base.clone(), &[0u8; 32], 0, 0);
        let issue2 = IssueAction {
            asset_desc_hash: AssetDescHash([0u8; 32]),
            notes: vec![note2],
            finalize: false,
        };

        let result = registry.process_issuance(&asset_base, &issue2);
        assert!(result.is_err());
    }
}
