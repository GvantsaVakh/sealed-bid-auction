// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, ebool, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title EncryptedComparison
/// @author Gvantsa Vakhtangishvili
/// @notice Small learning contract for storing and comparing encrypted bids.
contract EncryptedComparison is ZamaEthereumConfig {
    error FirstBidderHasNoBid();
    error SecondBidderHasNoBid();

    /// @notice Encrypted bid stored for each bidder.
    mapping(address bidder => euint32 bid) private bids;

    /// @notice Shows whether an address has submitted a bid.
    mapping(address bidder => bool submitted) public hasBid;

    /// @notice Last encrypted comparison result.
    ebool private lastComparisonResult;

    /// @notice Stores an encrypted bid for the caller.
    /// @param inputBid Encrypted bid value.
    /// @param inputProof Proof that the encrypted input is valid.
    function submitBid(externalEuint32 inputBid, bytes calldata inputProof) external {
        euint32 bid = FHE.fromExternal(inputBid, inputProof);

        bids[msg.sender] = bid;
        hasBid[msg.sender] = true;

        FHE.allowThis(bids[msg.sender]);
        FHE.allow(bids[msg.sender], msg.sender);
    }

    /// @notice Compares two encrypted bids and stores whether the first bid is higher.
    /// @param firstBidder Address of the first bidder.
    /// @param secondBidder Address of the second bidder.
    function compareBids(address firstBidder, address secondBidder) external {
        if (!hasBid[firstBidder]) {
            revert FirstBidderHasNoBid();
        }

        if (!hasBid[secondBidder]) {
            revert SecondBidderHasNoBid();
        }

        lastComparisonResult = FHE.gt(bids[firstBidder], bids[secondBidder]);

        FHE.allowThis(lastComparisonResult);
        FHE.allow(lastComparisonResult, msg.sender);
    }

    /// @notice Returns the encrypted bid for a bidder.
    /// @param bidder Address of the bidder.
    /// @return Encrypted bid value.
    function getEncryptedBid(address bidder) external view returns (euint32) {
        return bids[bidder];
    }

    /// @notice Returns the latest encrypted comparison result.
    /// @return Encrypted boolean result.
    function getLastComparisonResult() external view returns (ebool) {
        return lastComparisonResult;
    }
}
