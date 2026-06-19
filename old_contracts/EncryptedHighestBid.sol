// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, ebool, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title EncryptedHighestBid
/// @author Gvantsa Vakhtangishvili
/// @notice Learning contract that keeps track of the highest encrypted bid.
contract EncryptedHighestBid is ZamaEthereumConfig {
    /// @notice Thrown when trying to read highest bid before any bid exists.
    error NoBidYet();

    /// @notice Address allowed to decrypt highest bid in tests.
    address public owner;

    /// @notice Encrypted bid stored for each bidder.
    mapping(address bidder => euint32 bid) private bids;

    /// @notice Shows whether an address has submitted a bid.
    mapping(address bidder => bool submitted) public hasBid;

    /// @notice Highest encrypted bid submitted so far.
    euint32 private highestBid;

    /// @notice Shows whether at least one bid has been submitted.
    bool public hasAnyBid;

    /// @notice Sets the test owner.
    constructor() {
        owner = msg.sender;
    }

    /// @notice Stores caller's encrypted bid and updates the highest bid if needed.
    /// @param inputBid Encrypted bid value.
    /// @param inputProof Proof that the encrypted input is valid.
    function submitBid(externalEuint32 inputBid, bytes calldata inputProof) external {
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

        // This is only for local tests. In the final auction,
        // the highest bid should be revealed only at the end.
        FHE.allow(highestBid, owner);
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
