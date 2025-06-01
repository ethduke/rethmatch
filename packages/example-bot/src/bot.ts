import "dotenv/config";
import { http, fallback, webSocket, createPublicClient } from "viem";
import { Entity } from "../../client/src/utils/game/entityLib";
import { LiveState } from "../../client/src/utils/sync";
import { GameConfig } from "../../client/src/utils/game/configLib";

import { stash } from "../../client/src/mud/stash";
import { Stash } from "@latticexyz/stash/internal";
import { syncToStash } from "@latticexyz/store-sync/internal";
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

function botDecision(
  bot: Entity,
  liveState: LiveState,
  gameConfig: GameConfig,
  decision: "vertical" | "horizontal",
  wadTime: bigint
): [string, string] {
  // TODO
  return ["up", "right"];
}

export async function main() {
  syncToStash({
    stash: stash as Stash,
    startSync: true,
    address: WORLD_ADDRESS,
    startBlock: BigInt(START_BLOCK ?? 0),
    publicClient: publicClient as any,
    indexerUrl: chain.indexerUrl,
  });
}

console.log("Starting bot...", WORLD_ADDRESS, START_BLOCK);
await main();
