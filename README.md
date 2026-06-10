# Sealed Bid Auction Using Fully Homomorphic Encryption (FHE)

A privacy-preserving sealed-bid auction built using Zama's fhEVM protocol. Bids remain encrypted throughout the auction,
and the smart contract determines the winner without revealing individual bid values on-chain.

## Overview

Traditional blockchain auctions expose all bids publicly because transaction data is visible on-chain. This project
demonstrates how Fully Homomorphic Encryption (FHE) can be used to preserve bid privacy while still allowing the smart
contract to determine the highest bidder.

The contract stores encrypted bids, compares encrypted values using fhEVM operations, and identifies the winner without
decrypting any bid during the auction.

## Features

- Encrypted bid submission using `euint32`
- Privacy-preserving winner determination
- Encrypted highest bid tracking
- Encrypted winner tracking
- Auction deadline and finalization logic
- Per-bidder encrypted bid storage
- Deployment and testing on Sepolia
- Full local test suite using Zama's mock environment

## Contract Evolution

The project was developed incrementally through several contracts:

1. **EncryptedBidBox**
   - Stores encrypted bids per address

2. **EncryptedComparison**
   - Compares encrypted bids using `FHE.gt()`

3. **EncryptedHighestBid**
   - Tracks the highest encrypted bid using `FHE.select()`

4. **EncryptedAuctionCore**
   - Adds auction deadlines and active/inactive state

5. **EncryptedAuctionWithWinner**
   - Tracks encrypted winner identifiers

6. **EncryptedAuctionFinalizable**
   - Adds auction finalization logic

7. **SealedBidAuction**
   - Final integrated implementation

## How It Works

### Bid Submission

A bidder:

1. Encrypts a bid locally using the fhEVM client.
2. Generates a validity proof.
3. Calls:

```solidity
submitBid(externalEuint32 inputBid, bytes inputProof)
```

The blockchain receives only encrypted data and proof information.

### Winner Selection

The contract compares encrypted bids using:

```solidity
FHE.gt()
FHE.select()
```

without revealing any plaintext values.

### Finalization

After the auction deadline:

```solidity
endAuction()
```

is called.

The highest encrypted bid and encrypted winner remain private, but decryption permission is granted to the owner for
demonstration purposes.

## Security Model

### During the Auction

- Bid values remain encrypted.
- Highest bid remains encrypted.
- Winner remains encrypted.
- Public observers cannot determine bid amounts.

### After Finalization

- The owner can decrypt:
  - Winning bid
  - Winner identifier

This design is intended for demonstration and testing.

A production implementation should use threshold or gateway-based decryption rather than owner-based decryption.

## Limitations

### Re-bidding

A bidder may overwrite a previous bid by submitting another encrypted bid.

### No Sybil Resistance

Users may create multiple Ethereum addresses and participate multiple times.

### Owner-Based Decryption

The current implementation grants decryption rights to the owner after finalization.

### Manual Finalization

The auction must be finalized through an explicit call to:

```solidity
endAuction()
```

### Public Bidder Addresses

Bid values remain private, but bidder addresses are publicly visible on-chain.

## Sepolia Deployment

The contract was successfully deployed and tested on the Sepolia test network.

Example deployment:

- Contract Address: `0xC9C4013e5C46F46c0e8E62365d7A286EBB0c479C`

Example encrypted bid transaction:

- Transaction Hash: `0x05e7dbfe87e95d82b4c895b041b3d8a9e02564513ef761570aed77ec32189412`

The transaction calldata contains encrypted values and proofs rather than plaintext bids.

## Running Tests

Run the full suite:

```bash
npm test
```

Run the demonstration:

```bash
npx hardhat test test/DemoSealedBidAuction.ts
```

Formatting:

```bash
npm run prettier:write
```

Linting:

```bash
npm run lint
```

## Demo Scenario

The included demo performs the following auction:

| Bidder  | Bid |
| ------- | --- |
| Alice   | 42  |
| Bob     | 77  |
| Charlie | 50  |

All bids remain encrypted during execution.

After finalization:

- Winning Bid: 77
- Winner: Bob

## Future Work

- Public publication of auction results after finalization
- Threshold decryption instead of owner-based decryption
- Bid deposits and anti-spam mechanisms
- Stronger Sybil-resistance mechanisms
- Automatic settlement and payment enforcement
- Hidden bidder identities

## Author

**Gvantsa Vakhtangishvili**

Privacy on Blockchain Course Project

Built using Zama fhEVM and Hardhat.
