import { useState } from "react";

import { GameConfig } from "./utils/game/configLib";
import { DEBUG_ITER, DEBUG_LINE, DEBUG_PERF } from "./utils/debugging";
import { useInterval } from "./utils/hooks";
import { GameUI } from "./GameUI";
import { Column } from "./utils/chakra";
import { Text } from "@chakra-ui/react";
import { Logo } from "./utils/icons";
import { LiveState, forwardStateTo } from "./utils/sync";
import { useAccount } from "wagmi";
import { toEntityId } from "./utils/game/entityLib";

export function Game({
  syncedState,
  gameConfig,
}: {
  syncedState: LiveState;
  gameConfig: GameConfig;
}) {
  if (DEBUG_LINE != null && syncedState.lines.length > 1) {
    if (Number.isNaN(DEBUG_LINE)) alert("DEBUG_LINE is NaN");
    syncedState.lines = [syncedState.lines[DEBUG_LINE]];
    syncedState.lineStates = [syncedState.lineStates[DEBUG_LINE]];
  }

  const { address: userAddress } = useAccount();

  const [liveState, setLiveState] = useState<LiveState>(syncedState);

  useInterval(
    () => {
      setLiveState((prevState) => {
        if (DEBUG_PERF === 2) console.time("Interval");

        const isNewSyncedState = prevState.lastSyncedTime != syncedState.lastSyncedTime;

        let newState = isNewSyncedState ? structuredClone(syncedState) : prevState;

        if (isNewSyncedState) {
          for (let i = 0; i < newState.lines.length; i++) {
            // Re-use current state for the line if the last touched time for the
            // line hasn't changed since last sync. Avoids needless re-processing.
            if (newState.lineStates[i].lastTouchedTime == prevState.lineStates[i].lastTouchedTime) {
              newState.lines[i] = structuredClone(prevState.lines[i]);
              newState.lineStates[i] = structuredClone(prevState.lineStates[i]);
            } else {
              console.log("Re-syncing line #", i);
            }
          }
        }

        newState = forwardStateTo(
          newState,
          gameConfig,
          !!userAddress && !isNewSyncedState && newState.lastProcessedTime > 0n,
          userAddress ? toEntityId(BigInt(userAddress)) : null,
          {
            stopAtIteration: DEBUG_ITER, // Will likely be null, if so goes to 99999999999999.
            stopAtTimestampWad: null, // Will use timeWad() if null.
          }
        );

        if (DEBUG_PERF === 2) console.timeEnd("Interval");

        return newState;
      });
    },
    DEBUG_PERF != 1 && DEBUG_ITER == null ? 15 : null // For debugging.
  );

  return liveState.lastProcessedTime > 0n ? (
    <GameUI liveState={liveState} gameConfig={gameConfig} />
  ) : (
    <Column crossAxisAlignment="center" mainAxisAlignment="center" expand>
      <Logo height="55px" />
      <Text fontSize="3xl" mt={6}>
        Catching up
        <span className="dot-1">.</span>
        <span className="dot-2">.</span>
        <span className="dot-3">.</span>
      </Text>
    </Column>
  );
}
