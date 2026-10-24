// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {IExitAdapter} from "./interfaces/IExitAdapter.sol";

/// @notice Non-custodial, fail-closed placeholder. No routes or approvals exist.
/// @dev Do not deploy as a functional AQUA0 integration. No payable entrypoints.
contract AquaExitAdapterUnavailable is IExitAdapter {
    error AquaIntegrationNotConfigured();
    function execute(ExitRequest calldata) external pure returns (uint256) {
        revert AquaIntegrationNotConfigured();
    }
}
