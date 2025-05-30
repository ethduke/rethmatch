import { mapEntityToEmoji } from "./debugging";
import { GameConfig } from "./game/configLib";
import {
  Entity,
  EntityType,
  isRightmostEntity,
  computeX,
  isLeftmostEntity,
  computeDiameter,
} from "./game/entityLib";

export function findBestRightSpawnNeighbor(
  line: Entity[],
  expectedInclusionBlockTimestampWad: bigint,
  gameConfig: GameConfig
) {
  let largestGap = 0n;
  let spawnRightNeighbor: Entity | null = null;

  // prettier-ignore
  line.sort((a, b) => {
    // Sometimes we'll end in cases where the rightmost or leftmost entity ids are not
    // last/first respectively, so we use a big number to ensure they are always last/first.
    const aX = isLeftmostEntity(a.entityId) ? -999999999999999999999999999999999999999999999n :
               isRightmostEntity(a.entityId) ? 999999999999999999999999999999999999999999999n :
               computeX(a, expectedInclusionBlockTimestampWad, gameConfig.velocityCoefficient);
    const bX = isLeftmostEntity(b.entityId) ? -999999999999999999999999999999999999999999999n :
               isRightmostEntity(b.entityId) ? 999999999999999999999999999999999999999999999n :
               computeX(b, expectedInclusionBlockTimestampWad, gameConfig.velocityCoefficient);
    return Number(aX - bX);
  });

  console.log(
    "Line to spawn on:",
    line.map((e) => mapEntityToEmoji(e.entityId) + " " + EntityType[e.etype])
  );

  for (let i = line.length - 1; i >= 0; i--) {
    const rightEntity = line[i];

    // We only care about walls and rightmost entities, as they never disappear from the line.
    if (rightEntity.etype !== EntityType.WALL && !isRightmostEntity(rightEntity.entityId)) continue;

    const rightLeftEdge = computeX(
      rightEntity,
      expectedInclusionBlockTimestampWad,
      gameConfig.velocityCoefficient
    );

    console.log(
      "Left edge of",
      mapEntityToEmoji(rightEntity.entityId),
      rightLeftEdge.fromWad().toFixed(1)
    );

    const closestLeftHostile =
      line
        .slice(0, i)
        .reverse()
        .find((e) => e.etype === EntityType.ALIVE || e.etype === EntityType.WALL) ??
      line.find((e) => isLeftmostEntity(e.entityId));

    console.log(
      "Search set for closest left hostile:",
      line
        .slice(0, i)
        .reverse()
        .map((e) => mapEntityToEmoji(e.entityId) + " " + EntityType[e.etype])
    );

    if (!closestLeftHostile) throw new Error("No closest left hostile found... somehow?"); // Just in case.

    console.log(
      "Closest left hostile of",
      mapEntityToEmoji(rightEntity.entityId),
      "is",
      mapEntityToEmoji(closestLeftHostile?.entityId)
    );

    const leftRightEdge =
      computeX(
        closestLeftHostile,
        expectedInclusionBlockTimestampWad,
        gameConfig.velocityCoefficient
      ) + computeDiameter(closestLeftHostile);

    console.log(
      "Left hostile right edge:",
      mapEntityToEmoji(closestLeftHostile.entityId),
      leftRightEdge.fromWad().toFixed(1)
    );

    const gap = rightLeftEdge - leftRightEdge;

    console.log("Gap:", gap.fromWad().toFixed(1));

    if (gap > largestGap) {
      largestGap = gap;
      spawnRightNeighbor = rightEntity;
    }
  }

  return spawnRightNeighbor;
}
