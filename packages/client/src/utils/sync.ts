import { BigintMinHeap } from "./bigintMinHeap";
import { GameState, GameConfig, LineState } from "./game/configLib";
import { Entity } from "./game/entityLib";
import { processCollisions } from "./game/lineLib";
import { heapifyPacked } from "./pq96x160";
import { timeWad } from "./timeLib";
import { getRecord, getRecords, State } from "@latticexyz/stash/internal";
import {
  initialProgress,
  SyncProgress as SyncProgressTable,
} from "@latticexyz/store-sync/internal";

import raw_config from "contracts/mud.config";
// For some reason when importing config in Node.js, instead of just
// being the object, it's wrapped in an object with a `default` property.
const config = "default" in raw_config ? (raw_config.default as typeof raw_config) : raw_config;

// Must be idempotent / deterministic with respect to the state.
export function parseSyncStateGivenTables(state: State<typeof config>) {
  const syncProgress: {
    step: string;
    message: string;
    percentage: number;
    latestBlockNumber: bigint;
    lastBlockNumberProcessed: bigint;
  } = getRecord({
    state,
    table: SyncProgressTable,
    key: {},
    defaultValue: initialProgress,
  });

  if (syncProgress.step !== "live")
    return {
      syncProgress,
      data: undefined,
    };

  const [rawGameState, gameConfig] = [
    getRecord({ state, table: config.tables.GameState, key: {} }) as GameState,
    getRecord({ state, table: config.tables.GameConfig, key: {} }) as GameConfig,
  ];

  const highScores = new Map<bigint, BigintMinHeap>(); // Will be put into GameState.
  Object.values(getRecords({ state, table: config.tables.Player })).forEach((record) => {
    highScores.set(record.entityId, record.highScores);
  });
  const usernames = new Map<bigint, string | undefined>(); // Will be put into GameState.
  Object.values(getRecords({ state, table: config.tables.UsernameOffchain })).forEach((record) => {
    usernames.set(record.entityId, record.username);
  });

  // Many tables share the same key schema, so we'll merge them by entityId for simplicity.
  const flatEntities: Entity[] = Object.values(
    getRecords({ state, table: config.tables.Entity })
  ).map((record) => {
    const entityId = record.entityId;
    return {
      entityId,
      etype: record.etype,
      mass: record.mass,
      velMultiplier: record.velMultiplier,
      lineId: record.lineId,
      lastX: record.lastX,
      lastTouchedTime: record.lastTouchedTime,
      leftNeighbor: record.leftNeighbor,
      rightNeighbor: record.rightNeighbor,
      // This is not actually in this table, but it's simpler to just put it in here:
      lastConsumedPowerPelletTime:
        getRecord({ state, table: config.tables.Player, key: { entityId } })
          ?.lastConsumedPowerPelletTime ?? 0n,
      consumedMass:
        getRecord({ state, table: config.tables.Player, key: { entityId } })?.consumedMass ?? 0n,
    };
  });
  // Reshape flat entities into a multi-dimensional array, where each sub-array is a lineId.
  const lines = flatEntities.reduce((acc, record) => {
    if (!acc[record.lineId]) acc[record.lineId] = [];
    acc[record.lineId].push(record);
    return acc;
  }, [] as Entity[][]);
  const lineStates = Object.values(getRecords({ state, table: config.tables.Line }))
    .sort((a, b) => a.lineId - b.lineId) // This is crucial for the order of lines to be consistent!
    .map((q) => ({
      ...q,
      collisionQueue: heapifyPacked(q.collisionQueue),
      // This is not actually in this table, but it's simpler to just put it in here:
      lastTouchedTime:
        getRecord({ state, table: config.tables.LineOffchain, key: { lineId: q.lineId } })
          ?.lastTouchedTime ?? 0n,
    })) as LineState[];

  return {
    syncProgress,
    data: {
      gameState: {
        ...rawGameState,
        highScores, // Add highScores to GameState.
        usernames, // Add usernames to GameState.
      },
      gameConfig,
      lines,
      lineStates,
    },
  };
}

export type LiveState = {
  lastSyncedTime: number;
  lastProcessedTime: bigint;
  lines: Entity[][];
  lineStates: LineState[];
  gameState: GameState;
};

export function forwardStateTo(
  prevState: LiveState,
  gameConfig: GameConfig,
  playSfx: boolean,
  playerIdForSfx: bigint | null,
  options: { stopAtIteration: number | null; stopAtTimestampWad: bigint | null }
): LiveState {
  const { stopAtIteration, stopAtTimestampWad } = options;

  let newState = structuredClone(prevState);

  let lastCollisionTime = -1n; // For debugging.
  for (let i = 0; i < newState.lines.length; i++) {
    lastCollisionTime = processCollisions(
      newState.lines[i],
      newState.gameState,
      gameConfig,
      newState.lineStates[i],
      playSfx,
      playerIdForSfx,
      {
        stopAtIteration,
        stopAtTimestampWad,
      }
    );
  }

  return {
    ...newState,
    lastProcessedTime:
      stopAtIteration == null ? stopAtTimestampWad ?? timeWad() : lastCollisionTime,
  };
}
