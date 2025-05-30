// SPDX-License-Identifier: MIT
pragma solidity >=0.8.21;

import "../codegen/index.sol";
import "../codegen/common.sol";

import {System} from "@latticexyz/world/src/System.sol";

import {MinHeapLib} from "../utils/PriorityQueue96x160Lib.sol";
import {ConfigLib} from "../utils/ConfigLib.sol";
import {timeWad} from "../utils/WadTimeLib.sol";
import {EntityLib} from "../utils/EntityLib.sol";
import {LineLib} from "../utils/LineLib.sol";

// This system is set to openAccess = false in mud.config.ts.
// Thus, only authorized users can call any of its functions.
contract AdminSystem is System {
    function addLines(uint32 numLinesToAdd) public {
        (uint32 currentNumLines, uint128 lineWidth, uint96 wallMass) = (
            GameState.getNumLines(),
            GameConfig.getLineWidth(),
            GameConfig.getWallMass()
        );

        uint32 targetNumLines = currentNumLines + numLinesToAdd; // New # of lines.

        for (uint32 newLine = currentNumLines; newLine < targetNumLines; newLine++) {
            // Determine the leftmost and rightmost entity IDs for the new line.
            (uint160 leftmostEntityId, uint160 rightmostEntityId) = (
                EntityLib.leftmostEntityId(newLine),
                EntityLib.rightmostEntityId(newLine)
            );

            // Spawn the leftmost boundary entity.
            Entity.setEtype(leftmostEntityId, EntityType.ALIVE);
            Entity.setLineId(leftmostEntityId, newLine);
            Entity.setLastX(leftmostEntityId, 0);
            Entity.setLastTouchedTime(leftmostEntityId, timeWad());
            Entity.setLeftNeighbor(leftmostEntityId, 0);
            Entity.setRightNeighbor(leftmostEntityId, rightmostEntityId);

            // Spawn the rightmost boundary entity.
            Entity.setEtype(rightmostEntityId, EntityType.ALIVE);
            Entity.setLineId(rightmostEntityId, newLine);
            Entity.setLastX(rightmostEntityId, lineWidth);
            Entity.setLastTouchedTime(rightmostEntityId, timeWad());
            Entity.setLeftNeighbor(rightmostEntityId, leftmostEntityId);
            Entity.setRightNeighbor(rightmostEntityId, 0);

            MinHeapLib.MemHeap memory newLineCollisionQueue; // Create a new collision queue for the new line.

            // Spawn a food entity in the middle of the line.
            uint160 foodId = EntityLib.toEntityId(uint256(keccak256(abi.encode(newLine, 1))));
            Entity.setEtype(foodId, EntityType.FOOD);
            Entity.setMass(foodId, uint128(GameConfig.getMinFoodMass()));
            LineLib.spawnEntityIntoLine(newLine, foodId, rightmostEntityId, timeWad(), newLineCollisionQueue);

            // Each line gets 2 wall entities.
            for (uint256 i = 0; i < 2; i++) {
                uint160 wallId = EntityLib.toEntityId(uint256(keccak256(abi.encode(newLine, i + 2))));
                Entity.setEtype(wallId, EntityType.WALL);
                Entity.setMass(wallId, wallMass);
                int128 WALL_VEL_MULTIPLIER = int128(int256(uint256(0.025e18 + (wallId % 0.125e18)))); // Random in a range.
                Entity.setVelMultiplier(wallId, i % 2 == 0 ? WALL_VEL_MULTIPLIER : -WALL_VEL_MULTIPLIER);
                LineLib.spawnEntityIntoLine(
                    newLine,
                    wallId,
                    i % 2 == 0 ? foodId : rightmostEntityId,
                    timeWad(),
                    newLineCollisionQueue
                );
            }

            Line.setCollisionQueue(newLine, newLineCollisionQueue.data);
        }

        GameState.setNumLines(targetNumLines);
    }

    function ban(address player, string memory username) public {
        // This field is overloaded to both manage access and to prevent spamming, here
        // we are using it for the former, setting it to a magic number which prevents access.
        Player.setLastJumpBlockNumber(EntityLib.toEntityId(player), type(uint32).max);

        // Set username hash to taken to prevent registering from succeeding.
        UsernameHash.set(keccak256(abi.encodePacked(username)), true);
    }
}
