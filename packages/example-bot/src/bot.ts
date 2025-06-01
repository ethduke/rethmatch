import "dotenv/config";
import cliProgress from "cli-progress";
import { http, fallback, webSocket, createPublicClient } from "viem";

import { forwardStateTo, LiveState, parseSyncStateGivenTables } from "../../client/src/utils/sync";
import { EntityType } from "../../client/src/utils/game/entityLib";
import { GameConfig } from "../../client/src/utils/game/configLib";
import { stash } from "../../client/src/mud/stash";
import { timeWad } from "../../client/src/utils/timeLib";
import { ODYSSEY_CHAIN } from "../../client/src/utils/chains";

import { syncToStash } from "@latticexyz/store-sync/internal";
import { Stash } from "@latticexyz/stash/internal";

import Worlds from "../../contracts/worlds.json";

const chain = ODYSSEY_CHAIN;
const WORLD_ADDRESS = Worlds[chain.id]?.address as `0x${string}`;
if (!WORLD_ADDRESS) throw new Error(`No world address found for chain ${chain.id}`);
const START_BLOCK = Worlds[chain.id]!.blockNumber!;

function onBlock(liveState: LiveState, gameConfig: GameConfig, wadTime: bigint) {
  const { lines, gameState } = liveState;

  // <Do something with the processed game state here>

  // Demo: Visualize each line by printing players with their usernames.
  lines.forEach((line, idx) => {
    const players = line
      .filter(
        (entity) => entity.etype === EntityType.ALIVE && gameState.usernames.has(entity.entityId)
      )
      .map((entity) => {
        return gameState.usernames.get(entity.entityId);
      });

    console.log(
      `Line ${idx} has players: ${players.length > 0 ? players.join(", ") : "No players"}`
    );
  });
}

export async function main() {
  const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  const { storedBlockLogs$ } = await syncToStash({
    stash: stash as Stash,
    startSync: true,
    address: WORLD_ADDRESS,
    startBlock: BigInt(START_BLOCK ?? 0),
    publicClient: createPublicClient({
      chain,
      transport: fallback([webSocket(), http()]),
      pollingInterval: 100,
      cacheTime: 100,
    }),
    indexerUrl: chain.indexerUrl,
  });
  progressBar.start(100, 0);

  storedBlockLogs$.subscribe(() => {
    const { syncProgress, data } = parseSyncStateGivenTables(stash.get());

    if (syncProgress.step === "live" && data) {
      if (progressBar.isActive) {
        progressBar.update(100);
        progressBar.stop();
        console.log("\n✅Caught up!");
      }

      const syncedState = {
        lastSyncedTime: performance.now(),
        lastProcessedTime: -1n,
        lines: data.lines,
        lineStates: data.lineStates,
        gameState: data.gameState,
      };

      const liveState = forwardStateTo(syncedState, data.gameConfig, false, null, {
        stopAtIteration: null,
        stopAtTimestampWad: null,
      });

      console.log("\n📥 Got block:", Number(syncProgress.latestBlockNumber), "\n");

      onBlock(liveState, data.gameConfig, timeWad());
    } else {
      if (syncProgress.step === "snapshot") progressBar.update(0);
      else progressBar.update(Math.round(syncProgress.percentage));
    }
  });
}

console.log("🤖 Starting bot... (this may take a couple seconds)", WORLD_ADDRESS, START_BLOCK);
console.log();
await main();
