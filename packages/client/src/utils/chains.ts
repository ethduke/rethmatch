import { defineChain } from "viem";

export const ODYSSEY_CHAIN = defineChain({
  id: 911867,
  name: "Odyssey",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: ["https://odyssey.ithaca.xyz"],
      webSocket: ["wss://odyssey.ithaca.xyz"],
    },
  },
  indexerUrl: "https://rethmatch-indexer.paradigm.xyz",
});
