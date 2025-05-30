// SPDX-License-Identifier: MIT
pragma solidity >=0.8.21;

import "../codegen/index.sol";
import "../codegen/common.sol";

import {timeWad} from "./WadTimeLib.sol";
import {EntityLib} from "./EntityLib.sol";
import {ConfigLib} from "./ConfigLib.sol";
import {PriorityQueue96x160Lib, MinHeapLib} from "./PriorityQueue96x160Lib.sol";

import {FixedPointMathLib} from "solady/utils/FixedPointMathLib.sol";

library LineLib {
    using PriorityQueue96x160Lib for MinHeapLib.MemHeap;
    using MinHeapLib for MinHeapLib.MemHeap;
    using FixedPointMathLib for *;

    /*//////////////////////////////////////////////////////////////
                            ENTITY INSERTION
    //////////////////////////////////////////////////////////////*/

    // Will revert if the entity does not fit between the right neighbor and its left neighbor.
    function spawnEntityIntoLine(
        uint32 line,
        uint160 entity,
        uint160 rightNeighbor,
        uint96 wadTime, // Caller must ensure all collisions up to wadTime are processed before calling.
        MinHeapLib.MemHeap memory collisionQueue
    ) internal {
        require(
            rightNeighbor != 0 &&
                rightNeighbor != entity &&
                Entity.getLineId(rightNeighbor) == line &&
                rightNeighbor != EntityLib.leftmostEntityId(line) &&
                Entity.getEtype(rightNeighbor) != EntityType.DEAD,
            "INVALID_PROPOSED_RIGHT_NEIGHBOR"
        );

        uint160 leftNeighbor = Entity.getLeftNeighbor(rightNeighbor); // Implicitly proposed left neighbor.

        (uint128 leftNeighborRightEdge, uint128 rightNeighborLeftEdge, uint128 entityDiameter) = (
            EntityLib.computeX(leftNeighbor, wadTime) + EntityLib.computeDiameter(leftNeighbor),
            EntityLib.computeX(rightNeighbor, wadTime),
            EntityLib.computeDiameter(entity)
        );

        // Ensure the entity to be spawned will fit between the two neighbors.
        require(rightNeighborLeftEdge - leftNeighborRightEdge > entityDiameter, "ENTITY_DOES_NOT_FIT_BETWEEN_NEIGHBORS");

        insertEntityIntoLine(
            line,
            entity,
            // leftX that will center it between its neighbors.
            (leftNeighborRightEdge + rightNeighborLeftEdge - entityDiameter) / 2,
            leftNeighbor,
            rightNeighbor,
            wadTime,
            collisionQueue
        );
    }

    // Assumes caller has validated that the entity can fit between the left and right neighbors.
    function insertEntityIntoLine(
        uint32 line,
        uint160 entity,
        uint128 entityLeftEdge,
        uint160 leftNeighbor,
        uint160 rightNeighbor,
        uint96 wadTime, // Caller must ensure all collisions up to wadTime are processed before calling.
        MinHeapLib.MemHeap memory collisionQueue
    ) internal {
        Entity.setLineId(entity, line); // We don't assume the caller has already set this.
        Entity.setLastX(entity, entityLeftEdge);
        Entity.setLastTouchedTime(entity, wadTime);
        Entity.setLeftNeighbor(entity, leftNeighbor);
        Entity.setRightNeighbor(entity, rightNeighbor);

        // Update the neighbors' references to include the new entity.
        Entity.setRightNeighbor(leftNeighbor, entity);
        Entity.setLeftNeighbor(rightNeighbor, entity);

        // Schedule the entity's collision with its left neighbor.
        scheduleCollision(leftNeighbor, entity, collisionQueue);
        // Schedule the entity's right neighbor's collision with the entity.
        scheduleCollision(entity, rightNeighbor, collisionQueue);
    }

    /*//////////////////////////////////////////////////////////////
                          COLLISION PROCESSING
    //////////////////////////////////////////////////////////////*/

    function processCollisions(uint32 line, MinHeapLib.MemHeap memory currentCollisionQueue) internal {
        while (!currentCollisionQueue.isEmpty()) {
            (uint96 collisionTimeWad, uint160 rightEntity) = currentCollisionQueue.peek();

            if (collisionTimeWad > timeWad()) break; // If the next collision is in the future, we're done for now.

            currentCollisionQueue.pop(); // Now that we know we're going to process this collision, we can pop it.

            // Skip if the right entity isn't on the in-focus line or is dead. The entity was moved
            // or killed, meaning the entry in the collision queue is stale & now no longer relevant.
            // No need to check the left entity, as the neighbors linked list won't have stale entries.
            if (Entity.getLineId(rightEntity) != line || Entity.getEtype(rightEntity) == EntityType.DEAD) continue;

            uint160 leftEntity = Entity.getLeftNeighbor(rightEntity); // The right entity collided with its left neighbor.

            // Recompute the collision time to ensure it's still accurate, as when trajectories change we don't remove old
            // queue entires, but instead re-add them with the updated time. If the time doesn't match we'll skip the entry.
            if (EntityLib.computeCollisionTime(leftEntity, rightEntity) != collisionTimeWad) continue;

            (EntityType leftEtype, EntityType rightEtype) = (Entity.getEtype(leftEntity), Entity.getEtype(rightEntity));

            // Entities bounce off boundaries. Walls also bounce off power pellets.
            if (
                (EntityLib.isBoundaryEntity(leftEntity) || EntityLib.isBoundaryEntity(rightEntity)) ||
                (leftEtype == EntityType.WALL && rightEtype == EntityType.POWER_PELLET) ||
                (leftEtype == EntityType.POWER_PELLET && rightEtype == EntityType.WALL)
            ) {
                // Determine which of the entities involved in the collision is non-static.
                uint160 nonStaticEntity = Entity.getVelMultiplier(leftEntity) != 0 ? leftEntity : rightEntity;

                // Update the entity's location and last touched time to be the point of collision.
                Entity.setLastX(nonStaticEntity, EntityLib.computeX(nonStaticEntity, collisionTimeWad));
                Entity.setLastTouchedTime(nonStaticEntity, collisionTimeWad);

                // Reverse the velocity of the non-static entity, so it bounces off the static entity.
                Entity.setVelMultiplier(nonStaticEntity, -Entity.getVelMultiplier(nonStaticEntity));

                // Don't schedule a collision between the nonStaticEntity and the static entity, it has no velocity.
                if (nonStaticEntity == rightEntity)
                    spawnConsumableOrScheduleCollision(
                        line,
                        nonStaticEntity,
                        Entity.getRightNeighbor(nonStaticEntity),
                        collisionTimeWad,
                        currentCollisionQueue
                    );
                else
                    spawnConsumableOrScheduleCollision(
                        line,
                        Entity.getLeftNeighbor(nonStaticEntity),
                        nonStaticEntity,
                        collisionTimeWad,
                        currentCollisionQueue
                    );

                continue;
            }

            // Walls bounce off each other. Powered-up entities bounce off walls and each other.
            if (
                (leftEtype == EntityType.WALL || EntityLib.isPoweredUp(leftEntity, collisionTimeWad)) &&
                (rightEtype == EntityType.WALL || EntityLib.isPoweredUp(rightEntity, collisionTimeWad))
            ) {
                // Update both entities' positions and last touched times.
                Entity.setLastX(leftEntity, EntityLib.computeX(leftEntity, collisionTimeWad));
                Entity.setLastTouchedTime(leftEntity, collisionTimeWad);
                Entity.setLastX(rightEntity, EntityLib.computeX(rightEntity, collisionTimeWad));
                Entity.setLastTouchedTime(rightEntity, collisionTimeWad);

                // Set velocities for both entities so they go in opposite directions.
                Entity.setVelMultiplier(leftEntity, -int128(int256(Entity.getVelMultiplier(leftEntity).abs())));
                Entity.setVelMultiplier(rightEntity, int128(int256(Entity.getVelMultiplier(rightEntity).abs())));

                // Schedule new collisions for both entities.
                spawnConsumableOrScheduleCollision(
                    line,
                    Entity.getLeftNeighbor(leftEntity),
                    leftEntity,
                    collisionTimeWad,
                    currentCollisionQueue
                );
                spawnConsumableOrScheduleCollision(
                    line,
                    rightEntity,
                    Entity.getRightNeighbor(rightEntity),
                    collisionTimeWad,
                    currentCollisionQueue
                );

                continue;
            }

            // Determine which entity consumed the other in the collision, update
            // its mass if necessary, and cache & (if needed) offset its new lastX.
            uint160 winnerEntity;
            uint128 winnerEntityNewLastX;
            if (leftEtype == EntityType.WALL || rightEtype == EntityType.WALL) {
                winnerEntity = leftEtype == EntityType.WALL ? leftEntity : rightEntity;
                winnerEntityNewLastX = EntityLib.computeX(winnerEntity, collisionTimeWad);
            } else {
                (uint128 leftEntityMass, uint128 rightEntityMass) = (
                    Entity.getMass(leftEntity),
                    Entity.getMass(rightEntity)
                );

                // prettier-ignore
                // We have to compute the winnerEntity's x before potentially updating its mass,
                // as updating mass would update velocity and thus our trajectory calculations.
                winnerEntityNewLastX = EntityLib.computeX(
                    // Determine the winner based on the following ordering:
                    // 1. Non-{food, power-pellet} entity wins over food/power-pellet
                    // 2. Powered-up entity wins (if both are powered up, neither wins)
                    // 3. Entity with greater mass wins
                    winnerEntity =
                          (leftEtype == EntityType.FOOD || leftEtype == EntityType.POWER_PELLET) ? rightEntity
                        : (rightEtype == EntityType.FOOD || rightEtype == EntityType.POWER_PELLET) ? leftEntity
                        : EntityLib.isPoweredUp(leftEntity, collisionTimeWad) ? leftEntity
                        : EntityLib.isPoweredUp(rightEntity, collisionTimeWad) ? rightEntity
                        : (leftEntityMass > rightEntityMass ? leftEntity : rightEntity),
                    collisionTimeWad
                );

                // To discourage players from rapidly spawning bots to feed themselves, we cap the mass you
                // gain from consuming a player to min(loserEntityMass, Player.getConsumedMass(loserEntity)).
                if (winnerEntity == rightEntity) {
                    if (leftEtype == EntityType.ALIVE)
                        leftEntityMass = uint128(leftEntityMass.min(Player.getConsumedMass(leftEntity)));

                    // If the winner entity was on the right, we need to shift their x to the left to
                    // account for the possibly increased mass of the entity, otherwise the entity's
                    // winner diameter could cause it to instantly collide with its right neighbor(s).
                    // If the winning entity was on the left, we don't need to move lastX because the
                    // right edge of the winner won't grow beyond the right edge of the consumed entity.
                    // Can assume because an invariant of the game is that mapMassToDiameter is sub-linear.
                    // From a player's pov, this just looks like the entity grew out from the left edge.
                    winnerEntityNewLastX -=
                        ConfigLib.mapMassToDiameter(rightEntityMass + leftEntityMass) -
                        ConfigLib.mapMassToDiameter(rightEntityMass);
                } else if (rightEtype == EntityType.ALIVE)
                    rightEntityMass = uint128(rightEntityMass.min(Player.getConsumedMass(rightEntity)));

                Entity.setMass(winnerEntity, rightEntityMass + leftEntityMass); // Winner's new mass is the sum of both.
                // prettier-ignore
                Player.setConsumedMass(winnerEntity, Player.getConsumedMass(winnerEntity)
                    + (winnerEntity == rightEntity ? leftEntityMass : rightEntityMass)); // Winner consumed the loser's mass.
            }

            // Update the winner entity's location, last touched time, and neighbors.
            uint160 newLeftNeighbor = Entity.getLeftNeighbor(leftEntity);
            uint160 newRightNeighbor = Entity.getRightNeighbor(rightEntity);
            Entity.setLastX(winnerEntity, winnerEntityNewLastX);
            Entity.setLastTouchedTime(winnerEntity, collisionTimeWad);
            Entity.setLeftNeighbor(winnerEntity, newLeftNeighbor);
            Entity.setRightNeighbor(winnerEntity, newRightNeighbor);

            // Update new neighbors' references to point to the winning entity.
            Entity.setRightNeighbor(newLeftNeighbor, winnerEntity);
            Entity.setLeftNeighbor(newRightNeighbor, winnerEntity);

            EntityLib.onConsumeEntity(
                winnerEntity,
                winnerEntity == rightEntity ? leftEntity : rightEntity,
                collisionTimeWad
            );

            if (
                // If this is a food-player collision, we don't want to try to spawn
                // food between the player and its neighbors, because in a chase this
                // could result in a fleeing player generating food for their pursuer.
                // NOTE: Must used cached leftEtype/rightEtype here, as the etype of the
                // consumed entity may be set to DEAD above, which would break this check.
                (leftEtype == EntityType.ALIVE && rightEtype == EntityType.FOOD) ||
                (leftEtype == EntityType.FOOD && rightEtype == EntityType.ALIVE)
            ) {
                // Schedule collisions with the new left and right neighbors of the winner entity.
                scheduleCollision(newLeftNeighbor, winnerEntity, currentCollisionQueue);
                scheduleCollision(winnerEntity, newRightNeighbor, currentCollisionQueue);
            } else {
                // Schedule collisions with the new left and right neighbors of the winner entity, or depending on
                // the gap between the two entities, spawn a consumable between the winner entity and a neighbor.
                // If so we'll avoid wastefully queueing the collision between the winner entity and that neighbor.
                spawnConsumableOrScheduleCollision(
                    line,
                    newLeftNeighbor,
                    winnerEntity,
                    collisionTimeWad,
                    currentCollisionQueue
                );
                spawnConsumableOrScheduleCollision(
                    line,
                    winnerEntity,
                    newRightNeighbor,
                    collisionTimeWad,
                    currentCollisionQueue
                );
            }
        }

        LineOffchain.setLastTouchedTime(line, timeWad()); // Used to allow clients to easily avoid redundant processing.
    }

    /*//////////////////////////////////////////////////////////////
                          COLLISION SCHEDULING
    //////////////////////////////////////////////////////////////*/

    function scheduleCollision(
        uint160 leftEntity,
        uint160 rightEntity,
        MinHeapLib.MemHeap memory currentCollisionQueue
    ) internal view {
        // Compute when the right entity will collide with the left entity.
        uint96 collisionTime = EntityLib.computeCollisionTime(leftEntity, rightEntity);

        // If there's an imminent collision, add it to the queue with the computed collision time.
        if (collisionTime != 0) currentCollisionQueue.push(collisionTime, rightEntity);
    }

    function spawnConsumableOrScheduleCollision(
        uint32 line,
        uint160 leftEntity,
        uint160 rightEntity,
        uint96 wadTime,
        MinHeapLib.MemHeap memory currentCollisionQueue
    ) internal {
        (uint128 leftEntityRightEdge, uint128 rightEntityLeftEdge) = (
            EntityLib.computeX(leftEntity, wadTime) + EntityLib.computeDiameter(leftEntity),
            EntityLib.computeX(rightEntity, wadTime)
        );

        if (
            // If there's a suitable gap as determined by the edge distance
            // we'll spawn a consumable between the left & right entities, and
            // skip scheduling the computed collision as it's no longer relevant.
            rightEntityLeftEdge - leftEntityRightEdge >= GameConfig.getConsumableSpawnGap()
        ) {
            uint160 newId = EntityLib.toEntityId(uint256(keccak256(abi.encode(wadTime, rightEntity))));
            uint128 newEntityMass; // Will be set in either branch of the if statement below.

            if (newId % GameConfig.getPowerPelletSpawnOdds() == 0) {
                Entity.setEtype(newId, EntityType.POWER_PELLET);
                // 2x is safe, PostDeploy verifies consumableSpawnGap > 3 * maxFoodMass.
                Entity.setMass(newId, newEntityMass = uint128(2 * GameConfig.getMaxFoodMass()));
            } else {
                Entity.setEtype(newId, EntityType.FOOD);
                Entity.setMass(
                    newId,
                    newEntityMass = uint128(GameConfig.getMinFoodMass() + (newId % GameConfig.getMaxFoodMass()))
                );
            }

            insertEntityIntoLine(
                line,
                newId,
                // leftX that will center it between its neighbors.
                (leftEntityRightEdge + rightEntityLeftEdge - ConfigLib.mapMassToDiameter(newEntityMass)) / 2,
                leftEntity,
                rightEntity,
                wadTime,
                currentCollisionQueue
            );
        } else scheduleCollision(leftEntity, rightEntity, currentCollisionQueue); // Schedule the collision if there's no gap.
    }

    /*//////////////////////////////////////////////////////////////
                         COLLISION QUEUE HELPERS
    //////////////////////////////////////////////////////////////*/

    function getCollisionQueue(uint32 lineNumber) internal view returns (MinHeapLib.MemHeap memory) {
        return MinHeapLib.MemHeap(Line.getCollisionQueue(lineNumber));
    }
}
