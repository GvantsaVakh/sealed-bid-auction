export const SEPOLIA_CHAIN_ID_DECIMAL = 11155111;
export const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7";

export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS as string;

export function requireContractAddress() {
  if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS === "0xYourDeployedSealedBidAuctionAddress") {
    throw new Error("Set VITE_CONTRACT_ADDRESS in frontend/.env");
  }

  return CONTRACT_ADDRESS;
}