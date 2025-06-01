// SPDX-License-Identifier: MIT
pragma solidity >=0.8.21;

import {Script} from "forge-std/Script.sol";
import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";

import {ConfigLib} from "../src/utils/ConfigLib.sol";

import "../src/codegen/index.sol";

contract BalanceChanges is Script {
    function run(address worldAddress) external {
        // Set PRIVATE_KEY environment variable in .env file.
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));

        StoreSwitch.setStoreAddress(worldAddress); // Must be called to use stores directly in scripts.

        uint96 newMaxFoodMass = 256e18 * 3;
        uint96 newMinFoodMass = 32e18 * 3;
        uint64 newLineJumpDecayFactor = 0.75e18;

        require(
            GameConfig.getConsumableSpawnGap() > 3 * ConfigLib.mapMassToDiameter(newMaxFoodMass),
            "FOOD_SPAWN_GAP_TOO_LOW"
        ); // Must be at least 2x for power pellets.

        GameConfig.setMinFoodMass(newMinFoodMass);
        GameConfig.setMaxFoodMass(newMaxFoodMass);
        GameConfig.setLineJumpDecayFactor(newLineJumpDecayFactor);

        vm.stopBroadcast();
    }
}
