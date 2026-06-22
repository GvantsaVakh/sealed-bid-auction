// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/* solhint-disable max-states-count, gas-indexed-events */

import {FHE, ebool, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title SealedBidAuction
/// @author Gvantsa Vakhtangishvili
/// @notice Confidential Vickrey sealed-bid auction using FHE-encrypted bids.
/// @dev Highest bidder wins, but the final price is the second-highest bid.
contract SealedBidAuction is ZamaEthereumConfig {
    /// @notice Thrown when trying to read highest bid, second-highest bid, or winner before any bid exists.
    error NoBidYet();

    /// @notice Thrown when a bidder tries to bid after the auction ended.
    error AuctionAlreadyEnded();

    /// @notice Thrown when trying to finalize before the auction deadline.
    error AuctionStillActive();

    /// @notice Thrown when trying to finalize the auction more than once.
    error AuctionAlreadyFinalized();

    /// @notice Thrown when a function requires the auction to already be finalized.
    error AuctionNotEnded();

    /// @notice Thrown when the same address tries to submit more than one bid.
    error BidAlreadySubmitted();

    /// @notice Thrown when a non-owner tries to call an owner-only function.
    error OnlyOwner();

    /// @notice Thrown when owner tries to publish result more than once.
    error ResultAlreadyPublished();

    /// @notice Thrown when owner tries to publish a winner id that does not map to a bidder.
    error InvalidWinnerId();

    /// @notice Address allowed to decrypt auction result.
    address public owner;

    /// @notice Human-readable auction item name.
    string public itemName;

    /// @notice Timestamp when the auction stops accepting bids.
    uint256 public auctionEndTime;

    /// @notice Shows whether the auction has been finalized.
    bool public auctionEnded;

    /// @notice Encrypted bid stored for each bidder.
    mapping(address bidder => euint32 bid) private bids;

    /// @notice Shows whether an address has submitted a bid.
    mapping(address bidder => bool submitted) public hasBid;

    /// @notice Public numeric id assigned to each bidder.
    mapping(address bidder => uint32 id) public bidderIds;

    /// @notice Maps each public bidder id back to the bidder address.
    mapping(uint32 id => address bidder) public bidderById;

    /// @notice Next bidder id to assign.
    uint32 public nextBidderId = 1;

    /// @notice Total number of submitted bids.
    uint32 public bidCount;

    /// @notice Shows whether at least one bid has been submitted.
    bool public hasAnyBid;

    /// @notice Highest encrypted bid submitted so far.
    euint32 private highestBid;

    /// @notice Second-highest encrypted bid submitted so far.
    /// @dev In a Vickrey auction, this becomes the final price paid by the winner.
    euint32 private secondHighestBid;

    /// @notice Encrypted id of the current highest bidder.
    euint32 private encryptedWinnerId;

    /// @notice Publicly published winner id after owner reveals result.
    uint32 public publicWinnerId;

    /// @notice Publicly published winner address after owner reveals result.
    address public publicWinner;

    /// @notice Publicly published highest bid after owner reveals result.
    uint32 public publicHighestBid;

    /// @notice Publicly published Vickrey price after owner reveals result.
    uint32 public publicVickreyPrice;

    /// @notice Shows whether final result has been published on-chain.
    bool public resultPublished;

    /// @notice Emitted when a bidder submits an encrypted bid.
    /// @param bidder Address of the bidder.
    /// @param bidderId Public numeric id assigned to the bidder.
    /// @param timestamp Timestamp when the bid was submitted.
    event BidSubmitted(address indexed bidder, uint32 indexed bidderId, uint256 indexed timestamp);

    /// @notice Emitted when the auction is finalized.
    /// @param timestamp Timestamp when the auction was finalized.
    event AuctionFinalized(uint256 indexed timestamp);

    /// @notice Emitted when owner publishes decrypted final result on-chain.
    /// @param winnerId Public id of the winning bidder.
    /// @param winner Address of the winning bidder.
    /// @param highestBid Highest bid value.
    /// @param vickreyPrice Second-highest bid value, paid by the winner.
    event ResultPublished(uint32 winnerId, address winner, uint32 highestBid, uint32 vickreyPrice);

    /// @notice Creates a confidential Vickrey sealed-bid auction.
    /// @param biddingDuration Number of seconds the auction accepts bids.
    /// @param auctionItemName Human-readable auction item name.
    constructor(uint256 biddingDuration, string memory auctionItemName) {
        owner = msg.sender;
        auctionEndTime = block.timestamp + biddingDuration;
        itemName = auctionItemName;
    }

    /// @notice Restricts function access to the auction owner.
    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    /// @notice Stores caller's encrypted bid and privately updates highest bid, second-highest bid, and winner id.
    /// @param inputBid Encrypted bid value.
    /// @param inputProof Proof that the encrypted input is valid.
    function submitBid(externalEuint32 inputBid, bytes calldata inputProof) external {
        if (block.timestamp > auctionEndTime || block.timestamp == auctionEndTime || auctionEnded) {
            revert AuctionAlreadyEnded();
        }

        if (hasBid[msg.sender]) {
            revert BidAlreadySubmitted();
        }

        if (bidderIds[msg.sender] == 0) {
            bidderIds[msg.sender] = nextBidderId;
            bidderById[nextBidderId] = msg.sender;
            ++nextBidderId;
        }

        uint32 currentBidderId = bidderIds[msg.sender];

        euint32 bid = FHE.fromExternal(inputBid, inputProof);
        euint32 encryptedCurrentBidderId = FHE.asEuint32(currentBidderId);

        bids[msg.sender] = bid;
        hasBid[msg.sender] = true;
        ++bidCount;

        FHE.allowThis(bids[msg.sender]);
        FHE.allow(bids[msg.sender], msg.sender);

        _updateAuctionState(bid, encryptedCurrentBidderId);

        emit BidSubmitted(msg.sender, currentBidderId, block.timestamp);
    }

    /// @notice Privately updates encrypted highest bid, second-highest bid, and winner id.
    /// @param bid Newly submitted encrypted bid.
    /// @param encryptedCurrentBidderId Encrypted public id of the bidder.
    function _updateAuctionState(euint32 bid, euint32 encryptedCurrentBidderId) internal {
        if (!hasAnyBid) {
            highestBid = bid;
            secondHighestBid = FHE.asEuint32(0);
            encryptedWinnerId = encryptedCurrentBidderId;
            hasAnyBid = true;
        } else {
            ebool isHigherThanHighest = FHE.gt(bid, highestBid);
            ebool isHigherThanSecondHighest = FHE.gt(bid, secondHighestBid);

            euint32 updatedSecondHighest = FHE.select(
                isHigherThanHighest,
                highestBid,
                FHE.select(isHigherThanSecondHighest, bid, secondHighestBid)
            );

            euint32 updatedHighest = FHE.select(isHigherThanHighest, bid, highestBid);
            euint32 updatedWinnerId = FHE.select(isHigherThanHighest, encryptedCurrentBidderId, encryptedWinnerId);

            secondHighestBid = updatedSecondHighest;
            highestBid = updatedHighest;
            encryptedWinnerId = updatedWinnerId;
        }

        FHE.allowThis(highestBid);
        FHE.allowThis(secondHighestBid);
        FHE.allowThis(encryptedWinnerId);
    }

    /// @notice Finalizes the auction after the bidding deadline.
    /// @dev After finalization, owner is allowed to decrypt highest bid, second-highest bid, and winner id.
    function endAuction() external {
        if (block.timestamp < auctionEndTime) {
            revert AuctionStillActive();
        }

        if (auctionEnded) {
            revert AuctionAlreadyFinalized();
        }

        if (!hasAnyBid) {
            revert NoBidYet();
        }

        auctionEnded = true;

        FHE.allow(highestBid, owner);
        FHE.allow(secondHighestBid, owner);
        FHE.allow(encryptedWinnerId, owner);

        emit AuctionFinalized(block.timestamp);
    }

    /// @notice Publishes the decrypted auction result on-chain after owner decrypts it off-chain.
    /// @dev This is an owner-published reveal. A production version should use a trust-minimized gateway callback.
    /// @param winnerId Decrypted winner id.
    /// @param highestBidPlain Decrypted highest bid.
    /// @param vickreyPricePlain Decrypted second-highest bid, which is the Vickrey price.
    function publishResult(uint32 winnerId, uint32 highestBidPlain, uint32 vickreyPricePlain) external onlyOwner {
        if (!auctionEnded) {
            revert AuctionNotEnded();
        }

        if (resultPublished) {
            revert ResultAlreadyPublished();
        }

        address winner = bidderById[winnerId];

        if (winner == address(0)) {
            revert InvalidWinnerId();
        }

        publicWinnerId = winnerId;
        publicWinner = winner;
        publicHighestBid = highestBidPlain;
        publicVickreyPrice = vickreyPricePlain;
        resultPublished = true;

        emit ResultPublished(winnerId, winner, highestBidPlain, vickreyPricePlain);
    }

    /// @notice Returns true if the auction still accepts bids.
    /// @return True when current time is before auction end time and auction is not finalized.
    function isActive() external view returns (bool) {
        return block.timestamp < auctionEndTime && !auctionEnded;
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

    /// @notice Returns the current encrypted second-highest bid.
    /// @dev In this Vickrey auction, this value is the price paid by the winner.
    /// @return Encrypted second-highest bid value.
    function getSecondHighestBid() external view returns (euint32) {
        if (!hasAnyBid) {
            revert NoBidYet();
        }

        return secondHighestBid;
    }

    /// @notice Returns encrypted id of the current winner.
    /// @return Encrypted winner id.
    function getEncryptedWinnerId() external view returns (euint32) {
        if (!hasAnyBid) {
            revert NoBidYet();
        }

        return encryptedWinnerId;
    }
}
