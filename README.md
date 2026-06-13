# Sealed Bid Auction Using Fully Homomorphic Encryption (FHE)

A privacy-preserving sealed-bid auction built using Zama's fhEVM protocol. Bids remain encrypted throughout the auction,
and the smart contract determines the winning bidder without revealing individual bid values on-chain.

## Overview

Traditional blockchain auctions expose all bids publicly because transaction data is visible on-chain. This project
demonstrates how Fully Homomorphic Encryption (FHE) can be used to preserve bid privacy while still allowing a smart
contract to determine the highest bidder.

Rather than decrypting bids, the contract continuously maintains an encrypted highest bid and an encrypted winner
identifier using homomorphic operations. At no point during the auction are bids intentionally decrypted or exposed by
the application logic.

While bid values remain encrypted, bidder Ethereum addresses remain publicly visible on-chain.

## Privacy Properties

This implementation provides:

- Bid value confidentiality
- Confidential winner determination during the auction
- Confidential highest bid tracking
- On-chain verifiable auction logic
- Privacy-preserving bid comparison

This implementation does not provide:

- Bidder anonymity
- Sybil resistance
- Trust-minimized public result publication
- Hidden participation metadata

## Features

- Encrypted bid submission using `euint32`
- Privacy-preserving winner determination
- Encrypted highest bid tracking
- Encrypted winner identifier tracking
- Homomorphic bid comparison using `FHE.gt()`
- Homomorphic winner selection using `FHE.select()`
- Auction deadline and finalization logic
- Per-bidder encrypted bid storage
- Deployment and testing on Sepolia
- Full local test suite using Zama's mock environment

## Contract Evolution

The project was developed incrementally through several contracts:

### 1. EncryptedBidBox

- Stores encrypted bids per address

### 2. EncryptedComparison

- Compares encrypted bids using `FHE.gt()`

### 3. EncryptedHighestBid

- Tracks the highest encrypted bid using `FHE.select()`

### 4. EncryptedAuctionCore

- Adds auction deadlines and active/inactive state

### 5. EncryptedAuctionWithWinner

- Tracks encrypted winner identifiers

### 6. EncryptedAuctionFinalizable

- Adds auction finalization logic

### 7. SealedBidAuction

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

The contract never reveals bid values.

Instead, encrypted values are compared using:

```solidity
FHE.gt()
```

and the encrypted highest bid and encrypted winner identifier are updated using:

```solidity
FHE.select()
```

The contract therefore maintains an encrypted representation of the current highest bid and current winner throughout
the auction without revealing their values.

### Finalization

After the auction deadline:

```solidity
endAuction()
```

is called.

The highest encrypted bid and encrypted winner identifier remain private, but decryption permission is granted to the
owner for demonstration and testing purposes.

## Security Model

### During the Auction

- Bid values remain encrypted.
- Individual bids are never revealed.
- The highest bid remains encrypted.
- The current winner remains encrypted.
- Public observers cannot determine bid amounts.
- Public observers cannot determine the current highest bid.
- Public observers cannot determine the current winning bidder.
- The owner cannot decrypt bids during the auction.

### After Finalization

The owner can decrypt:

- Winning bid
- Winner identifier

Losing bids remain encrypted and are never revealed.

This design is intended for demonstration and testing.

A production implementation should use threshold decryption or gateway-based decryption rather than owner-based
decryption.

## Threat Model

The project protects against:

- Curious blockchain observers
- Competing bidders attempting to learn bid values
- Auction owners attempting to inspect bids before auction completion

The project does not protect against:

- Sybil attacks
- Malicious decryption authorities
- Public observation of bidder addresses
- Adversaries controlling the underlying FHE infrastructure

## Trust Assumptions

- Bid confidentiality relies on the security guarantees provided by the fhEVM cryptographic model.
- The owner cannot observe plaintext bids during the auction.
- The owner gains decryption capability only after auction finalization.
- The correctness of result publication depends on the entity performing the final decryption.
- A production deployment should replace owner-based decryption with a trust-minimized decryption mechanism.

## Limitations

### Re-bidding

A bidder may overwrite a previous bid by submitting another encrypted bid.

### No Sybil Resistance

Users may create multiple Ethereum addresses and participate multiple times.

The current implementation assumes one blockchain address per participant.

Potential mitigations include:

- Registration deposits
- Bidder collateral requirements
- Allowlisted participants
- Proof-of-personhood systems

### Owner-Based Decryption

The current implementation grants decryption rights to the owner after finalization.

### Manual Finalization

The auction must be finalized through an explicit call to:

```solidity
endAuction()
```

### Public Bidder Addresses

Bid values remain private, but bidder addresses are publicly visible on-chain.

## Sepolia Deployment and Live Interaction

The final contract was successfully deployed to the Sepolia Ethereum test network and received encrypted bid
submissions.

Example deployment:

**First Contract Address**

```text
0xC9C4013e5C46F46c0e8E62365d7A286EBB0c479C
```

Example encrypted bid transaction:

**Transaction Hash**

```text
0x05e7dbfe87e95d82b4c895b041b3d8a9e02564513ef761570aed77ec32189412
```

Inspection of the transaction calldata on Etherscan shows encrypted handles and cryptographic proofs rather than
plaintext bid values.

This demonstrates that bid values are not directly visible to blockchain observers even though the transaction itself is
publicly accessible.

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

The included demonstration performs the following auction:

| Bidder  | Bid |
| ------- | --- |
| Alice   | 42  |
| Bob     | 77  |
| Charlie | 50  |

All bids remain encrypted throughout execution.

During the auction:

- Highest bid remains encrypted.
- Winner remains encrypted.
- No participant can determine the current leader from on-chain data.

After finalization:

- Winning Bid: 77
- Winner: Bob

## Future Work

- Gateway-based public revelation of only the winning bid and winner after finalization
- Threshold decryption mechanisms
- Economic Sybil-resistance mechanisms such as bidder deposits
- Automatic settlement and payment enforcement
- Hidden bidder identities
- Trust-minimized result publication
- Cross-chain deployment and interoperability

## Author

**Gvantsa Vakhtangishvili**

Privacy on Blockchain Course Project

Built using Zama fhEVM, Solidity, Hardhat, and Sepolia Testnet.
