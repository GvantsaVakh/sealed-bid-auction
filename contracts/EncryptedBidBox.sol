// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title EncryptedBidBox
/// @author Your Name
/// @notice Small learning contract: stores one encrypted bid.
contract EncryptedBidBox is ZamaEthereumConfig {
    mapping(address bidder => euint32 encryptedBid) private bids;

    /// @notice Tracks whether an address has submitted a bid
    mapping(address bidder => bool submitted) public hasBid;

    /// @notice Submits an encrypted bid for the caller
    /// @param inputBid The encrypted bid value
    /// @param inputProof The proof validating the encrypted input
    function submitBid(externalEuint32 inputBid, bytes calldata inputProof) external {
        euint32 bid = FHE.fromExternal(inputBid, inputProof);

        bids[msg.sender] = bid;
        hasBid[msg.sender] = true;

        FHE.allowThis(bids[msg.sender]);
        FHE.allow(bids[msg.sender], msg.sender);
    }

    /// @notice Returns the encrypted bid for a given bidder
    /// @param bidder The address of the bidder
    function getEncryptedBid(address bidder) external view returns (euint32) {
        return bids[bidder];
    }
}
