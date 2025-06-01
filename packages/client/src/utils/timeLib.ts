import { WAD } from "./bigint";

export function chainTime(): number {
  return Date.now();
}

// seconds since epoch * 1e18
export function timeWad(): bigint {
  return msToWad(chainTime());
}

export function msToWad(ms: number): bigint {
  return (BigInt(ms) * WAD) / 1000n;
}

export function formatOffset(offset: number): string {
  return (offset >= 0 ? "+" : "") + offset.toFixed(2) + "ms";
}
