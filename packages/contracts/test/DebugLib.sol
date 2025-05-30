// SPDX-License-Identifier: MIT
pragma solidity >=0.8.21;

import {console2} from "forge-std/console2.sol";

import {LibString} from "solady/utils/LibString.sol";

import "../src/codegen/index.sol";
import "../src/codegen/common.sol";

import {IWorld} from "../src/codegen/world/IWorld.sol";

import {timeWad} from "../src/utils/WadTimeLib.sol";
import {EntityLib} from "../src/utils/EntityLib.sol";
import {PriorityQueue96x160Lib} from "../src/utils/PriorityQueue96x160Lib.sol";

import {Handler} from "./Handler.sol";

library DebugLib {
    function logStateOfLines(IWorld world, Handler handler) public {
        console2.log('\n\n{ type: "snapshot", timeWad:', DebugLib.stringify(timeWad()), ", lines: [");
        for (uint256 i = 0; i < GameState.getNumLines(); i++) {
            console2.log("{ line:", DebugLib.stringify(i), ", entities: [");
            world.poke(uint32(i));

            uint160 entityId = EntityLib.leftmostEntityId(uint32(i));

            while (entityId != 0) {
                console2.log(
                    "{ entity:",
                    DebugLib.mapEntityToEmoji(entityId, handler.getAccounts()),
                    ", leftNeighbor:",
                    DebugLib.mapEntityToEmoji(Entity.getLeftNeighbor(entityId), handler.getAccounts())
                );
                console2.log(
                    ", rightNeighbor:",
                    DebugLib.mapEntityToEmoji(Entity.getRightNeighbor(entityId), handler.getAccounts()),
                    ", computeX:",
                    DebugLib.stringify(EntityLib.computeX(entityId, timeWad()))
                );
                console2.log(
                    ", computeDiameter:",
                    DebugLib.stringify(EntityLib.computeDiameter(entityId)),
                    ", etype:",
                    DebugLib.stringify(uint8(Entity.getEtype(entityId)))
                );
                console2.log(", velocityMultiplier:", DebugLib.stringify(Entity.getVelMultiplier(entityId)));
                console2.log("},\n");

                entityId = Entity.getRightNeighbor(entityId);
            }

            console2.log("], collisionQueue: [");
            uint256[] memory collisionQueue = Line.getCollisionQueue(uint32(i));
            for (uint256 j = 0; j < collisionQueue.length; j++) {
                (uint96 priority, uint160 value) = PriorityQueue96x160Lib.unpack(collisionQueue[j]);
                console2.log("{ collisionTimeWad:", DebugLib.stringify(priority));
                console2.log(", rightEntity:", DebugLib.mapEntityToEmoji(value, handler.getAccounts()), "},");
            }
            console2.log("]},\n");
        }
        console2.log("] },");
    }

    function stringify(uint256 value) internal pure returns (string memory) {
        return string(abi.encodePacked("'", LibString.toString(value), "'"));
    }

    function stringify(int256 value) internal pure returns (string memory) {
        return string(abi.encodePacked("'", LibString.toString(value), "'"));
    }

    function mapEntityToEmoji(uint160 entity, address[] memory accounts) internal pure returns (string memory) {
        if (entity == 0) return '"N/A"';

        for (uint256 i = 0; i < accounts.length; i++) {
            if (entity == EntityLib.toEntityId(uint256(uint160(accounts[i]))))
                return string(abi.encodePacked('"[PLAYER ', LibString.toString(i), ']"'));
        }

        if (EntityLib.isBoundaryEntity(entity) && !EntityLib.isRightmostEntity(entity)) return '"[LEFT_BOUNDARY]"';
        if (EntityLib.isRightmostEntity(entity)) return '"[RIGHT_BOUNDARY]"';

        string[103] memory colorfulEmojis = [
            unicode"🕋", // Kaaba (Black)
            unicode"🐸", // Frog (Green)
            unicode"🍅", // Tomato (Red)
            unicode"🍊", // Tangerine (Orange)
            unicode"🍋", // Lemon (Yellow)
            unicode"🍇", // Grapes (Purple)
            unicode"🌸", // Cherry Blossom (Pink)
            unicode"🌻", // Sunflower (Yellow)
            unicode"🌼", // Blossom (Light Yellow)
            unicode"🌿", // Herb (Green)
            unicode"🔥", // Fire (Red/Orange)
            unicode"💧", // Droplet (Blue)
            unicode"🌍", // Globe Showing Europe-Africa (Green/Blue)
            unicode"🌙", // Crescent Moon (Yellow)
            unicode"⭐", // Star (Yellow)
            unicode"🍁", // Maple Leaf (Red)
            unicode"🍀", // Four Leaf Clover (Green)
            unicode"🌈", // Rainbow
            unicode"🌊", // Water Wave (Blue)
            unicode"🌌", // Milky Way (Space Colors)
            unicode"🎈", // Balloon (Red)
            unicode"💎", // Gem Stone (Blue)
            unicode"🍑", // Peach (Orange)
            unicode"🍒", // Cherries (Red)
            unicode"🍓", // Strawberry (Red)
            unicode"🌹", // Rose (Red)
            unicode"🥑", // Avocado (Green)
            unicode"🥥", // Coconut (Brown)
            unicode"🫐", // Blueberries (Blue)
            unicode"🌺", // Hibiscus (Red)
            unicode"🥕", // Carrot (Orange)
            unicode"🌽", // Corn (Yellow)
            unicode"🍆", // Eggplant (Purple)
            unicode"🌶️", // Hot Pepper (Red)
            unicode"🥒", // Cucumber (Green)
            unicode"🍄", // Mushroom (Red/White)
            unicode"🌰", // Chestnut (Brown)
            unicode"🍯", // Honey Pot (Yellow)
            unicode"🦋", // Butterfly (Blue)
            unicode"🐠", // Tropical Fish (Orange/Blue)
            unicode"🦜", // Parrot (Red/Green/Yellow)
            unicode"🐙", // Octopus (Purple)
            unicode"🦚", // Peacock (Green/Blue)
            unicode"🌖", // Waning Gibbous Moon (Yellow)
            unicode"❄️", // Snowflake (Blue/White)
            unicode"🔮", // Crystal Ball (Purple)
            unicode"🎃", // Jack-o-lantern (Orange)
            unicode"🌟", // Glowing Star (Yellow)
            unicode"🌠", // Shooting Star (Yellow)
            unicode"🌋", // Volcano (Red/Orange)
            unicode"🏜️", // Desert (Yellow/Brown)
            unicode"🏝️", // Desert Island (Green/Blue)
            unicode"🌅", // Sunrise (Yellow/Blue)
            unicode"🌄", // Mountain at Sunrise (Orange/Blue)
            unicode"🏞️", // National Park (Green)
            unicode"🌐", // Globe with Meridians (Blue/Green)
            unicode"🧊", // Ice (Light Blue/White)
            unicode"🛸", // Flying Saucer (Grey)
            unicode"🎍", // Pine Decoration (Green)
            unicode"🎋", // Tanabata Tree (Green)
            unicode"🧨", // Firecracker (Red)
            unicode"🎏", // Carp Streamer (Red/Blue)
            unicode"🏮", // Red Paper Lantern
            unicode"🎴", // Flower Playing Cards (Red/Blue),
            unicode"🥮", // Moon Cake (Yellow)
            unicode"🥭", // Mango (Yellow/Orange)
            unicode"🍍", // Pineapple (Yellow)
            unicode"🥖", // Baguette Bread (Brown)
            unicode"🥨", // Pretzel (Brown)
            unicode"🍩", // Doughnut (Brown/Pink)
            unicode"🍪", // Cookie (Brown)
            unicode"⛩️", // Shinto Shrine (Red)
            unicode"🚌", // Bus (Yellow)
            unicode"🛶", // Canoe (Brown)
            unicode"🛎️", // Bellhop Bell (Gold)
            unicode"🍟", // French Fries (Yellow)
            unicode"🥣", // Bowl with Spoon (White)
            unicode"🧁", // Cupcake (Pink/White)
            unicode"🍭", // Lollipop (Rainbow)
            unicode"🍬", // Candy (Colorful)
            unicode"🦖", // T-Rex (Green)
            unicode"🍫", // Chocolate Bar (Brown)
            unicode"🦄", // Unicorn (White/Pink)
            unicode"🐲", // Dragon Face (Green)
            unicode"🎳", // Bowling (White/Red)
            unicode"🗽", // Statue of Liberty (Green)
            unicode"🎟️", // Admission Tickets (Red)
            unicode"🎬", // Clapper Board (Black/White)
            unicode"🎨", // Artist Palette (Colorful)
            unicode"🧶", // Yarn (Blue)
            unicode"🧵", // Thread (Red)
            unicode"🪡", // Sewing Needle (Silver)
            unicode"🧩", // Puzzle Piece (Blue)
            unicode"🎯", // Bullseye (Red/White)
            unicode"🎱", // Pool 8 Ball (Black/White)
            unicode"🚧", // Construction (Yellow/Black)
            unicode"⚓", // Anchor (Black)
            unicode"⛵", // Sailboat (White)
            unicode"📟", // Pager (Grey)
            unicode"📚", // Books (Colorful)
            unicode"🎙️", // Studio Microphone (Grey)
            unicode"💽", // Computer Disk (Black)
            unicode"🎽" // Running Shirt (Blue)
        ];

        return string(abi.encodePacked('"', colorfulEmojis[uint256(entity) % colorfulEmojis.length], '"'));
    }
}
