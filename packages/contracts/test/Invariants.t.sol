// SPDX-License-Identifier: MIT
pragma solidity >=0.8.21;

import {console2} from "forge-std/console2.sol";

import {MudTest} from "@latticexyz/world/test/MudTest.t.sol";

import "../src/codegen/index.sol";
import "../src/codegen/common.sol";

import {IWorld} from "../src/codegen/world/IWorld.sol";

import {PriorityQueue96x160Lib, MinHeapLib} from "../src/utils/PriorityQueue96x160Lib.sol";
import {EntityLib} from "../src/utils/EntityLib.sol";
import {timeWad} from "../src/utils/WadTimeLib.sol";
import {LineLib} from "../src/utils/LineLib.sol";

import {Handler} from "./Handler.sol";
import {DebugLib} from "./DebugLib.sol";

contract InvariantsTest is MudTest {
    Handler public handler;

    IWorld public world;

    function setUp() public override {
        super.setUp();
        world = IWorld(worldAddress);
        handler = new Handler(world);
        targetContract(address(handler));

        // If you see tests fail with "failed to set up invariant testing environment: EvmError: Revert"
        // ensure that FORCE_DETERMINISTIC_TIMESTAMP was true when the PostDeploy.s.sol script was run.
        require(
            vm.envBool("FORCE_DETERMINISTIC_TIMESTAMP"),
            "FORCE_DETERMINISTIC_TIMESTAMP should be set for invariant tests."
        );

        vm.warp(9999999999); // Value from PostDeploy.s.sol.
    }

    function test_add_lines_fails(uint32 numLines) public {
        vm.expectRevert();
        world.addLines(numLines);
    }

    function invariant_no_entities_have_invalid_coordinates() public {
        for (uint256 i = 0; i < GameState.getNumLines(); i++) {
            world.poke(uint32(i));

            uint160 entityId = EntityLib.leftmostEntityId(uint32(i));
            uint160 previousEntityId = 0;

            while (entityId != 0) {
                if (entityId != EntityLib.leftmostEntityId(uint32(i))) {
                    assertNotEq(Entity.getLeftNeighbor(entityId), 0, "LEFT_NEIGHBOR_IS_ZERO");
                    assertGt(EntityLib.computeX(entityId, timeWad()), 0, "ENTITY_X_IS_ZERO");
                    assertGt(Entity.getLastX(entityId), 0, "ENTITY_LAST_X_IS_ZERO");
                }
                if (entityId != EntityLib.rightmostEntityId(uint32(i))) {
                    assertNotEq(Entity.getRightNeighbor(entityId), 0, "RIGHT_NEIGHBOR_IS_ZERO");
                    assertLt(EntityLib.computeX(entityId, timeWad()), GameConfig.getLineWidth(), "ENTITY_X_IS_TOO_LARGE");
                    assertLt(Entity.getLastX(entityId), GameConfig.getLineWidth(), "ENTITY_LAST_X_IS_TOO_LARGE");
                }

                assertNotEq(Entity.getLeftNeighbor(entityId), EntityLib.rightmostEntityId(Entity.getLineId(entityId)));
                assertNotEq(Entity.getRightNeighbor(entityId), EntityLib.leftmostEntityId(Entity.getLineId(entityId)));

                assertNotEq(Entity.getLeftNeighbor(entityId), entityId);
                assertNotEq(Entity.getRightNeighbor(entityId), entityId);

                if (previousEntityId != 0) {
                    assertEq(
                        Entity.getLeftNeighbor(entityId),
                        previousEntityId,
                        "LEFT_NEIGHBOR_DOES_NOT_MATCH_PREVIOUS_ENTITY_RIGHT_NEIGHBOR"
                    );

                    uint128 previousEntityRightEdge = EntityLib.computeX(previousEntityId, timeWad()) +
                        EntityLib.computeDiameter(previousEntityId);
                    uint128 currentEntityLeftEdge = EntityLib.computeX(entityId, timeWad());

                    assertGt(currentEntityLeftEdge, previousEntityRightEdge, "ENTITY_OVERLAPS_WITH_PREVIOUS_NEIGHBOR");
                }

                previousEntityId = entityId;
                entityId = Entity.getRightNeighbor(entityId);
            }
        }
    }
}
