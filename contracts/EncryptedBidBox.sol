// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title EncryptedBidBox
/// @notice Small learning contract: stores one encrypted bid.
contract EncryptedBidBox is ZamaEthereumConfig {
    euint32 private encryptedBid;

    address public lastBidder;
    bool public hasBid;

    function submitBid(externalEuint32 inputBid, bytes calldata inputProof) external {
        euint32 bid = FHE.fromExternal(inputBid, inputProof);

        encryptedBid = bid;
        lastBidder = msg.sender;
        hasBid = true;

        FHE.allowThis(encryptedBid);
        FHE.allow(encryptedBid, msg.sender);
    }

    function getEncryptedBid() external view returns (euint32) {
        return encryptedBid;
    }
}
