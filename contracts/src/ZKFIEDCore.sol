// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IVerifier.sol";

contract ZKFIEDCore {
    enum Board {
        GOVERNMENT,
        HEALTHCARE,
        CORPORATE,
        MEDIA,
        ENVIRONMENT,
        LEGAL,
        EDUCATION,
        CIVIL_SOCIETY,
        CITIZEN
    }

    struct Evidence {
        bytes32 commitment;
        uint256 timestamp;
        address submitter;
        bytes32 ipfsCID;
        bool requiresViewingKey;
        Board board;
        bool verified;
    }

    IVerifier public immutable shieldedMemoVerifier;
    IVerifier public immutable viewingKeyVerifier;

    mapping(bytes32 => Evidence) public evidenceRegistry;
    mapping(Board => bytes32[]) public evidenceByBoard;

    uint256 public evidenceCount;

    event EvidenceSubmitted(
        bytes32 indexed evidenceId,
        bytes32 commitment,
        bytes32 ipfsCID,
        Board board,
        uint256 timestamp
    );

    event EvidenceVerified(bytes32 indexed evidenceId);

    event ViewingKeyAccessGranted(
        bytes32 indexed evidenceId,
        address indexed accessor,
        uint256 timestamp
    );

    constructor(
        address _shieldedMemoVerifier,
        address _viewingKeyVerifier
    ) {
        shieldedMemoVerifier = IVerifier(_shieldedMemoVerifier);
        viewingKeyVerifier = IVerifier(_viewingKeyVerifier);
    }

    function submitEvidence(
        bytes32 commitment,
        bytes32 ipfsCID,
        Board board,
        bool requiresViewingKey,
        uint[2] calldata pA,
        uint[2][2] calldata pB,
        uint[2] calldata pC,
        uint[] calldata pubSignals
    ) external returns (bytes32 evidenceId) {
        require(
            shieldedMemoVerifier.verifyProof(pA, pB, pC, pubSignals),
            "Invalid ZK proof"
        );

        require(
            pubSignals[0] == uint256(commitment),
            "Commitment mismatch"
        );
        require(
            pubSignals[1] == uint256(board),
            "Board mismatch"
        );

        evidenceId = keccak256(
            abi.encodePacked(
                commitment,
                block.timestamp,
                msg.sender,
                evidenceCount++
            )
        );

        evidenceRegistry[evidenceId] = Evidence({
            commitment: commitment,
            timestamp: block.timestamp,
            submitter: msg.sender,
            ipfsCID: ipfsCID,
            requiresViewingKey: requiresViewingKey,
            board: board,
            verified: true
        });

        evidenceByBoard[board].push(evidenceId);

        emit EvidenceSubmitted(
            evidenceId,
            commitment,
            ipfsCID,
            board,
            block.timestamp
        );

        emit EvidenceVerified(evidenceId);
    }

    function verifyViewingKeyAccess(
        bytes32 evidenceId,
        uint[2] calldata pA,
        uint[2][2] calldata pB,
        uint[2] calldata pC,
        uint[] calldata pubSignals
    ) external returns (bool) {
        Evidence storage evidence = evidenceRegistry[evidenceId];
        require(evidence.timestamp > 0, "Evidence does not exist");

        bool valid = viewingKeyVerifier.verifyProof(pA, pB, pC, pubSignals);

        if (valid) {
            emit ViewingKeyAccessGranted(
                evidenceId,
                msg.sender,
                block.timestamp
            );
        }

        return valid;
    }

    function getEvidence(bytes32 evidenceId)
        external
        view
        returns (Evidence memory)
    {
        return evidenceRegistry[evidenceId];
    }

    function getEvidenceByBoard(Board board)
        external
        view
        returns (bytes32[] memory)
    {
        return evidenceByBoard[board];
    }

    function getEvidenceCount() external view returns (uint256) {
        return evidenceCount;
    }
}
