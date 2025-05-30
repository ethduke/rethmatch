// SPDX-License-Identifier: MIT
pragma solidity >=0.8.21;

import {FixedPointMathLib} from "solady/utils/FixedPointMathLib.sol";

import "../codegen/index.sol";

library ConfigLib {
    using FixedPointMathLib for *;

    function mapMassToDiameter(uint128 mass) internal pure returns (uint128) {
        // Note: This MUST be sub-linear, as otherwise when an entity consumes another entity,
        // the fact the diameter of the winner entity could exceed/match the combined diameters of
        // the original entities could cause the winner to instantly collide with its neighbor(s).
        return uint128(mass.sqrtWad());
    }

    function mapMassToVelocity(uint128 mass) internal view returns (int128) {
        if (mass == 0) return 0; // Avoid wasting gas on boundary entities.

        // prettier-ignore
        return int128(uint128(
                    uint256(GameConfig.getVelocityCoefficient())
                    .divWad(uint256(
                        // + 1.0...1e18 to avoid negative and 0 outputs.
                        log10Wad(int256(int128(mass + 1.000000001e18)))
                    ))
                ));
    }

    function computeMassAfterJumpingLine(uint128 mass) internal view returns (uint128) {
        return uint128(mass.mulWad(GameConfig.getLineJumpDecayFactor()));
    }

    /*//////////////////////////////////////////////////////////////
                        LOW-LEVEL MATH FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function log10Wad(int256 x) internal pure returns (int256) {
        // via change of base formula, log10(x) = ln(x) / ln(10)
        return FixedPointMathLib.lnWad(x).sDivWad(2.302585092994045683e18);
    }
}
