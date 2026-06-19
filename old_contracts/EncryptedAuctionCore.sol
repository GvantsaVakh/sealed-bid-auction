// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, ebool, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title EncryptedAuctionCore
/// @author Gvantsa Vakhtangishvili
/// @notice Auction core that accepts encrypted bids and tracks the encrypted highest bid.
contract EncryptedAuctionCore is ZamaEthereumConfig {
    /// @notice Thrown when trying to read highest bid before any bid exists.
    error NoBidYet();

    /// @notice Thrown when a bidder tries to bid after the auction ended.
    error AuctionAlreadyEnded();

    /// @notice Address allowed to decrypt highest bid in local tests.
    address public owner;

    /// @notice Human-readable auction item name.
    string public itemName;

    /// @notice Timestamp when the auction stops accepting bids.
    uint256 public auctionEndTime;

    /// @notice Encrypted bid stored for each bidder.
    mapping(address bidder => euint32 bid) private bids;

    /// @notice Shows whether an address has submitted a bid.
    mapping(address bidder => bool submitted) public hasBid;

    /// @notice Highest encrypted bid submitted so far.
    euint32 private highestBid;

    /// @notice Shows whether at least one bid has been submitted.
    bool public hasAnyBid;

    /// @notice Creates an encrypted auction.
    /// @param biddingDuration Number of seconds the auction accepts bids.
    /// @param auctionItemName Human-readable auction item name.
    constructor(uint256 biddingDuration, string memory auctionItemName) {
        owner = msg.sender;
        auctionEndTime = block.timestamp + biddingDuration;
        itemName = auctionItemName;
    }

    /// @notice Stores caller's encrypted bid if auction is still active.
    /// @param inputBid Encrypted bid value.
    /// @param inputProof Proof that the encrypted input is valid.
    function submitBid(externalEuint32 inputBid, bytes calldata inputProof) external {
        if (block.timestamp > auctionEndTime || block.timestamp == auctionEndTime) {
            revert AuctionAlreadyEnded();
        }

        euint32 bid = FHE.fromExternal(inputBid, inputProof);

        bids[msg.sender] = bid;
        hasBid[msg.sender] = true;

        FHE.allowThis(bids[msg.sender]);
        FHE.allow(bids[msg.sender], msg.sender);

        if (!hasAnyBid) {
            highestBid = bid;
            hasAnyBid = true;
        } else {
            ebool isHigher = FHE.gt(bid, highestBid);
            highestBid = FHE.select(isHigher, bid, highestBid);
        }

        FHE.allowThis(highestBid);

        // Local-test permission only. Final auction should reveal at the end.
        FHE.allow(highestBid, owner);
    }

    /// @notice Returns true if the auction still accepts bids.
    /// @return True when current time is before auction end time.
    function isActive() external view returns (bool) {
        return block.timestamp < auctionEndTime;
    }

    /// @notice Returns encrypted bid for one bidder.
    /// @param bidder Address of the bidder.
    /// @return Encrypted bid value.
    function getEncryptedBid(address bidder) external view returns (euint32) {
        return bids[bidder];
    }

    /// @notice Returns the current encrypted highest bid.
    /// @return Encrypted highest bid value.
    function getHighestBid() external view returns (euint32) {
        if (!hasAnyBid) {
            revert NoBidYet();
        }

        return highestBid;
    }
}
