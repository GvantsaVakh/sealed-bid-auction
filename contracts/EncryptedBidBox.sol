// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title EncryptedBidBox
/// @notice Small learning contract: stores one encrypted bid.
contract EncryptedBidBox is ZamaEthereumConfig {
    mapping(address => euint32) private bids;
    mapping(address => bool) public hasBid;

    function submitBid(externalEuint32 inputBid, bytes calldata inputProof) external {
        euint32 bid = FHE.fromExternal(inputBid, inputProof);

        bids[msg.sender] = bid;
        hasBid[msg.sender] = true;

        FHE.allowThis(bids[msg.sender]);
        FHE.allow(bids[msg.sender], msg.sender);
    }

    function getEncryptedBid(address bidder) external view returns (euint32) {
        return bids[bidder];
    }
}
