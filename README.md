# Confidential Vickrey Auction Using Fully Homomorphic Encryption (FHE)

A privacy-preserving sealed-bid second-price auction built using Zama's fhEVM protocol. Bids are encrypted before they
are submitted on-chain, and the smart contract privately computes the highest bid, the second-highest bid, and the
winner without revealing individual bid values during the auction.

This project demonstrates how Fully Homomorphic Encryption (FHE) can be used to keep auction bids confidential while
still allowing verifiable smart contract logic on a public blockchain.

## Overview

Traditional blockchain auctions expose bid values because transaction data and contract state are publicly visible. This
is a problem for sealed-bid auctions, procurement systems, private NFT sales, or any setting where bidders should not
learn each other's bids during the auction.

This project solves that problem by using encrypted bid values. Each bidder encrypts their bid locally before submitting
it. The smart contract receives only an encrypted handle and a cryptographic proof. It then uses FHE operations to
compare encrypted bids and update the encrypted auction state.

The final auction type is a **Vickrey auction**, also called a **second-price sealed-bid auction**:

- The highest bidder wins.
- The winner does not pay their own bid.
- The winner pays the second-highest bid.

For example, if the bids are 42, 77, and 50, then the bidder who submitted 77 wins, but the final price is 50.

## Final Implementation

The final contract is:

```text
contracts/SealedBidAuction.sol
```

The frontend is:

```text
frontend/
```

The project includes:

- Solidity smart contract
- Hardhat deployment scripts
- Local test suite
- Demo test showing the full Vickrey auction flow
- React/Vite frontend
- Sepolia deployment support
- Browser-side encrypted bid submission
- Owner-only decryption after finalization
- Optional owner-published public result

## Privacy Properties

This implementation provides:

- Bid value confidentiality during the auction
- Confidential highest bid tracking
- Confidential second-highest bid tracking
- Confidential winner determination during the auction
- One bid per address
- On-chain verifiable auction logic
- Public final result after the owner publishes it

This implementation does not provide:

- Bidder anonymity
- Hidden participation metadata
- Sybil resistance
- Fully trust-minimized public result publication
- Automatic contract execution at the deadline

Bidder Ethereum addresses are public because Ethereum transactions are public. The project hides bid values, not
participant addresses.

## Threat Model

The project protects against:

- Public blockchain observers trying to read bid values
- Competing bidders trying to learn other bids during the auction
- Auction owners inspecting plaintext bids before auction completion
- Public observers learning the current winner before finalization/decryption

The project does not protect against:

- Users creating multiple Ethereum addresses
- Public observation of bidder addresses
- Malicious or incorrect owner-published reveal
- Adversaries controlling the underlying FHE/gateway infrastructure
- Trust issues in the decryption authority

## Trust Assumptions

This project assumes:

- Zama fhEVM encryption and gateway infrastructure work correctly.
- Bids are encrypted locally before being sent on-chain.
- The smart contract only receives encrypted handles and input proofs.
- The owner cannot decrypt the auction result before finalization.
- After finalization, the owner is allowed to decrypt the final encrypted result.
- The owner-published public result is trusted to match the decrypted result.

A production version should use a trust-minimized gateway public decryption callback instead of owner-published reveal.

## How It Works

### 1. Bid Submission

A bidder enters a bid in the frontend.

The bid is encrypted locally in the browser using the Zama Relayer SDK. The plaintext number is not sent to the
blockchain.

The frontend calls:

```solidity
submitBid(externalEuint32 inputBid, bytes calldata inputProof)
```

The contract receives:

- an encrypted bid handle
- an input proof

The contract does not receive the plaintext bid amount.

Each address can submit only one bid. If the same address tries to bid again, the contract reverts and the frontend
disables the bid button.

### 2. Bidder IDs

Ethereum addresses are public, but encrypted addresses are not used directly.

Instead, the contract assigns each bidder a public numeric ID:

```solidity
mapping(address bidder => uint32 id) public bidderIds;
mapping(uint32 id => address bidder) public bidderById;
```

The winner is stored as an encrypted numeric ID:

```solidity
euint32 private encryptedWinnerId;
```

This means public observers can see who participated, but they cannot know which bidder ID is the winner until the
result is decrypted.

### 3. Encrypted Vickrey Logic

The contract maintains:

```solidity
euint32 private highestBid;
euint32 private secondHighestBid;
euint32 private encryptedWinnerId;
```

When a new encrypted bid is submitted, the contract uses:

```solidity
FHE.gt()
```

to compare encrypted values, and:

```solidity
FHE.select()
```

to update the encrypted state.

The logic is:

- If the new bid is greater than the current highest bid:
  - previous highest becomes second-highest
  - new bid becomes highest
  - winner ID becomes current bidder ID

- Else if the new bid is greater than the current second-highest bid:
  - second-highest is updated

- Otherwise:
  - nothing changes

At no point during the auction are bid values decrypted.

### 4. Finalization

After the deadline, the auction must be finalized manually by calling:

```solidity
endAuction()
```

The contract cannot automatically execute itself when the deadline passes. Someone must call the finalization function.
This can be the owner, another user, or an automation service.

During finalization, the contract grants the owner permission to decrypt:

- encrypted highest bid
- encrypted second-highest bid
- encrypted winner ID

The owner can then decrypt the result through the frontend.

### 5. Owner Decryption

After finalization, only the owner can click:

```text
Decrypt Result
```

The frontend requests a MetaMask signature and uses the Zama user decryption flow.

The decrypted result is shown in the owner's browser:

- highest bid
- Vickrey price
- winner ID
- winner address

This decryption is local/off-chain. It does not automatically publish the result on-chain.

### 6. Publishing the Result On-chain

After decrypting the result, the owner can click:

```text
Publish Result On-chain
```

This calls:

```solidity
publishResult(uint32 winnerId, uint32 highestBidPlain, uint32 vickreyPricePlain)
```

The contract then stores the public result:

```solidity
uint32 public publicWinnerId;
address public publicWinner;
uint32 public publicHighestBid;
uint32 public publicVickreyPrice;
bool public resultPublished;
```

After this, anyone can read the final result from the blockchain.

This is a simplified owner-published reveal mechanism. It is useful for demo purposes, but it is not fully
trust-minimized because the contract does not cryptographically verify that the owner published the correct decrypted
values.

A production version should use Zama gateway public decryption callback logic.

## Frontend Features

The frontend provides a full live demo interface:

- Connect MetaMask wallet
- Read auction state
- Show item name, owner, status, bid count, and contract address
- Encrypt bid locally in the browser
- Submit encrypted bid transaction
- Prevent duplicate bids from the same address
- Disable bidding after the auction ends
- Disable finalization while the auction is still active
- Allow only the owner to decrypt the result
- Publish decrypted result on-chain
- Show event log explaining each action

Main frontend files:

```text
frontend/src/App.tsx
frontend/src/utils/fhe.ts
frontend/src/utils/contract.ts
frontend/src/config.ts
frontend/src/abi/SealedBidAuction.json
```

## Contract Evolution

The project was developed incrementally through several earlier contracts:

### 1. EncryptedBidBox

Stores encrypted bids per address.

### 2. EncryptedComparison

Compares encrypted bids using `FHE.gt()`.

### 3. EncryptedHighestBid

Tracks the highest encrypted bid using `FHE.select()`.

### 4. EncryptedAuctionCore

Adds auction deadlines and active/inactive state.

### 5. EncryptedAuctionWithWinner

Tracks encrypted winner identifiers.

### 6. EncryptedAuctionFinalizable

Adds auction finalization logic.

### 7. SealedBidAuction

Final integrated implementation with:

- encrypted bid submission
- encrypted highest bid tracking
- encrypted second-highest bid tracking
- encrypted winner ID tracking
- one bid per address
- finalization
- owner decryption
- owner-published public result

## Security Model

### During the Auction

During the auction:

- Bid values remain encrypted.
- Individual bids are not revealed.
- Highest bid remains encrypted.
- Second-highest bid remains encrypted.
- Current winner ID remains encrypted.
- Public observers cannot determine bid amounts.
- Public observers cannot determine the current highest bidder.
- Owner cannot decrypt the final result before finalization.

### After Finalization

After finalization:

- Owner can decrypt the final result.
- Losing bids remain encrypted and are not revealed individually.
- The final result can optionally be published on-chain by the owner.

### After Publishing

After the owner publishes the result:

- Winner ID is public.
- Winner address is public.
- Highest bid is public.
- Vickrey price is public.
- Individual losing bids are still not published.

## Limitations

### Bidder Addresses Are Public

The project hides bid values, not bidder addresses. Anyone can see which addresses submitted transactions.

### No Sybil Resistance

A user can create multiple Ethereum addresses and bid multiple times from different accounts.

Possible mitigations include:

- allowlisted participants
- deposits
- identity systems
- proof-of-personhood
- collateral requirements

### Manual Finalization

The contract cannot finalize itself automatically when the deadline passes.

Someone must call:

```solidity
endAuction()
```

### Owner-Based Decryption

The owner receives decryption permission after finalization.

### No Payment Settlement

This project focuses on confidential bidding and encrypted winner computation.

It does not implement real ETH payment settlement, bidder deposits, automatic refunds, or NFT escrow.

## Sepolia Deployment and Live Interaction

The contract was deployed and tested on the Sepolia Ethereum test network.

During the live demo, encrypted bids were submitted from different MetaMask accounts. Etherscan shows the transactions
and calldata, but the bid values are not visible as plaintext. Instead, observers see encrypted handles and proof data.

After finalization, the owner decrypted the result through the frontend and published the final result on-chain.

Example public result from a demo run:

| Field          | Value                              |
| -------------- | ---------------------------------- |
| Highest bid    | 77                                 |
| Vickrey price  | 42                                 |
| Winner ID      | 2                                  |
| Winner address | Publicly readable after publishing |

## Demo Scenario

The demo can use the following bids:

| Bidder    | Bid |
| --------- | --- |
| Account 1 | 42  |
| Account 2 | 77  |

Expected result:

| Field         | Expected value |
| ------------- | -------------- |
| Winner        | Account 2      |
| Highest bid   | 77             |
| Vickrey price | 42             |

Explanation:

Account 2 wins because 77 is the highest bid. However, because this is a Vickrey auction, the winner pays 42, not 77.

## Running the Project

### Install dependencies

```bash
npm install
cd frontend
npm install
```

### Compile contracts

```bash
npm run compile
```

### Run tests

```bash
npm test
```

### Run demo test

```bash
npx hardhat test test/DemoSealedBidAuction.ts
```

### Format code

```bash
npm run prettier:write
```

### Lint code

```bash
npm run lint
```

### Build frontend

```bash
cd frontend
npm run build
```

### Run frontend

```bash
cd frontend
npm run dev
```

## Sepolia Deployment

Deploy a fresh contract:

```bash
npx hardhat deploy --network sepolia --tags SealedBidAuction --reset
```

Copy the deployed contract address into:

```text
frontend/.env
```

Example:

```env
VITE_CONTRACT_ADDRESS=0xYourDeployedContractAddress
```

Update the frontend ABI after recompiling the contract:

```bash
cp artifacts/contracts/SealedBidAuction.sol/SealedBidAuction.json frontend/src/abi/SealedBidAuction.json
```

## Future Work

- Trust-minimized gateway public decryption callback
- Automatic public result publication
- Threshold decryption
- Real ETH payment settlement
- NFT/item escrow
- Bidder deposits
- Sybil resistance
- Hidden bidder identities
- Allowlisted auctions
- Cross-chain deployment

## Author

**Gvantsa Vakhtangishvili**

Privacy on Blockchain Course Project

Project structure and 

Built using Zama fhEVM, Solidity, Hardhat, React, Vite, MetaMask, and Sepolia Testnet.
