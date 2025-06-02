import { Lines } from "./Lines";

import { Column, Row, useWindowSize } from "./utils/chakra";
import { Logo, Robot } from "./utils/icons";
import { Box, Button, Text, Tooltip } from "@chakra-ui/react";
import { InfoOutlineIcon } from "@chakra-ui/icons";

import { LiveState } from "./utils/sync";
import { Countdown } from "./utils/Countdown";
import { GameConfig } from "./utils/game/configLib";

import { sum } from "./utils/bigintMinHeap";
import { SignedIn, SignedOut, SignInButton, useAuth, UserButton } from "@clerk/clerk-react";
import { isAddress } from "viem";
import { useState } from "react";
import { WORLD_ADDRESS } from "./common";
import leaderboardArchive from "./leaderboard-archive.json";

export function GameUI({
  liveState,
  gameConfig,
}: {
  liveState: LiveState;
  gameConfig: GameConfig;
}) {
  const { width } = useWindowSize();
  const isMobile = width < 768;

  const { getToken } = useAuth();

  const [generatingAccessSignature, setGeneratingAccessSignature] = useState(false);

  const generateAccessSignature = async () => {
    setGeneratingAccessSignature(true);

    await new Promise((resolve) => setTimeout(resolve, 50)); // Wait a sec so the loader can show.

    try {
      const address = prompt(
        `🔗 Enter the Odyssey address you want to link your X account to.

📋 See the 'how to get started' section for more information.

🚨 You cannot relink your account to a different address after linking.`,
        "0x..."
      );

      if (!address || !isAddress(address)) {
        alert("Invalid address. Try again.");
        return;
      }

      try {
        const res = await fetch("https://rethmatch-auth.paradigm.xyz/generateAccessSignature", {
          method: "POST",
          body: JSON.stringify({ address }),
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${await getToken()}`,
          },
        }).then((res) => res.json());

        console.log(res);

        if (!res.accessSignature)
          throw new Error("Undefined access signature. Got response: " + JSON.stringify(res));

        prompt(
          `🔏 Copy the access signature linking ${address.slice(0, 4)}...${address.slice(-4)} to your X account below.

📋 See the 'how to get started' section for more information on how to use this.
`,
          res.accessSignature
        );
      } catch (error) {
        alert("Failed to generate access signature: " + error);
        return;
      }
    } finally {
      setGeneratingAccessSignature(false);
    }
  };

  return (
    <>
      <Column
        mainAxisAlignment="flex-start"
        crossAxisAlignment="center"
        height="100%"
        width={{ base: "100%", xl: "80%" }}
        px={8}
      >
        <Row
          mainAxisAlignment={isMobile ? "center" : "flex-start"}
          crossAxisAlignment="center"
          paddingTop="32px"
          width="100%"
        >
          <Box mr={isMobile ? "0px" : "auto"}>
            <Logo height="45px" />
          </Box>

          {isMobile ? null : (
            <>
              <SignedOut>
                <SignInButton>
                  <Button
                    mt={4}
                    backgroundColor="#FF5700"
                    borderRadius="0"
                    height="42px"
                    color="white"
                    p={4}
                    _hover={{ opacity: 0.8 }}
                    _active={{ opacity: 0.35 }}
                  >
                    LOGIN WITH X TO PLAY
                  </Button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <Button
                  mt={4}
                  backgroundColor="#00BCFF"
                  borderRadius="0"
                  height="42px"
                  color="white"
                  p={4}
                  animation={"blinkMild 0.6s infinite ease-out alternate"}
                  _hover={{ opacity: 0.8 }}
                  _active={{ opacity: 0.35 }}
                  onClick={generateAccessSignature}
                  isLoading={generatingAccessSignature}
                >
                  <UserButton /> <Text ml={2}>GENERATE ACCESS SIGNATURE</Text>
                </Button>
              </SignedIn>
            </>
          )}
        </Row>

        {isMobile ? (
          <Text textAlign="center" mt={8}>
            Switch to a computer to sign up.
          </Text>
        ) : null}

        <Row
          mainAxisAlignment="space-between"
          crossAxisAlignment="flex-start"
          width="100%"
          height="100%"
        >
          {!isMobile ? (
            <Column
              mainAxisAlignment="flex-start"
              crossAxisAlignment="center"
              maxWidth="269px"
              minWidth="269px"
              overflow="auto"
              className="disableScrollBar fadeBottom"
              height={`calc(100vh - 109px)`} // paddingTop(32px) + logoBarHeight(45px) + logoBarPaddingTop(32px)
              marginTop="32px"
              mr={8}
            >
              <Box border="1px" borderColor="#1A1A1A" backgroundColor="#0D0D0D" width="100%" p={4}>
                <Text fontSize="sm">
                  RethMatch is an onchain tournament for <u>bots</u>, inspired by Pac-Man and
                  Agar.io, powered by <u>Reth</u>.
                  <br />
                  <br />
                  Grow larger by eating food and avoid hitting a wall or being consumed by a larger
                  player.
                  <br />
                  <br />
                  Check out the resources below for more details.
                </Text>
              </Box>

              <Box
                border="1px"
                borderColor="#1A1A1A"
                backgroundColor="#0D0D0D"
                p={4}
                width="100%"
                mt={4}
              >
                <Text fontWeight="bold" fontSize="lg">
                  COMPETITION LIVE
                </Text>
                <Text fontSize="sm" mt={2} color="#808080">
                  until June 1st, 9pm PT.
                </Text>

                <Box mt={4} p={3} backgroundColor="#1A1A1A" borderRadius="1px" textAlign="center">
                  <Text fontSize="xl" fontWeight="bold" color="#00E893" fontFamily="monospace">
                    <Countdown targetDate="2025-06-01T21:00:00-07:00" />
                  </Text>
                </Box>
              </Box>

              <Box
                border="1px"
                borderColor="#1A1A1A"
                backgroundColor="#0D0D0D"
                p={4}
                width="100%"
                mt={4}
              >
                <Text fontWeight="bold" fontSize="lg">
                  HOW TO GET STARTED
                </Text>

                <Text fontSize="sm" mt={2} mb={1} color="#808080">
                  Read the guide below to learn how to sign up and get started.
                </Text>

                <Button
                  mt={4}
                  backgroundColor="#0D0D0D"
                  borderColor="#00E893"
                  borderWidth="1.5px"
                  borderRadius="0"
                  width="100%"
                  height="42px"
                  color="#00E893"
                  p={4}
                  _hover={{ opacity: 0.8 }}
                  _active={{ opacity: 0.35 }}
                  as="a"
                  href="https://hackmd.io/@t11s/rethmatch"
                  target="_blank"
                >
                  LEARN HOW{" "}
                  <Robot style={{ marginBottom: "2px", fill: "#00FF99", marginLeft: "12px" }} />
                </Button>
              </Box>

              <Box
                border="1px"
                borderColor="#1A1A1A"
                backgroundColor="#0D0D0D"
                p={4}
                width="100%"
                mt={4}
                mb={4}
              >
                <Text fontWeight="bold" fontSize="lg">
                  QUICK LINKS
                </Text>

                <Box mt={3}>
                  <Text fontSize="sm" color="#808080" mb={2}>
                    •{" "}
                    <Text
                      as="a"
                      href="https://github.com/paradigmxyz/rethmatch"
                      target="_blank"
                      color="#00E893"
                      _hover={{ opacity: 0.8 }}
                      textDecoration="underline"
                    >
                      Github
                    </Text>
                  </Text>

                  <Text fontSize="sm" color="#808080" mb={2}>
                    •{" "}
                    <Text
                      as="a"
                      href="https://x.com/transmissions11/status/1928529682116513798"
                      target="_blank"
                      color="#00E893"
                      _hover={{ opacity: 0.8 }}
                      textDecoration="underline"
                    >
                      X/Twitter
                    </Text>
                  </Text>

                  <Text fontSize="sm" color="#808080">
                    •{" "}
                    <Text
                      as="a"
                      href={`https://odyssey-explorer.ithaca.xyz/address/${WORLD_ADDRESS}`}
                      target="_blank"
                      color="#00E893"
                      _hover={{ opacity: 0.8 }}
                      textDecoration="underline"
                    >
                      Contract
                    </Text>
                  </Text>
                </Box>
              </Box>
            </Column>
          ) : null}

          <Lines liveState={liveState} gameConfig={gameConfig} />
        </Row>
      </Column>

      <Column
        mainAxisAlignment="flex-start"
        crossAxisAlignment="center"
        height="100%"
        width="20%"
        borderLeft="1px"
        borderColor="#1A1A1A"
        display={{ base: "none", xl: "flex" }}
      >
        <Row
          mainAxisAlignment="space-between"
          crossAxisAlignment="center"
          height="65px"
          width="100%"
          borderBottom="1px"
          borderColor="#1A1A1A"
          px={8}
          color="#808080"
        >
          <Text fontWeight="bold">Player</Text>
          <Tooltip
            label={`Sum of your top ${gameConfig.highScoreTopK} lifetime scores. Each lifetime score = total mass consumed during that life.`}
            bg="#262626"
            fontFamily="BerkeleyMono, monospace"
            hasArrow
            mr={3}
            boxShadow="0 0 5px #262626"
          >
            <Text>Overall Score {width < 1440 ? null : <InfoOutlineIcon mb="3px" />}</Text>
          </Tooltip>
        </Row>

        <Column
          mainAxisAlignment="flex-start"
          crossAxisAlignment="center"
          height="100%"
          width="100%"
          overflowY="auto"
          className="disableScrollBar fadeBottom"
        >
          {(() => {
            const playerScores = new Map<string, bigint[]>();

            // Start by populating with current scores.
            Array.from(liveState.gameState.highScores).forEach(([entityId, highScores]) => {
              const username = liveState.gameState.usernames.get(entityId);
              if (!username) throw new Error("Username not found for entityId: " + entityId);
              playerScores.set(username, highScores as bigint[]);
            });

            // Incorporate archived scores.
            leaderboardArchive.forEach(({ username, highScores }) => {
              const current = playerScores.get(username) || [];
              const archived = highScores.map((score) => BigInt(score));
              playerScores.set(username, [...current, ...archived]);
            });

            // Convert to array, calculate total scores, filter and sort.
            return Array.from(playerScores.entries())
              .map(([username, allScores]) => {
                const playerTopKScores = allScores
                  .sort((a, b) => Number(b - a))
                  .slice(0, gameConfig.highScoreTopK);

                return { username, totalScore: Math.floor(sum(playerTopKScores).fromWad()) };
              })
              .filter((player) => player.totalScore > 0)
              .sort((a, b) => b.totalScore - a.totalScore)
              .map(({ username, totalScore }) => (
                <Row
                  key={username}
                  mainAxisAlignment="space-between"
                  crossAxisAlignment="center"
                  width="100%"
                  minHeight="50px"
                  borderBottom="1px"
                  borderColor="#1A1A1A"
                  px={8}
                  _hover={{
                    backgroundColor: "#0D0D0d",
                  }}
                >
                  <Text color={"white"}>{username}</Text>
                  <Text color={"#FF5700"}>{totalScore.toLocaleString()}</Text>
                </Row>
              ));
          })()}
        </Column>
      </Column>
    </>
  );
}
