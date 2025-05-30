// SPDX-License-Identifier: MIT
pragma solidity >=0.8.21;

import "../codegen/index.sol";

import {System} from "@latticexyz/world/src/System.sol";

import {LineLib} from "../utils/LineLib.sol";
import {MinHeapLib} from "../utils/PriorityQueue96x160Lib.sol";

contract UtilitiesSystem is System {
    // For simple bots who aren't going to sync MUD state.
    function getNumLines() public view returns (uint32) {
        return GameState.getNumLines();
    }

    function poke(uint32 line) public {
        require(line < GameState.getNumLines(), "INVALID_LINE");
        MinHeapLib.MemHeap memory currentCollisionQueue = LineLib.getCollisionQueue(line);
        LineLib.processCollisions(line, currentCollisionQueue);
        Line.setCollisionQueue(line, currentCollisionQueue.data);
    }
}
