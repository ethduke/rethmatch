import "dotenv/config";
import cliProgress from "cli-progress";
import { http, fallback, webSocket, createPublicClient } from "viem";
import { Entity } from "../../client/src/utils/game/entityLib";
import { forwardStateTo, LiveState, parseSyncStateGivenTables } from "../../client/src/utils/sync";
import { GameConfig } from "../../client/src/utils/game/configLib";

import { stash } from "../../client/src/mud/stash";
import { getRecord, getTable, Stash } from "@latticexyz/stash/internal";
import { SyncProgress, syncToStash } from "@latticexyz/store-sync/internal";
import { ODYSSEY_CHAIN } from "../../client/src/utils/chains";
import Worlds from "../../contracts/worlds.json";

const chain = ODYSSEY_CHAIN;
const WORLD_ADDRESS = Worlds[chain.id]?.address as `0x${string}`;
if (!WORLD_ADDRESS) throw new Error(`No world address found for chain ${chain.id}`);
const START_BLOCK = Worlds[chain.id]!.blockNumber!;

const publicClient = createPublicClient({
  chain,
  transport: fallback([webSocket(), http()]),
  pollingInterval: 100,
  cacheTime: 100,
});

const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

function botDecision(
  liveState: LiveState,
  gameConfig: GameConfig,
  wadTime: bigint
): [string, string] {
  // TODO
  return ["up", "right"]; // [vertical, horizontal]
}

export async function main() {
  const { storedBlockLogs$ } = await syncToStash({
    stash: stash as Stash,
    startSync: true,
    address: WORLD_ADDRESS,
    startBlock: BigInt(START_BLOCK ?? 0),
    publicClient: publicClient as any,
    indexerUrl: chain.indexerUrl,
  });

  // Initialize progress bar
  progressBar.start(100, 0);

  storedBlockLogs$.subscribe(() => {
    const { syncProgress, data } = parseSyncStateGivenTables(stash.get());

    if (syncProgress.step === "live" && data) {
      if (progressBar.isActive) {
        progressBar.update(100);
        progressBar.stop();
        console.log("Caught up!");
      }

      const { gameConfig, lines, lineStates, gameState } = data;

      const syncedState = {
        lastSyncedTime,
        lastProcessedTime: -1n,
        lines: data.lines,
        lineStates: data.lineStates,
        gameState: data.gameState,
      };

      const liveState = forwardStateTo(syncedState, gameConfig, false, null, {
        stopAtIteration: 99999999999999,
        stopAtTimestampWad: null,
      });

      console.log("Got block!", Number(syncProgress.latestBlockNumber));

      const [vertical, horizontal] = botDecision(liveState, gameConfig, wadTime);
    } else {
      if (syncProgress.step === "snapshot") progressBar.update(0);
      else progressBar.update(Math.round(syncProgress.percentage));
    }
  });
}

console.log("Starting bot... (this may take a couple seconds)", WORLD_ADDRESS, START_BLOCK);
console.log();
await main();
