import * as sha3 from "js-sha3";
import { Buffer } from "buffer";

import {
  Entity,
  EntityType,
  computeCollisionTime,
  computeDiameter,
  computeX,
  isBoundaryEntity,
  isPoweredUp,
  onConsumeEntity,
  toEntityId,
} from "./entityLib";
import { GameConfig, GameState, LineState, mapMassToDiameter } from "./configLib";

import { timeWad } from "../timeLib";
import { PQ96x160, peek, pop, push } from "../pq96x160";
import { DEBUG_VERBOSE, findOrThrow, mapEntityToEmoji } from "../debugging";

/*//////////////////////////////////////////////////////////////
                    ENTITY INSERTION/REMOVAL
//////////////////////////////////////////////////////////////*/

export function insertEntityIntoLine(
  line: Entity[],
  entity: Entity,
  entityLeftEdge: bigint,
  leftNeighbor: Entity,
  rightNeighbor: Entity,
  wadTime: bigint,
  collisionQueue: PQ96x160,
  globalVelCoeff: bigint
) {
  const lineId = line[0].lineId;

  entity.lineId = lineId; // We don't assume the caller has already set this.
  entity.lastX = entityLeftEdge;
  entity.lastTouchedTime = wadTime;
  entity.leftNeighbor = leftNeighbor.entityId;
  entity.rightNeighbor = rightNeighbor.entityId;

  // Push the entity onto the line. On-chain we just set its location and keep going, but on
  // the frontend we need to push it because we're storing lines as arrays instead of maps.
  line.push(entity);

  if (DEBUG_VERBOSE != null)
    console.log(
      "Inserted entity",
      mapEntityToEmoji(entity.entityId),
      "between",
      mapEntityToEmoji(leftNeighbor.entityId),
      "and",
      mapEntityToEmoji(rightNeighbor.entityId)
    );

  // Update the neighbors' references to include the new entity.
  leftNeighbor.rightNeighbor = entity.entityId;
  rightNeighbor.leftNeighbor = entity.entityId;

  // Schedule the entity's collision with its left neighbor.
  scheduleCollision(leftNeighbor, entity, collisionQueue, globalVelCoeff);
  // Schedule the entity's right neighbor's collision with the entity.
  scheduleCollision(entity, rightNeighbor, collisionQueue, globalVelCoeff);
}

/*//////////////////////////////////////////////////////////////
                      COLLISION PROCESSING
//////////////////////////////////////////////////////////////*/

export function processCollisions(
  line: Entity[],
  gameState: GameState,
  gameConfig: GameConfig,
  lineState: LineState,
  playSfx: boolean,
  playerIdForSfx: bigint | null,
  {
    stopAtIteration,
    stopAtTimestampWad,
  }: {
    stopAtIteration: number | null;
    stopAtTimestampWad: bigint | null;
  }
): bigint {
  if (stopAtIteration == null) stopAtIteration = 99999999999999; // For debugging.

  let lastCollisionTime = line.reduce(
    (max, entity) => (entity.lastTouchedTime > max ? entity.lastTouchedTime : max),
    0n
  ); // For debugging.

  const lineId = line[0].lineId;

  for (let i = 0; i < stopAtIteration; i++) {
    try {
      if (lineState.collisionQueue.length === 0) break; // If the queue is empty, there's nothing to do.

      const { priority: collisionTimeWad, value: rightEntityId } = peek(lineState.collisionQueue)!;

      // If the next collision is in the future, we're done for now.
      if (collisionTimeWad > (stopAtTimestampWad ?? timeWad())) break;

      if (DEBUG_VERBOSE != null) console.log("\nStarting iteration", i, "of line", lineId);

      lastCollisionTime = collisionTimeWad; // For debugging.

      pop(lineState.collisionQueue); // Now that we know we're going to process this collision, we can pop it.

      const rightEntity = line.find((e) => e.entityId == rightEntityId);

      // Skip if the right entity isn't on the in-focus line or is dead. The entity was moved
      // or killed, meaning the entry in the collision queue is stale & now no longer relevant.
      // No need to check the left entity, as the neighbors linked list won't have stale entries.
      if (!rightEntity || rightEntity.lineId != lineId || rightEntity.etype == EntityType.DEAD)
        continue;

      const leftEntity = findOrThrow(line, rightEntity.leftNeighbor);

      if (DEBUG_VERBOSE != null)
        console.log(
          "Processing collision between",
          mapEntityToEmoji(leftEntity.entityId),
          "and",
          mapEntityToEmoji(rightEntity.entityId)
        );

      // If recomputed time does not match the collision time associated with this entry
      // in the queue, we'll skip it. Note that the pop above removed it from the queue.
      if (
        computeCollisionTime(leftEntity, rightEntity, gameConfig.velocityCoefficient) !=
        collisionTimeWad
      )
        continue;

      const [leftEtype, rightEtype] = [leftEntity.etype, rightEntity.etype];

      // Entities bounce off boundaries. Walls also bounce off power pellets.
      if (
        isBoundaryEntity(leftEntity.entityId) ||
        isBoundaryEntity(rightEntityId) ||
        (leftEntity.etype == EntityType.WALL && rightEntity.etype == EntityType.POWER_PELLET) ||
        (leftEntity.etype == EntityType.POWER_PELLET && rightEntity.etype == EntityType.WALL)
      ) {
        // Determine which of the entities involved in the collision is non-static.
        const nonStaticEntity = leftEntity.velMultiplier != 0n ? leftEntity : rightEntity;

        // SFX LOGIC — NOT PRESENT ON-CHAIN
        {
          if (playSfx && nonStaticEntity.entityId == playerIdForSfx)
            new Audio("sounds/wallBounce.wav").play();
        }

        // Update the entity's location and last touched time to be the point of collision.
        nonStaticEntity.lastX = computeX(
          nonStaticEntity,
          collisionTimeWad,
          gameConfig.velocityCoefficient
        );
        nonStaticEntity.lastTouchedTime = collisionTimeWad;

        // Reverse the velocity of the non-static entity, so it bounces off the static entity.
        nonStaticEntity.velMultiplier = -nonStaticEntity.velMultiplier;

        // Don't schedule a collision between the nonStaticEntity and the static entity, it has no velocity.
        if (nonStaticEntity.entityId === rightEntityId) {
          spawnConsumableOrScheduleCollision(
            line,
            nonStaticEntity,
            findOrThrow(line, nonStaticEntity.rightNeighbor),
            collisionTimeWad,
            lineState,
            gameState,
            gameConfig
          );
        } else {
          spawnConsumableOrScheduleCollision(
            line,
            findOrThrow(line, nonStaticEntity.leftNeighbor),
            nonStaticEntity,
            collisionTimeWad,
            lineState,
            gameState,
            gameConfig
          );
        }

        continue;
      }

      // Walls bounce off each other. Powered-up entities bounce off walls and each other.
      if (
        (leftEtype == EntityType.WALL ||
          isPoweredUp(leftEntity, collisionTimeWad, gameConfig.powerPelletEffectTime)) &&
        (rightEtype == EntityType.WALL ||
          isPoweredUp(rightEntity, collisionTimeWad, gameConfig.powerPelletEffectTime))
      ) {
        // Update both entities' positions and last touched times.
        leftEntity.lastX = computeX(leftEntity, collisionTimeWad, gameConfig.velocityCoefficient);
        leftEntity.lastTouchedTime = collisionTimeWad;
        rightEntity.lastX = computeX(rightEntity, collisionTimeWad, gameConfig.velocityCoefficient);
        rightEntity.lastTouchedTime = collisionTimeWad;

        // Set velocities for both entities so they go in opposite directions.
        leftEntity.velMultiplier = -leftEntity.velMultiplier.abs();
        rightEntity.velMultiplier = rightEntity.velMultiplier.abs();

        // SFX LOGIC — NOT PRESENT ON-CHAIN
        {
          if (
            playSfx &&
            (leftEntity.entityId == playerIdForSfx || rightEntity.entityId == playerIdForSfx)
          )
            new Audio("sounds/wallBounce.wav").play();
        }

        // Schedule new collisions for both entities.
        spawnConsumableOrScheduleCollision(
          line,
          findOrThrow(line, leftEntity.leftNeighbor),
          leftEntity,
          collisionTimeWad,
          lineState,
          gameState,
          gameConfig
        );
        spawnConsumableOrScheduleCollision(
          line,
          rightEntity,
          findOrThrow(line, rightEntity.rightNeighbor),
          collisionTimeWad,
          lineState,
          gameState,
          gameConfig
        );

        continue;
      }

      // Determine which entity consumed the other in the collision, update
      // its mass if necessary, and cache & (if needed) offset its new lastX.
      let winnerEntity: Entity;
      let winnerEntityNewLastX: bigint;
      if (leftEtype == EntityType.WALL || rightEtype == EntityType.WALL) {
        winnerEntity = leftEtype == EntityType.WALL ? leftEntity : rightEntity;
        winnerEntityNewLastX = computeX(
          winnerEntity,
          collisionTimeWad,
          gameConfig.velocityCoefficient
        );
      } else {
        let [leftEntityMass, rightEntityMass] = [leftEntity.mass, rightEntity.mass];

        // prettier-ignore
        // Determine the winner based on the following ordering:
        // 1. Non-{food, power-pellet} entity wins over food/power-pellet
        // 2. Powered-up entity wins (if both are powered up, neither wins)
        // 3. Entity with greater mass wins
        winnerEntity =
              (leftEtype == EntityType.FOOD || leftEtype == EntityType.POWER_PELLET) ? rightEntity
            : (rightEtype == EntityType.FOOD || rightEtype == EntityType.POWER_PELLET) ? leftEntity
            : isPoweredUp(leftEntity, collisionTimeWad, gameConfig.powerPelletEffectTime) ? leftEntity
            : isPoweredUp(rightEntity, collisionTimeWad, gameConfig.powerPelletEffectTime) ? rightEntity
            : (leftEntityMass > rightEntityMass ? leftEntity : rightEntity);

        // We have to compute the winnerEntity's x before potentially updating its mass,
        // as updating mass would update velocity and thus our trajectory calculations.
        winnerEntityNewLastX = computeX(
          winnerEntity,
          collisionTimeWad,
          gameConfig.velocityCoefficient
        );

        // To discourage players from rapidly spawning bots to feed themselves, we cap the mass you
        // gain from consuming a player to min(loserEntityMass, Player.getConsumedMass(loserEntity)).
        if (winnerEntity == rightEntity) {
          if (leftEtype == EntityType.ALIVE)
            leftEntityMass = leftEntityMass.min(leftEntity.consumedMass);

          // If the winner entity was on the right, we need to shift their x to the left to
          // account for the possibly increased mass of the entity, otherwise the entity's
          // winner diameter could cause it to instantly collide with its right neighbor(s).
          // If the winning entity was on the left, we don't need to move lastX because the
          // right edge of the winner won't grow beyond the right edge of the consumed entity.
          // Can assume because an invariant of the game is that mapMassToDiameter is sub-linear.
          // From a player's pov, this just looks like the entity grew out from the left edge.
          winnerEntityNewLastX -=
            mapMassToDiameter(rightEntityMass + leftEntityMass) -
            mapMassToDiameter(rightEntityMass);
        } else if (rightEtype == EntityType.ALIVE)
          rightEntityMass = rightEntityMass.min(rightEntity.consumedMass);

        winnerEntity.mass = rightEntityMass + leftEntityMass; // Winner's new mass is the sum of both.
        winnerEntity.consumedMass += winnerEntity == rightEntity ? leftEntityMass : rightEntityMass; // Winner consumed the loser's mass.
      }

      // Update the winner entity's location, last touched time, and neighbors.
      const newLeftNeighbor = findOrThrow(line, leftEntity.leftNeighbor);
      const newRightNeighbor = findOrThrow(line, rightEntity.rightNeighbor);
      winnerEntity.lastX = winnerEntityNewLastX;
      winnerEntity.lastTouchedTime = collisionTimeWad;
      winnerEntity.leftNeighbor = newLeftNeighbor.entityId;
      winnerEntity.rightNeighbor = newRightNeighbor.entityId;

      // Update outer neighbors' references to point to the winning entity.
      newLeftNeighbor.rightNeighbor = winnerEntity.entityId;
      newRightNeighbor.leftNeighbor = winnerEntity.entityId;

      onConsumeEntity(
        line,
        gameState,
        gameConfig,
        winnerEntity,
        winnerEntity.entityId == rightEntity.entityId ? leftEntity : rightEntity,
        collisionTimeWad,
        playSfx,
        playerIdForSfx
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
        // Schedule collisions with the left and right neighbors of the winner entity.
        scheduleCollision(
          newLeftNeighbor,
          winnerEntity,
          lineState.collisionQueue,
          gameConfig.velocityCoefficient
        );
        scheduleCollision(
          winnerEntity,
          newRightNeighbor,
          lineState.collisionQueue,
          gameConfig.velocityCoefficient
        );
      } else {
        // Schedule collisions with the left and right neighbors of the winner entity, or depending on
        // the gap between the two entities, spawn a consumable between the winner entity and a neighbor.
        // If so we'll avoid wastefully queueing the collision between the winner entity and that neighbor.
        spawnConsumableOrScheduleCollision(
          line,
          newLeftNeighbor,
          winnerEntity,
          collisionTimeWad,
          lineState,
          gameState,
          gameConfig
        );
        spawnConsumableOrScheduleCollision(
          line,
          winnerEntity,
          newRightNeighbor,
          collisionTimeWad,
          lineState,
          gameState,
          gameConfig
        );
      }
    } catch (e) {
      console.error("[!] Failed at iteration", i, "of line", lineId, "—", e);
      throw e;
    }
  }

  // We purposely DO NOT set lastTouchedTime here, as we'll use it to check if
  // the contract has processed any new collisions since the last time we synced.

  return lastCollisionTime; // For debugging.
}

/*//////////////////////////////////////////////////////////////
                      COLLISION SCHEDULERS
//////////////////////////////////////////////////////////////*/

export function scheduleCollision(
  leftEntity: Entity,
  rightEntity: Entity,
  currentCollisionQueue: PQ96x160,
  globalVelCoeff: bigint
) {
  // Compute when the right entity will collide with the left entity.
  const collisionTime = computeCollisionTime(leftEntity, rightEntity, globalVelCoeff);

  // If there is an imminent collision, add it to the queue with the computed collision time.
  if (collisionTime != 0n)
    push(currentCollisionQueue, { priority: collisionTime, value: rightEntity.entityId });
}

function spawnConsumableOrScheduleCollision(
  line: Entity[],
  leftEntity: Entity,
  rightEntity: Entity,
  wadTime: bigint,
  lineState: LineState,
  gameState: GameState,
  gameConfig: GameConfig
) {
  const leftEntityRightEdge =
    computeX(leftEntity, wadTime, gameConfig.velocityCoefficient) + computeDiameter(leftEntity);
  const rightEntityLeftEdge = computeX(rightEntity, wadTime, gameConfig.velocityCoefficient);

  if (
    // If there's a suitable gap as determined by the edge distance
    // we'll spawn a consumable between the left & right entities, and
    // skip scheduling the computed collision as it's no longer relevant.
    rightEntityLeftEdge - leftEntityRightEdge >=
    gameConfig.consumableSpawnGap
  ) {
    const newId = toEntityId(generateFoodIdSeed(wadTime, rightEntity.entityId));

    if (DEBUG_VERBOSE != null)
      console.log("Spawning food with a right neighbor", mapEntityToEmoji(rightEntity.entityId));

    let newEntity: Entity = {
      entityId: newId,
      ////////////////////////////////////////////////////
      // Purposely unset:
      lineId: 0,
      lastX: 0n,
      lastTouchedTime: 0n,
      leftNeighbor: 0n,
      rightNeighbor: 0n,
      velMultiplier: 0n,
      lastConsumedPowerPelletTime: 0n,
      consumedMass: 0n,
      ////////////////////////////////////////////////////
      etype: EntityType.DEAD, // SET BELOW.
      mass: 0n, // SET BELOW.
    };

    let newEntityMass: bigint; // Will be set in either branch of the if statement below.

    if (newId % BigInt(gameConfig.powerPelletSpawnOdds) == 0n) {
      newEntity.etype = EntityType.POWER_PELLET;
      // 2x is safe, PostDeploy verifies consumableSpawnGap > 4 * maxFoodMass.
      newEntity.mass = newEntityMass = 2n * gameConfig.maxFoodMass;
    } else {
      newEntity.etype = EntityType.FOOD;
      newEntity.mass = newEntityMass = gameConfig.minFoodMass + (newId % gameConfig.maxFoodMass);
    }

    insertEntityIntoLine(
      line,
      newEntity,
      // leftX that will center it between its neighbors.
      (leftEntityRightEdge + rightEntityLeftEdge - mapMassToDiameter(newEntityMass)) / 2n,
      leftEntity,
      rightEntity,
      wadTime,
      lineState.collisionQueue,
      gameConfig.velocityCoefficient
    );
  } else
    scheduleCollision(
      leftEntity,
      rightEntity,
      lineState.collisionQueue,
      gameConfig.velocityCoefficient
    ); // Schedule the collision if there's no gap.
}

function generateFoodIdSeed(wadTime: bigint, rightEntity: bigint) {
  // Mask with 0xffffffffffffffffffffffff (12 bytes, 96 bits)
  const maskedWadTime = wadTime & 0xffffffffffffffffffffffffn;
  // Mask with 0xffffffffffffffffffffffffffffffffffffffff (20 bytes, 160 bits)
  const maskedRightEntity = rightEntity & 0xffffffffffffffffffffffffffffffffffffffffn;

  // .toString(16) -> string of hex digits. Pad w/ leading zeros to make 64 hex chars long = 32 bytes.
  const buff1 = Buffer.from(maskedWadTime.toString(16).padStart(64, "0"), "hex");
  const buff2 = Buffer.from(maskedRightEntity.toString(16).padStart(64, "0"), "hex");

  // For some reason when importing sha3 in Node.js, instead of just
  // being the object, it's wrapped in an object with a `default` property.
  return BigInt(
    "0x" +
      ("default" in sha3 ? (sha3.default as typeof sha3) : sha3).keccak256(
        Buffer.concat([buff1, buff2])
      )
  );
}
