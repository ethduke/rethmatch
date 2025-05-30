import { parseSyncStateGivenTables } from "./utils/sync";
import { Game } from "./Game";
import { Column, Row } from "./utils/chakra";
import { Logo } from "./utils/icons";
import { Text } from "@chakra-ui/react";
import { useStash } from "@latticexyz/stash/react";
import { stash } from "./mud/stash";
import fastDeepEqual from "fast-deep-equal";

export const App = () => {
  const { syncProgress, data } = useStash(stash, parseSyncStateGivenTables, {
    isEqual: fastDeepEqual, // TODO: Can maybe speed up by just looking at syncProgress?
  });

  const lastSyncedTime = performance.now();

  if (syncProgress.step === "live")
    console.log("[!] Caught up to live at:", Number(lastSyncedTime.toFixed(1)));

  return (
    <Row
      mainAxisAlignment="flex-start"
      crossAxisAlignment="center"
      height="100vh"
      width="100%"
      color="white"
      fontFamily="BerkeleyMono, monospace"
    >
      {!data ? (
        <Column crossAxisAlignment="center" mainAxisAlignment="center" expand>
          <Logo height="55px" />
          <Text fontSize="3xl" mt={6}>
            Syncing
            <span className="dot-1">.</span>
            <span className="dot-2">.</span>
            <span className="dot-3">.</span>{" "}
            <b>
              {syncProgress.message === "Got snapshot" ||
              syncProgress.message === "Failed to get snapshot"
                ? "0.0"
                : syncProgress.percentage.toFixed(1)}
            </b>
            %
          </Text>
        </Column>
      ) : (
        <Game
          syncedState={{
            lastSyncedTime,
            lastProcessedTime: -1n,
            lines: data.lines,
            lineStates: data.lineStates,
            gameState: data.gameState,
          }}
          gameConfig={data.gameConfig}
        />
      )}
    </Row>
  );
};
