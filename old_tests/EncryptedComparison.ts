import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { EncryptedComparison, EncryptedComparison__factory } from "../types";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

describe("EncryptedComparison", function () {
  let signers: Signers;
  let contract: EncryptedComparison;
  let contractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();

    signers = {
      deployer: ethSigners[0],
      alice: ethSigners[1],
      bob: ethSigners[2],
    };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn("This test only runs in local mock mode");
      this.skip();
    }

    const factory = (await ethers.getContractFactory("EncryptedComparison")) as EncryptedComparison__factory;
    contract = (await factory.deploy()) as EncryptedComparison;
    contractAddress = await contract.getAddress();
  });

  it("Alice and Bob can submit separate encrypted bids", async function () {
    const aliceBid = 42;
    const bobBid = 77;

    const aliceEncryptedBid = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add32(aliceBid)
      .encrypt();

    let tx = await contract
      .connect(signers.alice)
      .submitBid(aliceEncryptedBid.handles[0], aliceEncryptedBid.inputProof);
    await tx.wait();

    const bobEncryptedBid = await fhevm
      .createEncryptedInput(contractAddress, signers.bob.address)
      .add32(bobBid)
      .encrypt();

    tx = await contract.connect(signers.bob).submitBid(bobEncryptedBid.handles[0], bobEncryptedBid.inputProof);
    await tx.wait();

    expect(await contract.hasBid(signers.alice.address)).to.eq(true);
    expect(await contract.hasBid(signers.bob.address)).to.eq(true);
  });

  it("detects that Bob's encrypted bid is higher than Alice's", async function () {
    const aliceBid = 42;
    const bobBid = 77;

    const aliceEncryptedBid = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add32(aliceBid)
      .encrypt();

    let tx = await contract
      .connect(signers.alice)
      .submitBid(aliceEncryptedBid.handles[0], aliceEncryptedBid.inputProof);
    await tx.wait();

    const bobEncryptedBid = await fhevm
      .createEncryptedInput(contractAddress, signers.bob.address)
      .add32(bobBid)
      .encrypt();

    tx = await contract.connect(signers.bob).submitBid(bobEncryptedBid.handles[0], bobEncryptedBid.inputProof);
    await tx.wait();

    tx = await contract.connect(signers.deployer).compareBids(signers.bob.address, signers.alice.address);
    await tx.wait();

    const encryptedResult = await contract.getLastComparisonResult();

    const decryptedResult = await fhevm.userDecryptEbool(encryptedResult, contractAddress, signers.deployer);

    expect(decryptedResult).to.eq(true);
  });

  it("detects that Alice's encrypted bid is not higher than Bob's", async function () {
    const aliceBid = 42;
    const bobBid = 77;

    const aliceEncryptedBid = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add32(aliceBid)
      .encrypt();

    let tx = await contract
      .connect(signers.alice)
      .submitBid(aliceEncryptedBid.handles[0], aliceEncryptedBid.inputProof);
    await tx.wait();

    const bobEncryptedBid = await fhevm
      .createEncryptedInput(contractAddress, signers.bob.address)
      .add32(bobBid)
      .encrypt();

    tx = await contract.connect(signers.bob).submitBid(bobEncryptedBid.handles[0], bobEncryptedBid.inputProof);
    await tx.wait();

    tx = await contract.connect(signers.deployer).compareBids(signers.alice.address, signers.bob.address);
    await tx.wait();

    const encryptedResult = await contract.getLastComparisonResult();

    const decryptedResult = await fhevm.userDecryptEbool(encryptedResult, contractAddress, signers.deployer);

    expect(decryptedResult).to.eq(false);
  });

  it("reverts if one of the bidders has not submitted a bid", async function () {
    const aliceBid = 42;

    const aliceEncryptedBid = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add32(aliceBid)
      .encrypt();

    const tx = await contract
      .connect(signers.alice)
      .submitBid(aliceEncryptedBid.handles[0], aliceEncryptedBid.inputProof);
    await tx.wait();

    await expect(contract.compareBids(signers.alice.address, signers.bob.address)).to.be.revertedWithCustomError(
      contract,
      "SecondBidderHasNoBid",
    );
  });
});
