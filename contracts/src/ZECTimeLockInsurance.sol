// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ZECTimeLockInsurance {
    struct Policy {
        address whistleblower;
        uint256 amount;
        uint256 lockDuration;
        uint256 lastHeartbeat;
        uint256 createdAt;
        address[] beneficiaries;
        bytes32 evidenceCommitment;
        bool active;
        bool claimed;
    }

    mapping(bytes32 => Policy) public policies;
    mapping(address => bytes32[]) public policiesByWhistleblower;

    uint256 public policyCount;

    event PolicyCreated(
        bytes32 indexed policyId,
        address indexed whistleblower,
        uint256 amount,
        uint256 lockDuration,
        uint256 timestamp
    );

    event Heartbeat(
        bytes32 indexed policyId,
        uint256 timestamp
    );

    event DeadManSwitchTriggered(
        bytes32 indexed policyId,
        uint256 timestamp,
        uint256 amountDistributed
    );

    event PolicyClaimed(
        bytes32 indexed policyId,
        address indexed whistleblower,
        uint256 amount
    );

    function createPolicy(
        uint256 lockDuration,
        address[] memory beneficiaries,
        bytes32 evidenceHash
    ) external payable returns (bytes32 policyId) {
        require(msg.value > 0, "Must stake funds");
        require(lockDuration >= 1 days, "Lock duration too short");
        require(beneficiaries.length > 0, "Must have beneficiaries");

        policyId = keccak256(
            abi.encodePacked(
                msg.sender,
                block.timestamp,
                policyCount++
            )
        );

        policies[policyId] = Policy({
            whistleblower: msg.sender,
            amount: msg.value,
            lockDuration: lockDuration,
            lastHeartbeat: block.timestamp,
            createdAt: block.timestamp,
            beneficiaries: beneficiaries,
            evidenceCommitment: evidenceHash,
            active: true,
            claimed: false
        });

        policiesByWhistleblower[msg.sender].push(policyId);

        emit PolicyCreated(
            policyId,
            msg.sender,
            msg.value,
            lockDuration,
            block.timestamp
        );
    }

    function heartbeat(bytes32 policyId) external {
        Policy storage policy = policies[policyId];

        require(policy.active, "Policy not active");
        require(msg.sender == policy.whistleblower, "Not policy owner");
        require(!policy.claimed, "Policy already claimed");

        policy.lastHeartbeat = block.timestamp;

        emit Heartbeat(policyId, block.timestamp);
    }

    function triggerDeadManSwitch(bytes32 policyId) external {
        Policy storage policy = policies[policyId];

        require(policy.active, "Policy not active");
        require(!policy.claimed, "Policy already claimed");
        require(
            block.timestamp >= policy.lastHeartbeat + policy.lockDuration,
            "Heartbeat still valid"
        );

        policy.active = false;
        policy.claimed = true;

        uint256 amountPerBeneficiary = policy.amount / policy.beneficiaries.length;

        for (uint i = 0; i < policy.beneficiaries.length; i++) {
            (bool success, ) = policy.beneficiaries[i].call{value: amountPerBeneficiary}("");
            require(success, "Transfer failed");
        }

        emit DeadManSwitchTriggered(
            policyId,
            block.timestamp,
            policy.amount
        );
    }

    function claimPolicy(bytes32 policyId) external {
        Policy storage policy = policies[policyId];

        require(policy.active, "Policy not active");
        require(msg.sender == policy.whistleblower, "Not policy owner");
        require(!policy.claimed, "Policy already claimed");

        policy.active = false;
        policy.claimed = true;

        (bool success, ) = policy.whistleblower.call{value: policy.amount}("");
        require(success, "Transfer failed");

        emit PolicyClaimed(policyId, msg.sender, policy.amount);
    }

    function getPolicy(bytes32 policyId) external view returns (Policy memory) {
        return policies[policyId];
    }

    function getPoliciesByWhistleblower(address whistleblower)
        external
        view
        returns (bytes32[] memory)
    {
        return policiesByWhistleblower[whistleblower];
    }

    function isHeartbeatValid(bytes32 policyId) external view returns (bool) {
        Policy storage policy = policies[policyId];
        return block.timestamp < policy.lastHeartbeat + policy.lockDuration;
    }
}
