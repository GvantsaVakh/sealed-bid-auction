// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, ebool, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title SealedBidAuction
/// @author Gvantsa Vakhtangishvili
/// @notice Final sealed-bid auction contract using FHE-encrypted bids.
contract SealedBidAuction is ZamaEthereumConfig {
    /// @notice Thrown when trying to read highest bid or winner before any bid exists.
    error NoBidYet();

    /// @notice Thrown when a bidder tries to bid after the auction ended.
    error AuctionAlreadyEnded();

    /// @notice Thrown when trying to finalize before the auction deadline.
    error AuctionStillActive();

    /// @notice Thrown when trying to finalize the auction more than once.
    error AuctionAlreadyFinalized();

    /// @notice Address allowed to decrypt highest bid and winner id in local tests.
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

    /// @notice Shows whether at least one bid has been submitted.
    bool public hasAnyBid;

    /// @notice Highest encrypted bid submitted so far.
    euint32 private highestBid;

    /// @notice Encrypted id of the current highest bidder.
    euint32 private encryptedWinnerId;

    /// @notice Emitted when a bidder submits an encrypted bid.
    /// @param bidder Address of the bidder.
    /// @param timestamp Timestamp when the bid was submitted.
    event BidSubmitted(address indexed bidder, uint256 indexed timestamp);

    /// @notice Emitted when the auction is finalized.
    /// @param timestamp Timestamp when the auction was finalized.
    event AuctionFinalized(uint256 indexed timestamp);

    /// @notice Creates a sealed-bid auction.
    /// @param biddingDuration Number of seconds the auction accepts bids.
    /// @param auctionItemName Human-readable auction item name.
    constructor(uint256 biddingDuration, string memory auctionItemName) {
        owner = msg.sender;
        auctionEndTime = block.timestamp + biddingDuration;
        itemName = auctionItemName;
    }

    /// @notice Stores caller's encrypted bid and updates encrypted highest bid and encrypted winner id.
    /// @param inputBid Encrypted bid value.
    /// @param inputProof Proof that the encrypted input is valid.
    function submitBid(externalEuint32 inputBid, bytes calldata inputProof) external {
        if (block.timestamp > auctionEndTime || block.timestamp == auctionEndTime || auctionEnded) {
            revert AuctionAlreadyEnded();
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

        FHE.allowThis(bids[msg.sender]);
        FHE.allow(bids[msg.sender], msg.sender);

        if (!hasAnyBid) {
            highestBid = bid;
            encryptedWinnerId = encryptedCurrentBidderId;
            hasAnyBid = true;
        } else {
            ebool isHigher = FHE.gt(bid, highestBid);
            highestBid = FHE.select(isHigher, bid, highestBid);
            encryptedWinnerId = FHE.select(isHigher, encryptedCurrentBidderId, encryptedWinnerId);
        }

        FHE.allowThis(highestBid);
        FHE.allowThis(encryptedWinnerId);

        emit BidSubmitted(msg.sender, block.timestamp);
    }

    /// @notice Finalizes the auction after the bidding deadline.
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
        FHE.allow(encryptedWinnerId, owner);

        emit AuctionFinalized(block.timestamp);
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

    /// @notice Returns encrypted id of the current winner.
    /// @return Encrypted winner id.
    function getEncryptedWinnerId() external view returns (euint32) {
        if (!hasAnyBid) {
            revert NoBidYet();
        }
        return encryptedWinnerId;
    }
}
