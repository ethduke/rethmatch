import { BigintMinHeap } from "../bigintMinHeap";
import { PQ96x160 } from "../pq96x160";

export interface GameConfig {
  lineJumpDecayFactor: bigint;

  velocityCoefficient: bigint;

  minFoodMass: bigint;
  maxFoodMass: bigint;
  wallMass: bigint;
  playerStartingMass: bigint;

  lineWidth: bigint;
  consumableSpawnGap: bigint;

  powerPelletEffectTime: bigint;
  powerPelletSpawnOdds: number;

  highScoreTopK: number;
}

export interface GameState {
  numLines: number;
  /////////////////////////////////////
  highScores: Map<bigint, BigintMinHeap>;
  usernames: Map<bigint, string | undefined>;
}

export interface LineState {
  lastTouchedTime: bigint;

  collisionQueue: PQ96x160;
}

export function mapMassToDiameter(mass: bigint): bigint {
  return mass.sqrtWad();
}

export function mapMassToVelocity(mass: bigint, globalVelCoeff: bigint): bigint {
  // 1000000001000000000 = 1.000000001e18, here to avoid negative and 0 outputs.
  return globalVelCoeff.divWad((mass + 1000000001000000000n).log10Wad());
}

export function computeMassAfterJumpingLine(mass: bigint, lineJumpDecayFactor: bigint): bigint {
  return mass.mulWad(lineJumpDecayFactor);
}
