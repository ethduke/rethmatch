import { UINT144_MAX, UINT152_MAX } from "../bigint";
import { enqueue } from "../bigintMinHeap";
import { GameConfig, GameState, mapMassToDiameter, mapMassToVelocity } from "./configLib";

import { stopBackgroundMusic } from "../music";

export enum EntityType {
  DEAD = 0,
  ALIVE,
  FOOD,
  WALL,
  POWER_PELLET,
}

export type Entity = {
  entityId: bigint;
  /////////////////////////////////////////////////////////////////////
  etype: EntityType;
  /////////////////////////////////////////////////////////////////////
  mass: bigint;
  /////////////////////////////////////////////////////////////////////
  velMultiplier: bigint;
  /////////////////////////////////////////////////////////////////////
  lineId: number;
  lastX: bigint;
  lastTouchedTime: bigint;
  leftNeighbor: bigint;
  rightNeighbor: bigint;
  /////////////////////////////////////////////////////////////////////
  lastConsumedPowerPelletTime: bigint;
  consumedMass: bigint;
};

/*//////////////////////////////////////////////////////////////
                  UP-TO-DATE ENTITY PROPERTY DATA
//////////////////////////////////////////////////////////////*/

export function computeX(entity: Entity, wadTime: bigint, globalVelCoeff: bigint): bigint {
  return (
    entity.lastX + computeVelocity(entity, globalVelCoeff).mulWad(wadTime - entity.lastTouchedTime)
  );
}

export function computeCollisionTime(
  leftEntity: Entity,
  rightEntity: Entity,
  globalVelCoeff: bigint
) {
  const [leftEntityRightEdge, rightEntityLeftEdge, leftVelocity, rightVelocity] = [
    leftEntity.lastX + computeDiameter(leftEntity),
    rightEntity.lastX,
    computeVelocity(leftEntity, globalVelCoeff),
    computeVelocity(rightEntity, globalVelCoeff),
  ];

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
  const relativeVelocity = leftVelocity - rightVelocity;

  // Bail early as no need to compute a time when we know they won't collide.
  if (relativeVelocity <= 0n) return 0n; // Caller will ignore times in the past.

  // prettier-ignore
  return ((rightEntityLeftEdge - leftEntityRightEdge)
    + (leftEntity.lastTouchedTime.mulWad(leftVelocity))
    - (rightEntity.lastTouchedTime.mulWad(rightVelocity)))
  .divWad(relativeVelocity);
}

export function isPoweredUp(entity: Entity, wadTime: bigint, powerPelletEffectTime: bigint) {
  return wadTime - entity.lastConsumedPowerPelletTime <= powerPelletEffectTime;
}

export function computeDiameter(entity: Entity) {
  return mapMassToDiameter(entity.mass);
}

export function computeVelocity(entity: Entity, globalVelCoeff: bigint) {
  return mapMassToVelocity(entity.mass, globalVelCoeff).mulWad(entity.velMultiplier);
}

/*//////////////////////////////////////////////////////////////
                        ENTITY OPERATIONS
//////////////////////////////////////////////////////////////*/

export function onConsumeEntity(
  line: Entity[],
  gameState: GameState,
  gameConfig: GameConfig,
  consumerEntity: Entity,
  consumedEntity: Entity,
  wadTime: bigint,
  playSfx: boolean,
  playerIdForSfx: bigint | null
) {
  // If the killed entity was a player (vs food, etc):
  if (consumedEntity.etype === EntityType.ALIVE) {
    // Enqueue (push only if >min) the consumed entity's consumed mass into its top-k scores.
    const highScores = gameState.highScores.get(consumedEntity.entityId) ?? ([] as bigint[]);
    enqueue(highScores, consumedEntity.consumedMass, gameConfig.highScoreTopK);
    gameState.highScores.set(consumedEntity.entityId, highScores);

    // NOTE: Spurious because we're about to remove the entity from state anyway, but whatever:
    consumedEntity.consumedMass = 0n; // Reset the consumed player's consumed mass.

    // SFX LOGIC — NOT PRESENT ON-CHAIN
    {
      if (
        playSfx &&
        consumerEntity.etype == EntityType.WALL &&
        consumedEntity.entityId == playerIdForSfx
      )
        new Audio("sounds/wallHit.wav").play();

      if (
        playSfx &&
        consumerEntity.etype == EntityType.ALIVE &&
        consumedEntity.entityId == playerIdForSfx
      )
        new Audio("sounds/playerEaten.wav").play();

      if (playSfx && consumedEntity.entityId == playerIdForSfx) {
        new Audio("sounds/death.wav").play();
        stopBackgroundMusic();
      }

      if (playSfx && consumerEntity.entityId == playerIdForSfx)
        new Audio("sounds/eatPlayer.wav").play();
    }
  } else if (
    // If the consumed entity was a power pellet and the consumer is a player:
    consumedEntity.etype === EntityType.POWER_PELLET &&
    consumerEntity.etype === EntityType.ALIVE
  ) {
    consumerEntity.lastConsumedPowerPelletTime = wadTime;

    // SFX LOGIC — NOT PRESENT ON-CHAIN
    {
      if (playSfx && consumerEntity.entityId == playerIdForSfx)
        new Audio("sounds/powerPelletEat.wav").play();
    }
  }
  // SFX LOGIC — NOT PRESENT ON-CHAIN:
  else {
    if (
      playSfx &&
      consumerEntity.entityId == playerIdForSfx &&
      consumedEntity.etype == EntityType.FOOD
    )
      new Audio("sounds/eat.wav").play();
  }

  // Remove the entity from state.
  line.splice(
    line.findIndex((e) => e.entityId == consumedEntity.entityId),
    1
  );
}

/*//////////////////////////////////////////////////////////////
                        ENTITY ID HELPERS
//////////////////////////////////////////////////////////////*/

export function toEntityId(seed: bigint): bigint {
  // Add 1 to avoid returning 0, so we're sure
  // 0 means "not set" in the context of the game.
  // We also avoid returning ids over type(uint144).max,
  // so we can reserve that id range for boundary entities.
  return (seed % UINT144_MAX) + 1n;
}

export function leftmostEntityId(line: number) {
  return UINT144_MAX + 1n + BigInt(line); // + 1 to avoid overlap with non-boundary ids.
}

export function rightmostEntityId(line: number) {
  return UINT152_MAX + BigInt(line);
}

export function isRightmostEntity(entityId: bigint) {
  return entityId >= UINT152_MAX;
}

export function isLeftmostEntity(entity: bigint): boolean {
  return isBoundaryEntity(entity) && entity < UINT152_MAX;
}

export function isBoundaryEntity(entityId: bigint) {
  return entityId > UINT144_MAX;
}
