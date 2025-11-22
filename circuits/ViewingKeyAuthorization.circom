pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/smt/smtverifier.circom";

template ViewingKeyAuthorization(nLevels) {
    signal input evidenceCID;
    signal input requesterCommitment;

    signal input viewingKeyPrivate;
    signal input viewingKeyPublic;
    signal input merkleRoot;
    signal input merkleSiblings[nLevels];
    signal input merklePathIndices[nLevels];

    signal output authorized;

    component keyHasher = Poseidon(1);
    keyHasher.inputs[0] <== viewingKeyPrivate;
    keyHasher.out === viewingKeyPublic;

    component smtVerifier = SMTVerifier(nLevels);
    smtVerifier.enabled <== 1;
    smtVerifier.root <== merkleRoot;
    smtVerifier.key <== viewingKeyPublic;
    smtVerifier.value <== 1;
    for (var i = 0; i < nLevels; i++) {
        smtVerifier.siblings[i] <== merkleSiblings[i];
    }
    smtVerifier.oldKey <== 0;
    smtVerifier.oldValue <== 0;
    smtVerifier.isOld0 <== 0;
    smtVerifier.fnc <== 0;

    component commitmentHasher = Poseidon(3);
    commitmentHasher.inputs[0] <== evidenceCID;
    commitmentHasher.inputs[1] <== viewingKeyPublic;
    commitmentHasher.inputs[2] <== merkleRoot;
    commitmentHasher.out === requesterCommitment;

    authorized <== smtVerifier.enabled;
}

component main {public [evidenceCID, requesterCommitment]} = ViewingKeyAuthorization(20);
