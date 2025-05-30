import { WAGMI_CONFIG, CHAIN_ID } from "../common";
import { WAD } from "./bigint";

export let CHAIN_TIMESTAMP_OFFSET_MS = { value: Number.MIN_SAFE_INTEGER };
export let ONE_WAY_LATENCY_ESTIMATE_MS = { value: Number.MIN_SAFE_INTEGER };

// chain time is offset by however many ms from the turn of the second
// the genesis block of the chain was mined at, as block timestamp is
// rounded down to seconds. also accounts for device clock being off.
export function chainTime(): number {
  return Date.now() + CHAIN_TIMESTAMP_OFFSET_MS.value;
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

async function syncClockOffset() {
  const computeClockOffset = async () => {
    // See: https://en.wikipedia.org/wiki/Network_Time_Protocol#Clock_synchronization_algorithm

    const t0 = performance.now(); // ≈ timestamp of request packet transmission.
    let { current_wall_time_ms, last_block_timestamp, last_block_wall_time_ms } =
      (await WAGMI_CONFIG.getClient({ chainId: CHAIN_ID }).request({
        method: "odyssey_getWallTimeData" as any,
      })) as {
        current_wall_time_ms: number;
        last_block_timestamp: number;
        last_block_wall_time_ms: number;
      };

    // We use performance.now() to measure round trip time because it's more accurate
    // than Date.now() and not impacted by user clock adjustments, clock skew, etc.
    const [oneWayLatencyEstimate, clientTime] = [(performance.now() - t0) / 2, Date.now()];

    const [chainOffset, systemOffset] = [
      last_block_timestamp * 1000 - last_block_wall_time_ms,
      current_wall_time_ms - clientTime + oneWayLatencyEstimate,
    ];

    return {
      netClockOffset: systemOffset + chainOffset,
      systemOffset,
      chainOffset,
      oneWayLatencyEstimate,
    };
  };

  if (CHAIN_ID === 31337) {
    console.log("Using local node, setting clock offset to 0.");
    CHAIN_TIMESTAMP_OFFSET_MS.value = 0;
    ONE_WAY_LATENCY_ESTIMATE_MS.value = 0;
  } else {
    try {
      for (let attempts = 0; attempts < 5; attempts++) {
        const { netClockOffset, systemOffset, oneWayLatencyEstimate } = await computeClockOffset();

        // If the estimated one way latency estimate was less than 100ms, we'll accept the measurement.
        if (oneWayLatencyEstimate < 100) {
          CHAIN_TIMESTAMP_OFFSET_MS.value = Math.floor(netClockOffset);
          ONE_WAY_LATENCY_ESTIMATE_MS.value = Math.floor(oneWayLatencyEstimate);

          console.log("🕙 Net clock offset:", formatOffset(netClockOffset));
          console.log("-> System offset:", formatOffset(systemOffset));
          console.log("-> Chain offset:", formatOffset(netClockOffset - systemOffset));
          console.log("💨 One-way latency estimate:", oneWayLatencyEstimate.toFixed(2) + "ms\n");

          return;
        }

        // If it was longer, we'll try again, hopefully was just a transient issue.
        console.log("Round trip took dangerously long, retrying...");
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // If we've reached this point, the round trip to the timeserver consistently took
      // more than 150ms. This level of latency makes it difficult to trust the accuracy of
      // the clock offset sync. A bad sync can make the game unplayable. We'll alert the user.
      console.warn("Network has really high latency, alerting user...");
      alert(`🕖 Your network has significant latency (>150ms).

👾 This will heavily degrade game performance and/or cause glitches.

🛜 Try switching networks, disabling any VPNs, and/or restarting your computer.

🔄 Refresh the page to try again.`);
    } catch (error) {
      console.error("Clock offset sync failed:", error);
    }
  }
}

setTimeout(syncClockOffset, 500); // Run once quickly at the start to set the offset.
setTimeout(syncClockOffset, 15000); // Run again after 15s since initial reading is often bad.
setInterval(syncClockOffset, 1 * 60 * 1000); // Run again every 1 minute(s) to deal with any skew.
