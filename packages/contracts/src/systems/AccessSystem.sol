// SPDX-License-Identifier: MIT
pragma solidity >=0.8.21;

import "../codegen/index.sol";

import {System} from "@latticexyz/world/src/System.sol";

import {ECDSA} from "solady/utils/ECDSA.sol";

import {EntityLib} from "../utils/EntityLib.sol";

contract AccessSystem is System {
    function access(bytes memory accessSignature, string memory username) public {
        uint160 caller = EntityLib.toEntityId(_msgSender());

        // We overload the purpose of this field to both manage access and to prevent spam.
        // Here we are using it only for the former, ensuring addresses are not relinked. Access
        // can be revoked by setting the field to type(uint32).max, which will also fail this check.
        require(Player.getLastJumpBlockNumber(caller) == 0, "ALREADY_AUTHORIZED");

        bytes32 usernameHash = keccak256(abi.encodePacked(username));

        // Ensure the username is not already registered to another address.
        require(!UsernameHash.get(usernameHash), "USERNAME_TAKEN");

        bytes32 messageHash = keccak256(abi.encodePacked(_msgSender(), username));

        // Will revert if the signature is invalid.
        address signer = ECDSA.recover(messageHash, accessSignature);

        // Ensure the signer is the access signer.
        require(signer == GameConfig.getAccessSigner(), "INVALID_ACCESS_SIGNATURE");

        // Set last jump block number to non-zero to prevent accessing twice.
        Player.setLastJumpBlockNumber(caller, 1);

        // Set username for offchain access.
        UsernameOffchain.set(caller, username);

        // Set username hash to prevent registering multiple addresses under the same username.
        UsernameHash.set(usernameHash, true);
    }
}
