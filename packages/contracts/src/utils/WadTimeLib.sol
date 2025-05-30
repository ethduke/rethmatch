// SPDX-License-Identifier: MIT
pragma solidity >=0.8.21;

function timeWad() view returns (uint96) {
    unchecked {
        return uint96(block.timestamp) * 1e18;
    }
}
