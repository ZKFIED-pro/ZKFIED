use crate::frost_impl::{FrostError, ParticipantId};
use frost_rerandomized::frost_core::Ciphersuite;
use std::collections::BTreeMap;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DkgCeremony<C: Ciphersuite> {
    pub max_signers: u16,
    pub min_signers: u16,
    pub round1_packages: BTreeMap<ParticipantId, frost_rerandomized::frost_core::keys::dkg::round1::Package<C>>,
    pub round2_packages: BTreeMap<ParticipantId, BTreeMap<ParticipantId, frost_rerandomized::frost_core::keys::dkg::round2::Package<C>>>,
    pub status: DkgStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum DkgStatus {
    Init,
    Round1Collecting,
    Round1Complete,
    Round2Collecting,
    Round2Complete,
    Complete,
}

impl<C: Ciphersuite> DkgCeremony<C> {
    pub fn new(max_signers: u16, min_signers: u16) -> Self {
        tracing::info!("Initializing DKG ceremony: {}-of-{}", min_signers, max_signers);

        Self {
            max_signers,
            min_signers,
            round1_packages: BTreeMap::new(),
            round2_packages: BTreeMap::new(),
            status: DkgStatus::Init,
        }
    }

    pub fn submit_round1_package(
        &mut self,
        participant_id: ParticipantId,
        package: frost_rerandomized::frost_core::keys::dkg::round1::Package<C>,
    ) -> Result<(), FrostError> {
        if self.status != DkgStatus::Init && self.status != DkgStatus::Round1Collecting {
            return Err(FrostError::FrostCore("Invalid ceremony state for Round 1".to_string()));
        }

        self.status = DkgStatus::Round1Collecting;
        self.round1_packages.insert(participant_id, package);

        tracing::info!("Round 1: Received package from participant {} ({}/{})",
            participant_id, self.round1_packages.len(), self.max_signers);

        if self.round1_packages.len() == self.max_signers as usize {
            self.status = DkgStatus::Round1Complete;
            tracing::info!("Round 1 COMPLETE: All {} participants submitted packages", self.max_signers);
        }

        Ok(())
    }

    pub fn submit_round2_packages(
        &mut self,
        participant_id: ParticipantId,
        packages: BTreeMap<ParticipantId, frost_rerandomized::frost_core::keys::dkg::round2::Package<C>>,
    ) -> Result<(), FrostError> {
        if self.status != DkgStatus::Round1Complete && self.status != DkgStatus::Round2Collecting {
            return Err(FrostError::FrostCore("Invalid ceremony state for Round 2".to_string()));
        }

        self.status = DkgStatus::Round2Collecting;
        self.round2_packages.insert(participant_id, packages);

        tracing::info!("Round 2: Received packages from participant {} ({}/{})",
            participant_id, self.round2_packages.len(), self.max_signers);

        if self.round2_packages.len() == self.max_signers as usize {
            self.status = DkgStatus::Round2Complete;
            tracing::info!("Round 2 COMPLETE: All {} participants submitted packages", self.max_signers);
        }

        Ok(())
    }

    pub fn get_round1_packages(&self) -> Result<&BTreeMap<ParticipantId, frost_rerandomized::frost_core::keys::dkg::round1::Package<C>>, FrostError> {
        if self.status != DkgStatus::Round1Complete && self.status != DkgStatus::Round2Collecting && self.status != DkgStatus::Round2Complete {
            return Err(FrostError::FrostCore("Round 1 not complete".to_string()));
        }

        Ok(&self.round1_packages)
    }

    pub fn get_round2_packages_for_participant(
        &self,
        participant_id: ParticipantId,
    ) -> Result<BTreeMap<ParticipantId, frost_rerandomized::frost_core::keys::dkg::round2::Package<C>>, FrostError> {
        if self.status != DkgStatus::Round2Complete {
            return Err(FrostError::FrostCore("Round 2 not complete".to_string()));
        }

        let mut packages_for_participant = BTreeMap::new();

        for (sender_id, packages) in &self.round2_packages {
            if let Some(package) = packages.get(&participant_id) {
                packages_for_participant.insert(*sender_id, package.clone());
            }
        }

        tracing::info!("Retrieved {} Round 2 packages for participant {}",
            packages_for_participant.len(), participant_id);

        Ok(packages_for_participant)
    }

    pub fn is_complete(&self) -> bool {
        self.status == DkgStatus::Round2Complete
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use frost_ristretto255::Ristretto255Sha512 as TestCiphersuite;
    use crate::frost_impl;

    #[test]
    fn test_5_party_3_of_5_dkg_ceremony() {
        let max_signers = 5;
        let min_signers = 3;
        let mut ceremony = DkgCeremony::<TestCiphersuite>::new(max_signers, min_signers);

        let mut round1_secrets = BTreeMap::new();

        for participant_id in 1..=5 {
            let (secret_package, public_package) = frost_impl::dkg_part1::<TestCiphersuite>(
                participant_id,
                max_signers,
                min_signers,
            ).unwrap();

            round1_secrets.insert(participant_id, secret_package);
            ceremony.submit_round1_package(participant_id, public_package).unwrap();
        }

        assert!(ceremony.is_complete() == false);
        assert_eq!(ceremony.status, DkgStatus::Round1Complete);

        let all_round1_packages = ceremony.get_round1_packages().unwrap().clone();

        let mut round2_secrets = BTreeMap::new();

        for participant_id in 1..=5 {
            let secret_package = round1_secrets.get(&participant_id).unwrap().clone();

            // Each participant gets packages from OTHER participants only
            let mut round1_packages_for_participant = BTreeMap::new();
            for (&id, package) in &all_round1_packages {
                if id != participant_id {
                    round1_packages_for_participant.insert(id, package.clone());
                }
            }

            let (round2_secret, round2_packages) = frost_impl::dkg_part2::<TestCiphersuite>(
                secret_package,
                &round1_packages_for_participant,
            ).unwrap();

            round2_secrets.insert(participant_id, round2_secret);
            ceremony.submit_round2_packages(participant_id, round2_packages).unwrap();
        }

        assert!(ceremony.is_complete());
        assert_eq!(ceremony.status, DkgStatus::Round2Complete);

        for participant_id in 1..=5 {
            let round2_packages_for_me = ceremony.get_round2_packages_for_participant(participant_id).unwrap();

            // Each participant needs filtered round1 packages (excluding their own)
            let mut round1_packages_for_participant = BTreeMap::new();
            for (&id, package) in &all_round1_packages {
                if id != participant_id {
                    round1_packages_for_participant.insert(id, package.clone());
                }
            }

            let (_key_package, public_key_package) = frost_impl::dkg_part3::<TestCiphersuite>(
                round2_secrets.get(&participant_id).unwrap(),
                &round1_packages_for_participant,
                &round2_packages_for_me,
            ).unwrap();

            println!("Participant {} generated key package successfully", participant_id);
            println!("Group public key: {:?}", public_key_package.verifying_key());
        }

        println!("5-of-5 DKG ceremony completed successfully!");
    }
}
