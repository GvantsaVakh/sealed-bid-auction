import { FhevmType } from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

describe("EncryptedBidBox", function () {
  let signers: Signers;
  let contract: any;
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

    const factory = await ethers.getContractFactory("EncryptedBidBox");
    contract = await factory.deploy();
    contractAddress = await contract.getAddress();
  });

  it("should be empty after deployment", async function () {
    expect(await contract.hasBid(signers.alice.address)).to.eq(false);
    expect(await contract.hasBid(signers.bob.address)).to.eq(false);

    const aliceEncryptedBid = await contract.getEncryptedBid(signers.alice.address);
    const bobEncryptedBid = await contract.getEncryptedBid(signers.bob.address);

    expect(aliceEncryptedBid).to.eq(ethers.ZeroHash);
    expect(bobEncryptedBid).to.eq(ethers.ZeroHash);
  });

  it("Alice can submit encrypted bid 42", async function () {
    const clearBid = 42;

    const encryptedBid = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add32(clearBid)
      .encrypt();

    const tx = await contract.connect(signers.alice).submitBid(encryptedBid.handles[0], encryptedBid.inputProof);
    await tx.wait();

    expect(await contract.hasBid(signers.alice.address)).to.eq(true);
    expect(await contract.hasBid(signers.bob.address)).to.eq(false);

    const encryptedStoredBid = await contract.getEncryptedBid(signers.alice.address);

    const decryptedStoredBid = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedStoredBid,
      contractAddress,
      signers.alice,
    );

    expect(decryptedStoredBid).to.eq(clearBid);
  });

  it("Alice and Bob can submit separate encrypted bids", async function () {
    const aliceClearBid = 42;
    const bobClearBid = 77;

    const aliceEncryptedBid = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add32(aliceClearBid)
      .encrypt();

    let tx = await contract
      .connect(signers.alice)
      .submitBid(aliceEncryptedBid.handles[0], aliceEncryptedBid.inputProof);
    await tx.wait();

    const bobEncryptedBid = await fhevm
      .createEncryptedInput(contractAddress, signers.bob.address)
      .add32(bobClearBid)
      .encrypt();

    tx = await contract.connect(signers.bob).submitBid(bobEncryptedBid.handles[0], bobEncryptedBid.inputProof);
    await tx.wait();

    expect(await contract.hasBid(signers.alice.address)).to.eq(true);
    expect(await contract.hasBid(signers.bob.address)).to.eq(true);

    const aliceStoredBid = await contract.getEncryptedBid(signers.alice.address);
    const bobStoredBid = await contract.getEncryptedBid(signers.bob.address);

    const decryptedAliceBid = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      aliceStoredBid,
      contractAddress,
      signers.alice,
    );

    const decryptedBobBid = await fhevm.userDecryptEuint(FhevmType.euint32, bobStoredBid, contractAddress, signers.bob);

    expect(decryptedAliceBid).to.eq(aliceClearBid);
    expect(decryptedBobBid).to.eq(bobClearBid);
  });
});
