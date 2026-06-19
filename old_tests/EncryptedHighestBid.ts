import { FhevmType } from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { EncryptedHighestBid, EncryptedHighestBid__factory } from "../types";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
  charlie: HardhatEthersSigner;
};

describe("EncryptedHighestBid", function () {
  let signers: Signers;
  let contract: EncryptedHighestBid;
  let contractAddress: string;

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

    const factory = (await ethers.getContractFactory("EncryptedHighestBid")) as EncryptedHighestBid__factory;
    contract = (await factory.deploy()) as EncryptedHighestBid;
    contractAddress = await contract.getAddress();
  });

  it("should not have any bid after deployment", async function () {
    expect(await contract.hasAnyBid()).to.eq(false);
    expect(await contract.owner()).to.eq(signers.deployer.address);

    await expect(contract.getHighestBid()).to.be.revertedWithCustomError(contract, "NoBidYet");
  });

  it("sets first encrypted bid as highest bid", async function () {
    await submitEncryptedBid(signers.alice, 42);

    expect(await contract.hasAnyBid()).to.eq(true);
    expect(await contract.hasBid(signers.alice.address)).to.eq(true);

    const highestBid = await decryptHighestBid();

    expect(highestBid).to.eq(42);
  });

  it("updates highest bid when Bob bids higher than Alice", async function () {
    await submitEncryptedBid(signers.alice, 42);
    await submitEncryptedBid(signers.bob, 77);

    const highestBid = await decryptHighestBid();

    expect(highestBid).to.eq(77);
  });

  it("keeps highest bid when Charlie bids lower than Bob", async function () {
    await submitEncryptedBid(signers.alice, 42);
    await submitEncryptedBid(signers.bob, 77);
    await submitEncryptedBid(signers.charlie, 50);

    const highestBid = await decryptHighestBid();

    expect(highestBid).to.eq(77);
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
