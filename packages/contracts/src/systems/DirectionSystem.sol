// SPDX-License-Identifier: MIT
pragma solidity >=0.8.21;

import "../codegen/index.sol";
import "../codegen/common.sol";

import {System} from "@latticexyz/world/src/System.sol";

import {LineLib} from "../utils/LineLib.sol";
import {timeWad} from "../utils/WadTimeLib.sol";
import {EntityLib} from "../utils/EntityLib.sol";
import {MinHeapLib} from "../utils/PriorityQueue96x160Lib.sol";

import {FixedPointMathLib} from "solady/utils/FixedPointMathLib.sol";

contract DirectionSystem is System {
    using FixedPointMathLib for *;

    function setDirection(bool velRight) external {
        uint160 caller = EntityLib.toEntityId(_msgSender());

        uint32 line = Entity.getLineId(caller);

        // Done before checking if player is alive, because they could die in a collision.
        MinHeapLib.MemHeap memory currentCollisionQueue = LineLib.getCollisionQueue(line);
        LineLib.processCollisions(line, currentCollisionQueue);

        require(Entity.getEtype(caller) == EntityType.ALIVE, "CALLER_IS_NOT_ALIVE");

        // Touch the caller to ensure we don't change its trajectory retroactively.
        // We could check Location.getLastTouchedTime(caller) != timeWad() first to
        // avoid touching the caller if it's already been touched, but in practice
        // it's very unlikely the caller had a collision at the exact calling time.
        Entity.setLastX(caller, EntityLib.computeX(caller, timeWad()));
        Entity.setLastTouchedTime(caller, timeWad());

        Entity.setVelMultiplier(
            caller,
            int128(velRight ? int256(Entity.getVelMultiplier(caller).abs()) : -int256(Entity.getVelMultiplier(caller).abs()))
        );

        // Schedule the entity's collision with its left neighbor.
        LineLib.scheduleCollision(Entity.getLeftNeighbor(caller), caller, currentCollisionQueue);
        // Schedule the entity's right neighbor's collision with the entity.
        LineLib.scheduleCollision(caller, Entity.getRightNeighbor(caller), currentCollisionQueue);

        Line.setCollisionQueue(line, currentCollisionQueue.data);
    }
}
