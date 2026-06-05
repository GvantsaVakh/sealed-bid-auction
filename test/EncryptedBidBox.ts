import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
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
    const encryptedBid = await contract.getEncryptedBid();

    expect(encryptedBid).to.eq(ethers.ZeroHash);
    expect(await contract.hasBid()).to.eq(false);
  });

  it("Alice can submit encrypted bid 42", async function () {
    const clearBid = 42;

    const encryptedBid = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add32(clearBid)
      .encrypt();

    const tx = await contract.connect(signers.alice).submitBid(encryptedBid.handles[0], encryptedBid.inputProof);

    await tx.wait();

    expect(await contract.hasBid()).to.eq(true);
    expect(await contract.lastBidder()).to.eq(signers.alice.address);

    const encryptedStoredBid = await contract.getEncryptedBid();

    const decryptedStoredBid = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedStoredBid,
      contractAddress,
      signers.alice,
    );

    expect(decryptedStoredBid).to.eq(clearBid);
  });
});
