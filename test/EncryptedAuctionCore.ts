import { FhevmType } from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { EncryptedAuctionCore, EncryptedAuctionCore__factory } from "../types";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
  charlie: HardhatEthersSigner;
};

describe("EncryptedAuctionCore", function () {
  let signers: Signers;
  let contract: EncryptedAuctionCore;
  let contractAddress: string;

  const auctionDuration = 100;
  const itemName = "Test NFT";

  async function deployAuction() {
    const factory = (await ethers.getContractFactory("EncryptedAuctionCore")) as EncryptedAuctionCore__factory;
    contract = (await factory.deploy(auctionDuration, itemName)) as EncryptedAuctionCore;
    contractAddress = await contract.getAddress();
  }

  async function submitEncryptedBid(bidder: HardhatEthersSigner, clearBid: number) {
    const encryptedBid = await fhevm.createEncryptedInput(contractAddress, bidder.address).add32(clearBid).encrypt();

    const tx = await contract.connect(bidder).submitBid(encryptedBid.handles[0], encryptedBid.inputProof);
    await tx.wait();
  }

  async function decryptHighestBid() {
    const encryptedHighestBid = await contract.getHighestBid();

    return await fhevm.userDecryptEuint(FhevmType.euint32, encryptedHighestBid, contractAddress, signers.deployer);
  }

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();

    signers = {
      deployer: ethSigners[0],
      alice: ethSigners[1],
      bob: ethSigners[2],
      charlie: ethSigners[3],
    };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn("This test only runs in local mock mode");
      this.skip();
    }

    await deployAuction();
  });

  it("deploys with item name and auction duration", async function () {
    expect(await contract.owner()).to.eq(signers.deployer.address);
    expect(await contract.itemName()).to.eq(itemName);
    expect(await contract.hasAnyBid()).to.eq(false);
    expect(await contract.isActive()).to.eq(true);

    const endTime = await contract.auctionEndTime();
    expect(endTime).to.be.greaterThan(0);
  });

  it("rejects reading highest bid before any bid exists", async function () {
    await expect(contract.getHighestBid()).to.be.revertedWithCustomError(contract, "NoBidYet");
  });

  it("accepts encrypted bid while auction is active", async function () {
    await submitEncryptedBid(signers.alice, 42);

    expect(await contract.hasAnyBid()).to.eq(true);
    expect(await contract.hasBid(signers.alice.address)).to.eq(true);

    const highestBid = await decryptHighestBid();
    expect(highestBid).to.eq(42);
  });

  it("updates highest bid across multiple bidders", async function () {
    await submitEncryptedBid(signers.alice, 42);
    await submitEncryptedBid(signers.bob, 77);
    await submitEncryptedBid(signers.charlie, 50);

    const highestBid = await decryptHighestBid();
    expect(highestBid).to.eq(77);
  });

  it("rejects bids after auction ends", async function () {
    await time.increase(auctionDuration + 1);

    const encryptedBid = await fhevm.createEncryptedInput(contractAddress, signers.alice.address).add32(42).encrypt();

    await expect(
      contract.connect(signers.alice).submitBid(encryptedBid.handles[0], encryptedBid.inputProof),
    ).to.be.revertedWithCustomError(contract, "AuctionAlreadyEnded");
  });

  it("stores each bidder's encrypted bid separately", async function () {
    await submitEncryptedBid(signers.alice, 42);
    await submitEncryptedBid(signers.bob, 77);

    const aliceEncryptedBid = await contract.getEncryptedBid(signers.alice.address);
    const bobEncryptedBid = await contract.getEncryptedBid(signers.bob.address);

    const aliceBid = await fhevm.userDecryptEuint(FhevmType.euint32, aliceEncryptedBid, contractAddress, signers.alice);

    const bobBid = await fhevm.userDecryptEuint(FhevmType.euint32, bobEncryptedBid, contractAddress, signers.bob);

    expect(aliceBid).to.eq(42);
    expect(bobBid).to.eq(77);
  });
});
