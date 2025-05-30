// @ts-ignore
import { defineWorld } from "@latticexyz/world";

export default defineWorld({
  enums: {
    EntityType: ["DEAD", "ALIVE", "FOOD", "WALL", "POWER_PELLET"],
  },
  tables: {
    GameConfig: {
      key: [], // Singleton.
      schema: {
        // 64 bits because the decay factor will
        // be <1 (1e18), and 2**64 - 1 is ~1.8e19.
        lineJumpDecayFactor: "uint64",

        velocityCoefficient: "uint96",

        minFoodMass: "uint96",
        maxFoodMass: "uint96",
        wallMass: "uint96",
        playerStartingMass: "uint96",

        lineWidth: "uint128",
        consumableSpawnGap: "uint128",

        powerPelletEffectTime: "uint96",
        powerPelletSpawnOdds: "uint32",

        highScoreTopK: "uint8",

        accessSigner: "address",
      },
    },

    GameState: {
      key: [], // Singleton.
      schema: {
        numLines: "uint32",
      },
    },

    Line: {
      key: ["lineId"],
      schema: {
        lineId: "uint32",

        collisionQueue: "uint256[]", // will be managed via PriorityQueue96x160Lib
      },
    },

    Player: {
      key: ["entityId"],
      schema: {
        entityId: "uint160",

        consumedMass: "uint128",
        // We overload the purpose of this field to both manage access and to prevent spamming.
        lastJumpBlockNumber: "uint32", // Spawning counts as a jump.
        lastConsumedPowerPelletTime: "uint96",
        highScores: "uint256[]", // will be managed via solady/MinHeapLib
      },
    },

    Entity: {
      key: ["entityId"],
      schema: {
        entityId: "uint160",

        etype: "EntityType",

        mass: "uint128",

        velMultiplier: "int128",

        lineId: "uint32",
        // Note: lastX is the x position of the *left edge* of the entity.
        lastX: "uint128", // Add diameter (computed via mass) for right edge.
        lastTouchedTime: "uint96",
        leftNeighbor: "uint160",
        rightNeighbor: "uint160",
      },
    },

    UsernameHash: {
      key: ["usernameHash"],
      schema: {
        usernameHash: "bytes32",

        taken: "bool", // To prevent registering multiple addresses under the same username.
      },
    },

    // Offchain tables are just for users/clients,
    // just emits an event the MUD indexer tracks.
    LineOffchain: {
      key: ["lineId"],
      schema: {
        lineId: "uint32",

        lastTouchedTime: "uint96",
      },
      type: "offchainTable",
    },
    UsernameOffchain: {
      key: ["entityId"],
      schema: {
        entityId: "uint160",

        username: "string",
      },
      type: "offchainTable",
    },
  },
  systems: {
    AdminSystem: {
      openAccess: false,
    },
  },
});
