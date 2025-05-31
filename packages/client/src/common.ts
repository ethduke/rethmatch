import { createClient, fallback, http, webSocket } from "viem";
import { createConfig, Config } from "wagmi";
import { QueryClient } from "@tanstack/react-query";
import { ODYSSEY_CHAIN } from "./utils/chains";

export const CHAIN_ID = import.meta.env.CHAIN_ID!;
export const WORLD_ADDRESS = import.meta.env.WORLD_ADDRESS!;
export const START_BLOCK = BigInt(import.meta.env.START_BLOCK ?? 0n);
export const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!CHAIN_ID || !WORLD_ADDRESS || !START_BLOCK)
  throw new Error("Core environment variables are not set!");

export const WAGMI_CONFIG: Config = createConfig({
  chains: [ODYSSEY_CHAIN],
  client: ({ chain }) =>
    createClient({
      chain,
      transport: fallback([http()]),
      pollingInterval: 500,
      cacheTime: 100,
    }),
});

export const QUERY_CLIENT = new QueryClient();
