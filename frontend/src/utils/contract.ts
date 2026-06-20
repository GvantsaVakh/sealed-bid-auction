import { BrowserProvider, Contract } from "ethers";
import auctionArtifact from "../abi/SealedBidAuction.json";
import { SEPOLIA_CHAIN_ID_HEX } from "../config";

export async function requireMetaMask() {
  if (!window.ethereum) {
    throw new Error("MetaMask is not installed.");
  }

  return window.ethereum;
}

export async function switchToSepolia() {
  const ethereum = await requireMetaMask();

  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }],
    });
  } catch (error) {
    throw new Error(`Please switch MetaMask to Sepolia. Details: ${String(error)}`);
  }
}

export async function connectWallet() {
  const ethereum = await requireMetaMask();

  await switchToSepolia();

  const accounts = (await ethereum.request({
    method: "eth_requestAccounts",
  })) as string[];

  if (accounts.length === 0) {
    throw new Error("No wallet account found.");
  }

  return accounts[0];
}

export async function getProvider() {
  const ethereum = await requireMetaMask();
  return new BrowserProvider(ethereum);
}

export async function getSigner() {
  const provider = await getProvider();
  return provider.getSigner();
}

export async function getAuctionContract(contractAddress: string) {
  const signer = await getSigner();

  return new Contract(contractAddress, auctionArtifact.abi, signer);
}

export function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}