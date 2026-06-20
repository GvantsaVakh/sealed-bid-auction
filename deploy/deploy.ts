import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const auctionDuration = 600;
  const itemName = "Rare NFT #42";

  const deployedAuction = await deploy("SealedBidAuction", {
    from: deployer,
    args: [auctionDuration, itemName],
    log: true,
  });

  console.log("SealedBidAuction contract:", deployedAuction.address);
  console.log("Auction item:", itemName);
  console.log("Auction duration:", auctionDuration, "seconds");
};

export default func;
func.id = "deploy_sealed_bid_auction";
func.tags = ["SealedBidAuction"];