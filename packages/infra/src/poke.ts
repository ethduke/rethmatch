import { createPublicClient, http, fallback, webSocket, createWalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import "dotenv/config";

import IWorldAbi from "../../contracts/out/IWorld.sol/IWorld.abi.json";
import Worlds from "../../contracts/worlds.json";

import { ODYSSEY_CHAIN } from "../../client/src/utils/chains";
const chain = ODYSSEY_CHAIN;
const WORLD_ADDRESS = Worlds[chain.id]?.address as `0x${string}`;
if (!WORLD_ADDRESS) {
  throw new Error(`No world address found for chain ${chain.id}`);
}

const publicClient = createPublicClient({
  chain,
  transport: fallback([webSocket(), http()]),
  pollingInterval: 100,
  cacheTime: 100,
});

const privateKey = process.env.POKING_PRIVATE_KEY as `0x${string}`;
if (!privateKey) {
  throw new Error("POKING_PRIVATE_KEY is not set");
}

const account = privateKeyToAccount(privateKey);

console.log(
  "Poking account address:",
  account.address,
  "balance:",
  await publicClient.getBalance({ address: account.address })
);

const client = createWalletClient({
  account,
  chain,
  transport: fallback([webSocket(), http()]),
});

console.log("\n-------- USING CHAIN:", client.chain.name, "--------\n");
console.log("WORLD_ADDRESS:", WORLD_ADDRESS);

process.on("SIGINT", () => {
  console.log("Keyboard interruption detected. Exiting gracefully...");
  process.exit();
});

async function getNumLines() {
  const numLines = await publicClient
    // @ts-ignore
    .readContract({
      address: WORLD_ADDRESS,
      abi: IWorldAbi,
      functionName: "getNumLines",
    })
    .catch((error) => {
      console.error("❌ Error getting number of lines:", stripViemErrorOfABI(error));
      process.exit(1);
    });

  return numLines;
}

let numLines = -1; // Will be set in the first iteration below.

for (let iteration = 0; ; iteration++) {
  if (iteration % 5 === 0) {
    numLines = await getNumLines();

    publicClient.getBalance({ address: account.address }).then((balance) => {
      console.log("\n💰 Balance remaining:", (Number(balance) / 1e18).toFixed(2), "eth\n");
    });
  }

  console.log("\n--------------------------------------------\n");

  for (let line = 0; line < numLines; line++) {
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Sleep.

      const tx = await client.writeContract({
        address: WORLD_ADDRESS,
        abi: IWorldAbi,
        functionName: "poke",
        args: [line],
        gas: 29_000_000n,
      });

      console.log("📤 Poking line:", line);

      publicClient
        .waitForTransactionReceipt({
          hash: tx,
        })
        .then((receipt) => {
          console.log(
            "⛽️ Line",
            line,
            "poked — gas used:",
            Number(receipt.gasUsed).toLocaleString()
          );

          if (receipt.status === "reverted") {
            console.log("❌ Line", line, "reverted");
          }
        })
        .catch((error) => {
          console.error("❌ Error poking line", line, ":", stripViemErrorOfABI(error));
        });
    } catch (error) {
      console.error("❌ Error poking line", line, ":", stripViemErrorOfABI(error));
    }
  }
}

// Errors can get really long without this.
function stripViemErrorOfABI(error: any) {
  return error.toString().split("abi: [")[0];
}
