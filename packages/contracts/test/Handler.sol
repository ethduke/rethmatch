// SPDX-License-Identifier: MIT
pragma solidity >=0.8.21;

import {CommonBase} from "forge-std/Base.sol";
import {StdCheats} from "forge-std/StdCheats.sol";
import {StdUtils} from "forge-std/StdUtils.sol";
import {console2} from "forge-std/console2.sol";

import {StoreSwitch} from "@latticexyz/store/src/StoreSwitch.sol";

import "../src/codegen/index.sol";
import "../src/codegen/common.sol";

import {IWorld} from "../src/codegen/world/IWorld.sol";

import {EntityLib} from "../src/utils/EntityLib.sol";
import {timeWad} from "../src/utils/WadTimeLib.sol";

import {DebugLib} from "./DebugLib.sol";

contract Handler is StdCheats, StdUtils, CommonBase {
    address[] public accounts;

    IWorld world;

    function getAccounts() public view returns (address[] memory) {
        return accounts;
    }

    constructor(IWorld _world) {
        world = _world;

        accounts.push(address(0x1111111111111111111111111111111111111111));
        accounts.push(address(0x2222222222222222222222222222222222222222));
        accounts.push(address(0x3333333333333333333333333333333333333333));
        accounts.push(address(0x4444444444444444444444444444444444444444));

        StoreSwitch.setStoreAddress(address(world));
    }

    function spawn(uint8 accountId, uint8 rightNeighborOption, bool velRight) public {
        accountId = accountId % uint8(accounts.length);

        uint32 lineId;
        uint160 rightNeighborEntityId;
        if (rightNeighborOption > 100) {
            rightNeighborEntityId = EntityLib.toEntityId(uint160(accounts[(rightNeighborOption - 100) % accounts.length]));
            lineId = Entity.getLineId(rightNeighborEntityId);
        } else {
            lineId = rightNeighborOption % GameState.getNumLines();

            if (rightNeighborOption % 3 == 0) {
                rightNeighborEntityId = EntityLib.toEntityId(uint256(keccak256(abi.encode(lineId, 2))));
            } else if (rightNeighborOption % 3 == 1) {
                rightNeighborEntityId = EntityLib.toEntityId(uint256(keccak256(abi.encode(lineId, 3))));
            } else {
                rightNeighborEntityId = EntityLib.rightmostEntityId(lineId);
            }
        }

        vm.prank(accounts[accountId]);
        world.spawn(lineId, rightNeighborEntityId, velRight);

        console2.log(
            "{ type: 'spawn' , entity: ",
            DebugLib.mapEntityToEmoji(EntityLib.toEntityId(uint256(uint160(accounts[accountId]))), accounts)
        );
        console2.log(", rightNeighbor: ", DebugLib.mapEntityToEmoji(rightNeighborEntityId, accounts));
        console2.log(", timeWad: ", DebugLib.stringify(timeWad()));
        console2.log(", velRight: ", velRight, "},");
    }

    function setDirection(uint8 accountId, bool velRight) public {
        vm.prank(accounts[accountId % accounts.length]);
        world.setDirection(velRight);

        console2.log(
            "{ type: 'setDirection' , entity: ",
            DebugLib.mapEntityToEmoji(
                EntityLib.toEntityId(uint256(uint160(accounts[accountId % accounts.length]))),
                accounts
            )
        );
        console2.log(", timeWad: ", DebugLib.stringify(timeWad()));
        console2.log(", velRight: ", velRight, "},");
    }

    function pass1Second() public {
        vm.warp(block.timestamp + 1);

        console2.log("{ type: 'pass1Second' , timeWad: ", DebugLib.stringify(timeWad()), "},");
    }

    function jumpToLine(uint8 accountId, bool up) public {
        vm.prank(accounts[accountId % accounts.length]);
        world.jumpToLine(up);

        console2.log(
            "{ type: 'jumpToLine' , entity: ",
            DebugLib.mapEntityToEmoji(
                EntityLib.toEntityId(uint256(uint160(accounts[accountId % accounts.length]))),
                accounts
            )
        );
        console2.log(", timeWad: ", DebugLib.stringify(timeWad()));
        console2.log(", up: ", up, "},");
    }

    ////////////////////////////////////////////////////////

    function jumpToLineParallel2(uint8 accountId1, uint8 accountId2, bool up1, bool up2) public {
        jumpToLine(accountId1, up1);
        jumpToLine(accountId2, up2);
    }

    function jumpToLineParallel3(uint8 accountId1, uint8 accountId2, uint8 accountId3, bool up1, bool up2, bool up3) public {
        jumpToLine(accountId1, up1);
        jumpToLine(accountId2, up2);
        jumpToLine(accountId3, up3);
    }

    function jumpToLineParallel4(
        uint8 accountId1,
        uint8 accountId2,
        uint8 accountId3,
        uint8 accountId4,
        bool up1,
        bool up2,
        bool up3,
        bool up4
    ) public {
        jumpToLine(accountId1, up1);
        jumpToLine(accountId2, up2);
        jumpToLine(accountId3, up3);
        jumpToLine(accountId4, up4);
    }

    ////////////////////////////////////////////////////////

    function setDirectionParallel2(uint8 accountId1, uint8 accountId2, bool velRight1, bool velRight2) public {
        setDirection(accountId1, velRight1);
        setDirection(accountId2, velRight2);
    }

    function setDirectionParallel3(
        uint8 accountId1,
        uint8 accountId2,
        uint8 accountId3,
        bool velRight1,
        bool velRight2,
        bool velRight3
    ) public {
        setDirection(accountId1, velRight1);
        setDirection(accountId2, velRight2);
        setDirection(accountId3, velRight3);
    }

    function setDirectionParallel4(
        uint8 accountId1,
        uint8 accountId2,
        uint8 accountId3,
        uint8 accountId4,
        bool velRight1,
        bool velRight2,
        bool velRight3,
        bool velRight4
    ) public {
        setDirection(accountId1, velRight1);
        setDirection(accountId2, velRight2);
        setDirection(accountId3, velRight3);
        setDirection(accountId4, velRight4);
    }

    ///////////////////////////////////////////////////////////

    function spawnParallel2(
        uint8 accountId1,
        uint8 accountId2,
        uint8 rightNeighborOption1,
        uint8 rightNeighborOption2,
        bool velRight1,
        bool velRight2
    ) public {
        spawn(accountId1, rightNeighborOption1, velRight1);
        spawn(accountId2, rightNeighborOption2, velRight2);
    }

    function spawnParallel3(
        uint8 accountId1,
        uint8 accountId2,
        uint8 accountId3,
        uint8 rightNeighborOption1,
        uint8 rightNeighborOption2,
        uint8 rightNeighborOption3,
        bool velRight1,
        bool velRight2,
        bool velRight3
    ) public {
        spawn(accountId1, rightNeighborOption1, velRight1);
        spawn(accountId2, rightNeighborOption2, velRight2);
        spawn(accountId3, rightNeighborOption3, velRight3);
    }

    function spawnParallel4(
        uint8 accountId1,
        uint8 accountId2,
        uint8 accountId3,
        uint8 accountId4,
        uint8 rightNeighborOption1,
        uint8 rightNeighborOption2,
        uint8 rightNeighborOption3,
        uint8 rightNeighborOption4,
        bool velRight1,
        bool velRight2,
        bool velRight3,
        bool velRight4
    ) public {
        spawn(accountId1, rightNeighborOption1, velRight1);
        spawn(accountId2, rightNeighborOption2, velRight2);
        spawn(accountId3, rightNeighborOption3, velRight3);
        spawn(accountId4, rightNeighborOption4, velRight4);
    }
}
