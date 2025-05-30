// SPDX-License-Identifier: MIT
pragma solidity >=0.8.21;

import "../codegen/index.sol";
import "../codegen/common.sol";

import {ConfigLib} from "./ConfigLib.sol";

import {MinHeapLib} from "solady/utils/MinHeapLib.sol";
import {FixedPointMathLib} from "solady/utils/FixedPointMathLib.sol";

library EntityLib {
    using FixedPointMathLib for *;
    using MinHeapLib for MinHeapLib.MemHeap;

    /*//////////////////////////////////////////////////////////////
                     UP-TO-DATE ENTITY PROPERTY DATA
    //////////////////////////////////////////////////////////////*/

    function computeX(uint160 entity, uint96 wadTime) internal view returns (uint128) {
        // x_0 + v * (t - t_0)
        int128 computedX = int128(Entity.getLastX(entity)) +
            int128(computeVelocity(entity).sMulWad(int96(wadTime) - int96(Entity.getLastTouchedTime(entity))));

        // Casting a negative position would cause overflow, avoid for safety.
        return computedX <= 0 ? 0 : uint128(computedX);
    }

    function computeCollisionTime(uint160 leftEntity, uint160 rightEntity) internal view returns (uint96) {
        (int128 leftVelocity, int128 rightVelocity) = (computeVelocity(leftEntity), computeVelocity(rightEntity));

        // If leftVelocity > rightVelocity -> relativeVelocity > 0 -> will collide, since:
        // - the left entity is going right faster than the right entity can run away
        // - or the right entity is going left faster than the left entity can run away
        // - or the left entity is going right and the right entity is going to the left.
        //
        // If leftVelocity == rightVelocity -> relativeVelocity == 0 -> won't collide, since:
        // - the left entity and the right entity are both going at the exact same speed.
        //
        // If leftVelocity < rightVelocity -> relativeVelocity < 0 -> won't collide, since:
        // - the right entity is going right faster than the left entity can catch up
        // - or the left entity is going left faster than the right entity can catch up
        // - or the left entity is going left while the right entity is going to the right.
        int128 relativeVelocity = leftVelocity - rightVelocity;

        // Bail early as no need to compute a time when we know they won't collide.
        if (relativeVelocity <= 0) return 0; // Caller will ignore returned times of 0.

        (int128 leftEntityRightEdge, int128 rightEntityLeftEdge) = (
            int128(Entity.getLastX(leftEntity) + computeDiameter(leftEntity)),
            int128(Entity.getLastX(rightEntity))
        );

        // prettier-ignore
        return uint96(
            // x1_0 + v1 * (t - t1_0) = x2_0 + v2 * (t - t2_0) -> Solve for t
            // t = ((x2_0 - x1_0) + ((t1_0 * v1) - (t2_0 * v2))) / (v1 - v2)
            // x1 -> leftEntity, x2 -> rightEntity, x1_0 -> lastX + diameter
            // Numerator < 0 only if no collision, which is checked for above.
            uint256((rightEntityLeftEdge - leftEntityRightEdge)
                + int96(Entity.getLastTouchedTime(leftEntity)).sMulWad(leftVelocity)
                - int96(Entity.getLastTouchedTime(rightEntity)).sMulWad(rightVelocity)
            ).divWad(uint128(relativeVelocity)) // relativeVelocity > 0, so cast is safe.
        );
    }

    function isPoweredUp(uint160 entity, uint96 wadTime) internal view returns (bool) {
        return wadTime - Player.getLastConsumedPowerPelletTime(entity) <= GameConfig.getPowerPelletEffectTime();
    }

    function computeDiameter(uint160 entity) internal view returns (uint128) {
        return ConfigLib.mapMassToDiameter(Entity.getMass(entity));
    }

    function computeVelocity(uint160 entity) internal view returns (int128) {
        return int128(ConfigLib.mapMassToVelocity(Entity.getMass(entity)).sMulWad(Entity.getVelMultiplier(entity)));
    }

    /*//////////////////////////////////////////////////////////////
                            ENTITY OPERATIONS
    //////////////////////////////////////////////////////////////*/

    function onConsumeEntity(uint160 consumerEntity, uint160 consumedEntity, uint96 wadTime) internal {
        // If the killed consumed entity was a player (vs food, etc):
        if (Entity.getEtype(consumedEntity) == EntityType.ALIVE) {
            // Enqueue (push only if >min) the consumed entity's consumed mass into its top-k scores.
            MinHeapLib.MemHeap memory highScores = MinHeapLib.MemHeap(Player.getHighScores(consumedEntity));
            highScores.enqueue(Player.getConsumedMass(consumedEntity), GameConfig.getHighScoreTopK());
            Player.setHighScores(consumedEntity, highScores.data);

            Player.setConsumedMass(consumedEntity, 0); // Reset the consumed player's consumed mass.
        } else if (
            // If the consumed entity was a power pellet and the consumer is a player:
            Entity.getEtype(consumedEntity) == EntityType.POWER_PELLET && Entity.getEtype(consumerEntity) == EntityType.ALIVE
        ) {
            Player.setLastConsumedPowerPelletTime(consumerEntity, wadTime);
        }

        Entity.deleteRecord(consumedEntity); // Remove the consumed entity from state.
    }

    /*//////////////////////////////////////////////////////////////
                            ENTITY ID HELPERS
    //////////////////////////////////////////////////////////////*/

    // Bounds a seed number into the range of valid non-boundary entity ids.
    function toEntityId(uint256 seed) internal pure returns (uint160) {
        unchecked {
            // Add 1 to avoid returning 0, so we're sure
            // 0 means "not set" in the context of the game.
            // We also avoid returning ids over type(uint144).max,
            // so we can reserve that id range for boundary entities.
            return uint160((seed % type(uint144).max) + 1);
        }
    }

    // Simple overload for addresses, which are commonly used as seeds.
    function toEntityId(address seed) internal pure returns (uint160) {
        return EntityLib.toEntityId(uint160(seed));
    }

    function leftmostEntityId(uint32 line) internal pure returns (uint160) {
        unchecked {
            return uint160(type(uint144).max) + 1 + line; // + 1 to avoid overlap with non-boundary ids.
        }
    }

    function rightmostEntityId(uint32 line) internal pure returns (uint160) {
        unchecked {
            return uint160(type(uint152).max) + line;
        }
    }

    function isRightmostEntity(uint160 entity) internal pure returns (bool) {
        return entity >= type(uint152).max;
    }

    function isBoundaryEntity(uint160 entity) internal pure returns (bool) {
        unchecked {
            return entity > type(uint144).max;
        }
    }
}
