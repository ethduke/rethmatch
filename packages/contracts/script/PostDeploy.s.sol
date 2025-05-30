// SPDX-License-Identifier: MIT
pragma solidity >=0.8.21;

import {Script} from "forge-std/Script.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";

import {IWorld} from "../src/codegen/world/IWorld.sol";

import {timeWad} from "../src/utils/WadTimeLib.sol";
import {EntityLib} from "../src/utils/EntityLib.sol";
import {ConfigLib} from "../src/utils/ConfigLib.sol";

import "../src/codegen/index.sol";

contract PostDeploy is Script {
    function run(address worldAddress) external {
        // Set PRIVATE_KEY environment variable in .env file.
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));

        StoreSwitch.setStoreAddress(worldAddress); // Must be called to use stores directly in scripts.

        uint64 lineJumpDecayFactor = 0.9e18; // 1e18 = no decay.

        uint96 velocityCoefficient = 315e18;

        uint96 minFoodMass = 32e18 * 1;
        uint96 maxFoodMass = 256e18 * 1;
        uint96 wallMass = 9e18;
        uint96 playerStartingMass = 1600e18;

        uint128 lineWidth = 1000e18;
        uint128 consumableSpawnGap = lineWidth / 5;
        require(consumableSpawnGap > 3 * ConfigLib.mapMassToDiameter(maxFoodMass), "FOOD_SPAWN_GAP_TOO_LOW"); // Must be at least 2x for power pellets.

        uint96 powerPelletEffectTime = 10e18; // 10 seconds.
        uint32 powerPelletSpawnOdds = 50; // 1 in 50 consumables.

        uint8 highScoreTopK = 10;

        address accessSigner = 0x518df905D5E7E7C74B41f178fB078ea028A79cC3;

        GameConfig.set(
            GameConfigData({
                lineJumpDecayFactor: lineJumpDecayFactor,
                /////////////////////////////////////////
                velocityCoefficient: velocityCoefficient,
                /////////////////////////////////////////
                minFoodMass: minFoodMass,
                maxFoodMass: maxFoodMass,
                wallMass: wallMass,
                playerStartingMass: playerStartingMass,
                /////////////////////////////////////////
                lineWidth: lineWidth,
                consumableSpawnGap: consumableSpawnGap,
                /////////////////////////////////////////
                powerPelletEffectTime: powerPelletEffectTime,
                powerPelletSpawnOdds: powerPelletSpawnOdds,
                ////////////////////////////////////////
                highScoreTopK: highScoreTopK,
                ////////////////////////////////////////
                accessSigner: accessSigner
            })
        );

        // Needed to ensure reproducible invariant failures.
        if (vm.envOr("FORCE_DETERMINISTIC_TIMESTAMP", false)) {
            vm.warp(9999999999);
            vm.rpc("evm_setNextBlockTimestamp", '["9999999999"]');
        }

        IWorld(worldAddress).addLines(4);

        vm.stopBroadcast();
    }
}
