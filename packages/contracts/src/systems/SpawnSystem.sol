// SPDX-License-Identifier: MIT
pragma solidity >=0.8.21;

import "../codegen/index.sol";
import "../codegen/common.sol";

import {System} from "@latticexyz/world/src/System.sol";

import {LineLib} from "../utils/LineLib.sol";
import {timeWad} from "../utils/WadTimeLib.sol";
import {EntityLib} from "../utils/EntityLib.sol";
import {MinHeapLib} from "../utils/PriorityQueue96x160Lib.sol";

contract SpawnSystem is System {
    function spawn(uint32 line, uint160 rightNeighbor, bool velRight) public returns (uint160 entityId) {
        // Ensure the caller has been authorized to access the game. This field is overloaded to both manage
        // access and to prevent spam. Here we use it for access, ensuring the player is authorized and not banned.
        uint32 lastJumpBlockNumber = Player.getLastJumpBlockNumber(entityId = EntityLib.toEntityId(_msgSender()));
        require(lastJumpBlockNumber > 0 && lastJumpBlockNumber != type(uint32).max, "NO_ACCESS");

        require(line < GameState.getNumLines(), "LINE_OUT_OF_BOUNDS");

        MinHeapLib.MemHeap memory collisionQueue;

        // If the player is currently alive, they might have just died
        // in a collision that hasn't been processed yet, so we'll try
        // processing collisions before checking if they're alive/dead.
        if (Entity.getEtype(entityId) == EntityType.ALIVE) {
            uint32 currentLine = Entity.getLineId(entityId);
            LineLib.processCollisions(currentLine, collisionQueue = LineLib.getCollisionQueue(currentLine));
            Line.setCollisionQueue(currentLine, collisionQueue.data); // Will waste some gas if the require fails.
        }

        require(Entity.getEtype(entityId) == EntityType.DEAD, "CALLER_IS_ALIVE");

        LineLib.processCollisions(line, collisionQueue = LineLib.getCollisionQueue(line));

        // Set fundamental player state.
        Entity.setEtype(entityId, EntityType.ALIVE);
        Entity.setMass(entityId, GameConfig.getPlayerStartingMass());
        Entity.setVelMultiplier(entityId, velRight ? int128(1e18) : -1e18);

        LineLib.spawnEntityIntoLine(line, entityId, rightNeighbor, timeWad(), collisionQueue);

        Line.setCollisionQueue(line, collisionQueue.data);
    }
}
