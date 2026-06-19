import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedAuction = await deploy("SealedBidAuction", {
    from: deployer,
    args: [36000, "Rare NFT #42"],
    log: true,
  });

  console.log(`SealedBidAuction contract:`, deployedAuction.address);
};

export default func;
func.id = "deploy_sealed_bid_auction";
func.tags = ["SealedBidAuction"];
