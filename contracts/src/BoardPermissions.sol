// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IVerifier.sol";

contract BoardPermissions {
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

    struct Credential {
        bytes32 credentialHash;
        uint256 boardsMask;
        uint256 expiry;
        bool active;
    }

    IVerifier public immutable credentialVerifier;

    mapping(bytes32 => Credential) public credentials;
    mapping(address => bytes32[]) public credentialsByIssuer;

    event CredentialRegistered(
        bytes32 indexed credentialHash,
        uint256 boardsMask,
        uint256 expiry,
        address indexed issuer
    );

    event CredentialRevoked(bytes32 indexed credentialHash);

    constructor(address _credentialVerifier) {
        credentialVerifier = IVerifier(_credentialVerifier);
    }

    function registerCredential(
        bytes32 credentialHash,
        Board[] memory grantedBoards,
        uint256 expiry
    ) external {
        require(expiry > block.timestamp, "Expiry in the past");

        uint256 boardsMask = 0;
        for (uint i = 0; i < grantedBoards.length; i++) {
            boardsMask |= (1 << uint256(grantedBoards[i]));
        }

        credentials[credentialHash] = Credential({
            credentialHash: credentialHash,
            boardsMask: boardsMask,
            expiry: expiry,
            active: true
        });

        credentialsByIssuer[msg.sender].push(credentialHash);

        emit CredentialRegistered(
            credentialHash,
            boardsMask,
            expiry,
            msg.sender
        );
    }

    function verifyBoardAccess(
        Board board,
        bytes32 credentialHash,
        uint[2] calldata pA,
        uint[2][2] calldata pB,
        uint[2] calldata pC,
        uint[] calldata pubSignals
    ) external view returns (bool) {
        Credential storage credential = credentials[credentialHash];

        require(credential.active, "Credential not active");
        require(block.timestamp <= credential.expiry, "Credential expired");

        bool hasPermission = (credential.boardsMask & (1 << uint256(board))) != 0;
        require(hasPermission, "Board not permitted");

        return credentialVerifier.verifyProof(pA, pB, pC, pubSignals);
    }

    function revokeCredential(bytes32 credentialHash) external {
        Credential storage credential = credentials[credentialHash];
        require(credential.active, "Credential not active");

        bool isOwner = false;
        bytes32[] storage issuerCreds = credentialsByIssuer[msg.sender];
        for (uint i = 0; i < issuerCreds.length; i++) {
            if (issuerCreds[i] == credentialHash) {
                isOwner = true;
                break;
            }
        }
        require(isOwner, "Not credential issuer");

        credential.active = false;

        emit CredentialRevoked(credentialHash);
    }

    function getCredential(bytes32 credentialHash)
        external
        view
        returns (Credential memory)
    {
        return credentials[credentialHash];
    }

    function hasBoard(bytes32 credentialHash, Board board)
        external
        view
        returns (bool)
    {
        Credential storage credential = credentials[credentialHash];
        return (credential.boardsMask & (1 << uint256(board))) != 0;
    }
}
