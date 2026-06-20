import { getAddress } from "ethers";
import { getSigner } from "./contract";

type FhevmInstance = any;

let fheInstance: FhevmInstance | null = null;

async function loadZamaSdk() {
  return await import("@zama-fhe/relayer-sdk/web");
}

export async function getFheInstance() {
  if (fheInstance) {
    return fheInstance;
  }

  const { createInstance, initSDK, SepoliaConfig } = await loadZamaSdk();

  await initSDK({
    tfheParams: "/tfhe_bg.wasm",
    kmsParams: "/kms_lib_bg.wasm",
  });

  const ethereum = window.ethereum;

  if (!ethereum) {
    throw new Error("MetaMask is not available.");
  }

  fheInstance = await createInstance({
    ...SepoliaConfig,
    network: ethereum as any,
    relayerUrl: "https://relayer.testnet.zama.org",
    gatewayChainId: 10901,
  });

  return fheInstance;
}

export async function encryptBid(contractAddress: string, userAddress: string, bidAmount: number) {
  if (!Number.isInteger(bidAmount) || bidAmount <= 0) {
    throw new Error("Bid must be a positive integer.");
  }

  if (bidAmount > 4_294_967_295) {
    throw new Error("Bid is too large for euint32.");
  }

  const instance = await getFheInstance();

  const normalizedContractAddress = getAddress(contractAddress);
  const normalizedUserAddress = getAddress(userAddress);

  console.log("Encrypting for contract:", normalizedContractAddress);
  console.log("Encrypting for user:", normalizedUserAddress);

  const encryptedInput = instance.createEncryptedInput(normalizedContractAddress, normalizedUserAddress);
  encryptedInput.add32(BigInt(bidAmount));

  const encrypted = await encryptedInput.encrypt();

  return {
    handle: encrypted.handles[0],
    inputProof: encrypted.inputProof,
  };
}

export async function decryptAuctionResults(
  contractAddress: string,
  encryptedHighestBid: string,
  encryptedSecondHighestBid: string,
  encryptedWinnerId: string,
  userAddress: string,
) {
  const instance = await getFheInstance();
  const signer = await getSigner();

  const normalizedContractAddress = getAddress(contractAddress);
  const normalizedUserAddress = getAddress(userAddress);

  const keypair = instance.generateKeypair();
  const startTimeStamp = Math.floor(Date.now() / 1000);
  const durationDays = 10;
  const contractAddresses = [normalizedContractAddress];
  const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimeStamp, durationDays);

  const signature = await signer.signTypedData(
    eip712.domain,
    {
      UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification,
    },
    eip712.message,
  );

  const handleContractPairs = [
    {
      handle: encryptedHighestBid,
      contractAddress: normalizedContractAddress,
    },
    {
      handle: encryptedSecondHighestBid,
      contractAddress: normalizedContractAddress,
    },
    {
      handle: encryptedWinnerId,
      contractAddress: normalizedContractAddress,
    },
  ];

  const result = await instance.userDecrypt(
    handleContractPairs,
    keypair.privateKey,
    keypair.publicKey,
    signature.replace("0x", ""),
    contractAddresses,
    normalizedUserAddress,
    startTimeStamp,
    durationDays,
  );

  return {
    highestBid: result[encryptedHighestBid],
    secondHighestBid: result[encryptedSecondHighestBid],
    winnerId: result[encryptedWinnerId],
  };
}
