use anyhow::{Result, Context};
use zcash_keys::keys::{UnifiedSpendingKey, UnifiedFullViewingKey, UnifiedAddressRequest};
use zcash_keys::address::UnifiedAddress;
use zcash_primitives::consensus::Network;
use zip32::AccountId;
use rand::RngCore;
use bip39::{Language, Mnemonic};

/// Generate a new Zcash wallet for testnet
pub struct WalletKeygen {
    network: Network,
}

impl WalletKeygen {
    pub fn new(network: Network) -> Self {
        Self { network }
    }

    /// Generate a new unified spending key from random seed
    pub fn generate_spending_key(&self) -> Result<UnifiedSpendingKey> {
        let mut seed = [0u8; 32];
        rand::thread_rng().fill_bytes(&mut seed);

        tracing::info!("Generating new wallet from random seed");

        let spending_key = UnifiedSpendingKey::from_seed(
            &self.network,
            &seed,
            AccountId::ZERO,
        ).context("Failed to derive spending key from seed")?;

        Ok(spending_key)
    }

    /// Generate a unified spending key from a specific seed (for deterministic wallets)
    pub fn generate_spending_key_from_seed(&self, seed: &[u8]) -> Result<UnifiedSpendingKey> {
        let mut seed_array = [0u8; 32];
        let copy_len = seed.len().min(32);
        seed_array[..copy_len].copy_from_slice(&seed[..copy_len]);

        tracing::info!("Generating wallet from deterministic seed");

        let spending_key = UnifiedSpendingKey::from_seed(
            &self.network,
            &seed_array,
            AccountId::ZERO,
        ).context("Failed to derive spending key from seed")?;

        Ok(spending_key)
    }

    /// Derive the unified full viewing key from spending key
    pub fn derive_viewing_key(&self, spending_key: &UnifiedSpendingKey) -> Result<UnifiedFullViewingKey> {
        let ufvk = spending_key.to_unified_full_viewing_key();
        Ok(ufvk)
    }

    /// Get a unified address from the viewing key
    pub fn get_address(&self, ufvk: &UnifiedFullViewingKey) -> Result<UnifiedAddress> {
        let (address, _diversifier_index) = ufvk.default_address(UnifiedAddressRequest::AllAvailableKeys)
            .context("Failed to derive default address from viewing key")?;

        Ok(address)
    }

    /// Generate a complete wallet (spending key, viewing key, and address)
    pub fn generate_wallet(&self) -> Result<Wallet> {
        let spending_key = self.generate_spending_key()?;
        let viewing_key = self.derive_viewing_key(&spending_key)?;
        let address = self.get_address(&viewing_key)?;

        tracing::info!("Generated wallet address: {}", address.encode(&self.network));

        Ok(Wallet {
            spending_key,
            viewing_key,
            address,
            network: self.network.clone(),
        })
    }

    /// Generate a wallet from a specific seed (for deterministic wallets)
    pub fn generate_wallet_from_seed(&self, seed: &[u8]) -> Result<Wallet> {
        let spending_key = self.generate_spending_key_from_seed(seed)?;
        let viewing_key = self.derive_viewing_key(&spending_key)?;
        let address = self.get_address(&viewing_key)?;

        tracing::info!("Generated deterministic wallet address: {}", address.encode(&self.network));

        Ok(Wallet {
            spending_key,
            viewing_key,
            address,
            network: self.network.clone(),
        })
    }

    /// Generate a wallet from a BIP39 mnemonic phrase
    pub fn generate_wallet_from_mnemonic(&self, mnemonic_str: &str) -> Result<Wallet> {
        // Parse the mnemonic
        let mnemonic = Mnemonic::parse_in(Language::English, mnemonic_str)
            .context("Failed to parse BIP39 mnemonic")?;

        // Convert mnemonic to seed (64 bytes)
        let seed_bytes = mnemonic.to_seed("");

        // Take first 32 bytes for Zcash seed
        let mut seed = [0u8; 32];
        seed.copy_from_slice(&seed_bytes[..32]);

        let spending_key = UnifiedSpendingKey::from_seed(
            &self.network,
            &seed,
            AccountId::ZERO,
        ).context("Failed to derive spending key from mnemonic")?;

        let viewing_key = self.derive_viewing_key(&spending_key)?;
        let address = self.get_address(&viewing_key)?;

        tracing::info!("Generated wallet from BIP39 mnemonic: {}", address.encode(&self.network));

        Ok(Wallet {
            spending_key,
            viewing_key,
            address,
            network: self.network.clone(),
        })
    }
}

/// Complete wallet with spending key, viewing key, and address
#[derive(Debug)]
pub struct Wallet {
    pub spending_key: UnifiedSpendingKey,
    pub viewing_key: UnifiedFullViewingKey,
    pub address: UnifiedAddress,
    pub network: Network,
}

impl Wallet {
    /// Get the address as a string
    pub fn address_string(&self) -> String {
        self.address.encode(&self.network)
    }

    /// Check if this wallet has Sapling capability
    pub fn has_sapling(&self) -> bool {
        self.address.sapling().is_some()
    }

    /// Get the unified address for use in transactions
    pub fn get_unified_address(&self) -> &UnifiedAddress {
        &self.address
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_testnet_wallet() {
        let keygen = WalletKeygen::new(Network::TestNetwork);
        let wallet = keygen.generate_wallet().unwrap();

        println!("Generated wallet:");
        println!("  Address: {}", wallet.address_string());
        println!("  Has Sapling: {}", wallet.has_sapling());

        assert!(wallet.address_string().starts_with("utest1"));
    }

    #[test]
    fn test_sapling_address_derivation() {
        let keygen = WalletKeygen::new(Network::TestNetwork);
        let wallet = keygen.generate_wallet().unwrap();

        assert!(wallet.has_sapling(), "Wallet should have Sapling address");
    }
}
