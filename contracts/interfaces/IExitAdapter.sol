// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Design boundary for an independently reviewed exit implementation.
interface IExitAdapter {
    struct ExitRequest {
        address inputToken;
        uint256 amount;
        address recipient;
        uint256 minimumOut;
        uint256 destinationChainId;
        uint256 deadline;
        bytes routeData;
    }
    function execute(ExitRequest calldata request) external returns (uint256 amountOut);
}
