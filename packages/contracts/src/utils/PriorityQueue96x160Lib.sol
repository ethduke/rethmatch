// SPDX-License-Identifier: MIT
pragma solidity >=0.8.21;

import {MinHeapLib} from "solady/utils/MinHeapLib.sol";

library PriorityQueue96x160Lib {
    using MinHeapLib for MinHeapLib.MemHeap;

    /*//////////////////////////////////////////////////////////////
                                 PACKING
    //////////////////////////////////////////////////////////////*/

    function pack(uint96 priority, uint160 value) internal pure returns (uint256 packed) {
        return (uint256(priority) << 160) | uint256(value);
    }

    function unpack(uint256 packed) internal pure returns (uint96 priority, uint160 value) {
        return (uint96(packed >> 160), uint160(packed));
    }

    /*//////////////////////////////////////////////////////////////
                               OPERATIONS
    //////////////////////////////////////////////////////////////*/

    function isEmpty(MinHeapLib.MemHeap memory heap) internal pure returns (bool empty) {
        assembly {
            empty := iszero(mload(mload(heap)))
        }
    }

    function peek(MinHeapLib.MemHeap memory heap) internal pure returns (uint96 priority, uint160 value) {
        return unpack(heap.root());
    }

    function push(MinHeapLib.MemHeap memory heap, uint96 priority, uint160 value) internal pure {
        heap.push(pack(priority, value));
    }
}
