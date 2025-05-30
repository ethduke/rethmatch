// SPDX-License-Identifier: MIT
pragma solidity >=0.8.21;

import "../codegen/index.sol";
import "../codegen/common.sol";

import {System} from "@latticexyz/world/src/System.sol";

import {LineLib} from "../utils/LineLib.sol";
import {timeWad} from "../utils/WadTimeLib.sol";
import {EntityLib} from "../utils/EntityLib.sol";
import {ConfigLib} from "../utils/ConfigLib.sol";
import {MinHeapLib} from "../utils/PriorityQueue96x160Lib.sol";

import {FixedPointMathLib} from "solady/utils/FixedPointMathLib.sol";

contract JumpSystem is System {
    using FixedPointMathLib for *;

    function jumpToLine(bool up) external returns (uint32 newLine) {
        uint160 caller = EntityLib.toEntityId(_msgSender());

        // This field is overloaded to both manage access and to prevent spamming. Here we will use
        // its value for both purposes. First to check access, then to prevent rapid consecutive jumps.
        uint32 lastJumpBlockNumber = Player.getLastJumpBlockNumber(caller);

        // We only want players to be able to jump once per block, to avoid people being sniped.
        // Serves the dual purpose of preventing spam and ensuring access hasn't been revoked, which
        // is done by setting the field to type(uint32).max, which is greater than any block number.
        require(block.number > lastJumpBlockNumber, "JUMPING_TOO_QUICKLY");

        unchecked {
            // If you're at the topmost line, going up will wrap around to the bottom.
            // If you're at the bottommost line, going down will wrap around to the top.
            // Otherwise, going up will go up one line, and going down will go down one line.
            uint32 currentLine = Entity.getLineId(caller);
            uint32 numLines = GameState.getNumLines();
            newLine = up
                ? (currentLine == 0 ? numLines - 1 : currentLine - 1)
                : (currentLine == numLines - 1 ? 0 : currentLine + 1);

            // 1) Remove the entity from the old line:

            // Done before checking if player is alive, because they could die in a collision.
            MinHeapLib.MemHeap memory collisionQueue = LineLib.getCollisionQueue(currentLine);
            LineLib.processCollisions(currentLine, collisionQueue);

            require(Entity.getEtype(caller) == EntityType.ALIVE, "CALLER_IS_NOT_ALIVE");

            // Touch the caller to ensure we don't change its trajectory retroactively.
            // We could check Location.getLastTouchedTime(caller) != timeWad() first to
            // avoid touching the caller if it's already been touched, but in practice
            // it's very unlikely the caller had a collision at the exact calling time.
            Entity.setLastX(caller, EntityLib.computeX(caller, timeWad()));
            Entity.setLastTouchedTime(caller, timeWad());

            removeEntityFromLine(caller, collisionQueue);

            // 1.5) Decay the entity's mass according to the line jump decay factor:

            // Mass decays by 1 - lineJumpDecayFactor whenever an entity jumps lines.
            uint128 newMass = ConfigLib.computeMassAfterJumpingLine(Entity.getMass(caller));
            // We don't want to allow players to get too small and speedy.
            require(newMass >= GameConfig.getMinFoodMass(), "NOT_ENOUGH_MASS");
            // Must be done before inserting the entity into the new line, as the mass
            // is used to calculate overlap & schedule its collisions with its neighbors.
            Entity.setMass(caller, newMass);

            Line.setCollisionQueue(currentLine, collisionQueue.data);

            // 2) Insert the entity into the new line:

            LineLib.processCollisions(newLine, collisionQueue = LineLib.getCollisionQueue(newLine));
            insertExistingEntityIntoLine(newLine, caller, timeWad(), collisionQueue);
            Line.setCollisionQueue(newLine, collisionQueue.data);
        }

        // This field is overloaded to both manage access and to prevent
        // spam. Here we are using it to prevent a 2nd jump in this block.
        Player.setLastJumpBlockNumber(caller, uint32(block.number));
    }

    // Caller must ensure all collisions up to timeWad() are processed before
    // calling, otherwise collisions will effectively be retroactively modified.
    function removeEntityFromLine(uint160 entity, MinHeapLib.MemHeap memory collisionQueue) internal {
        // Get the entity's left and right neighbors.
        (uint160 leftNeighbor, uint160 rightNeighbor) = (Entity.getLeftNeighbor(entity), Entity.getRightNeighbor(entity));

        // Update the neighbors' references to skip the entity.
        Entity.setRightNeighbor(leftNeighbor, rightNeighbor);
        Entity.setLeftNeighbor(rightNeighbor, leftNeighbor);

        // Schedule entity's right neighbor's collision with its new left neighbor.
        LineLib.scheduleCollision(leftNeighbor, rightNeighbor, collisionQueue);
    }

    function insertExistingEntityIntoLine(
        uint32 line,
        uint160 entity,
        uint96 wadTime, // Caller must ensure all collisions up to wadTime are processed before calling.
        MinHeapLib.MemHeap memory collisionQueue
    ) internal {
        (uint128 entityLeftEdge, uint128 entityMass) = (EntityLib.computeX(entity, wadTime), Entity.getMass(entity));
        uint128 entityDiameter = ConfigLib.mapMassToDiameter(entityMass); // Could recompute every time, but better to cache.

        // Start the right neighbor search at the right neighbor of the leftmost entity.
        uint160 rightNeighbor = Entity.getRightNeighbor(EntityLib.leftmostEntityId(line));
        uint128 rightNeighborLeftEdge = EntityLib.computeX(rightNeighbor, wadTime);

        // Search for the closest right neighbor without overlap.
        while (entityLeftEdge + entityDiameter >= rightNeighborLeftEdge) {
            require(rightNeighbor != EntityLib.rightmostEntityId(line), "NO_VALID_RIGHT_NEIGHBOR"); // Just in case.
            rightNeighborLeftEdge = EntityLib.computeX(rightNeighbor = Entity.getRightNeighbor(rightNeighbor), wadTime);
        }

        // Start the left neighbor search at the left neighbor of the selected right neighbor.
        uint160 leftNeighbor = Entity.getLeftNeighbor(rightNeighbor);
        uint128 leftNeighborRightEdge = EntityLib.computeX(leftNeighbor, wadTime) + EntityLib.computeDiameter(leftNeighbor);

        // Search for a left neighbor without overlap, consuming all with overlap.
        while (leftNeighborRightEdge >= entityLeftEdge) {
            require(leftNeighbor != EntityLib.leftmostEntityId(line), "NO_VALID_LEFT_NEIGHBOR"); // Just in case.

            // Determine whether the entity can consume the overlapping left neighbor candidate.
            (uint128 leftNeighborMass, EntityType leftNeighborType, bool isLeftNeighborPoweredUp) = (
                Entity.getMass(leftNeighbor),
                Entity.getEtype(leftNeighbor),
                EntityLib.isPoweredUp(leftNeighbor, wadTime)
            );
            require(
                // prettier-ignore
                // 1. Non-{food, power-pellet} entity wins over food/power-pellet
                // 2. Powered-up entity wins (if both are powered up, neither wins)
                // 3. Entity with greater mass wins
                leftNeighborType != EntityType.WALL
                && (leftNeighborType == EntityType.FOOD
                || leftNeighborType == EntityType.POWER_PELLET
                || (EntityLib.isPoweredUp(entity, wadTime) && !isLeftNeighborPoweredUp)
                || (entityMass > leftNeighborMass && !isLeftNeighborPoweredUp)),
                "WOULD_OVERLAP_WITH_UNCONSUMABLE_ENTITY" // Revert if the candidate is unconsumable.
            );

            // To discourage players from rapidly spawning bots to feed themselves, we cap the mass you gain
            // from consuming a player to min(consumedEntityMass, Player.getConsumedMass(consumedEntity)).
            if (leftNeighborType == EntityType.ALIVE)
                leftNeighborMass = uint128(
                    // prettier-ignore
                    leftNeighborMass // Conceptually equal to consumedEntityMass.
                    .min(Player.getConsumedMass(leftNeighbor)) // consumedEntity = leftNeighbor.
                );

            uint160 consumedEntity = leftNeighbor; // Need to cache as we'll reassign leftNeighbor below.
            leftNeighbor = Entity.getLeftNeighbor(consumedEntity); // Try another neighbor to the left.
            // Must go after the getLeftNeighbor(...) call, this'll delete the consumedEntity's state.
            EntityLib.onConsumeEntity(entity, consumedEntity, wadTime);

            // Retrieve and update the right edge of the new left neighbor candidate. Checked for overlap in the while.
            leftNeighborRightEdge = EntityLib.computeX(leftNeighbor, wadTime) + EntityLib.computeDiameter(leftNeighbor);

            // Update the entity's mass and diameter (uncommitted) given it just absorbed the left neighbor. We also
            // update the left edge of the entity to account for its larger diameter, see inline comments for more.
            uint128 newDiameter = ConfigLib.mapMassToDiameter(entityMass += leftNeighborMass);
            entityLeftEdge -= newDiameter - entityDiameter; // See winnerEntityNewLastX in processCollisions for why.
            entityDiameter = newDiameter; // This is done last because the line above depends on the old entityDiameter.
        }

        // Apply the, until now, uncommitted updates to mass (and thus diameter).
        uint128 massConsumed = entityMass - Entity.getMass(entity);
        Entity.setMass(entity, entityMass);
        Player.setConsumedMass(entity, Player.getConsumedMass(entity) + massConsumed);

        LineLib.insertEntityIntoLine(line, entity, entityLeftEdge, leftNeighbor, rightNeighbor, wadTime, collisionQueue);
    }
}
