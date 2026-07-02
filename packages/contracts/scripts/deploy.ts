import { ethers, network } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

// USDC addresses by network
const USDC_ADDRESSES: Record<string, string> = {
  polygon: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // native USDC on Polygon mainnet
  amoy: process.env.USDC_AMOY_ADDRESS ?? '', // deploy a mock on testnet
  localhost: '', // will be set after mock deploy
  hardhat: '',
};

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`\nDeploying to network: ${network.name}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} MATIC\n`);

  let usdcAddress = USDC_ADDRESSES[network.name];

  // On local/test networks, deploy a mock ERC-20 for USDC
  if (!usdcAddress) {
    console.log('Deploying MockUSDC...');
    const MockUSDC = await ethers.getContractFactory('MockUSDC');
    const mockUsdc = await MockUSDC.deploy();
    await mockUsdc.waitForDeployment();
    usdcAddress = await mockUsdc.getAddress();
    console.log(`MockUSDC deployed to: ${usdcAddress}`);
  }

  // Deploy TicketNFT
  console.log('Deploying TicketNFT...');
  const baseURI = process.env.NFT_BASE_URI ?? 'https://api.blockchaintickets.app/metadata/';
  const TicketNFT = await ethers.getContractFactory('TicketNFT');
  const nft = await TicketNFT.deploy(deployer.address, baseURI);
  await nft.waitForDeployment();
  const nftAddress = await nft.getAddress();
  console.log(`TicketNFT deployed to: ${nftAddress}`);

  // Deploy TicketMarketplace (2.5% fee, 15% max markup)
  console.log('Deploying TicketMarketplace...');
  const TicketMarketplace = await ethers.getContractFactory('TicketMarketplace');
  const marketplace = await TicketMarketplace.deploy(
    nftAddress,
    usdcAddress,
    250,  // 2.5% platform fee
    1500, // 15% max resale markup
    deployer.address, // fee recipient (update later)
  );
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  console.log(`TicketMarketplace deployed to: ${marketplaceAddress}`);

  // Wire them together: set marketplace on NFT so it can call safeTransferFrom
  console.log('Setting marketplace on TicketNFT...');
  const setTx = await nft.setMarketplace(marketplaceAddress);
  await setTx.wait(1);
  console.log('Marketplace set on TicketNFT.');

  // Save addresses
  const addresses = {
    network: network.name,
    nftAddress,
    marketplaceAddress,
    usdcAddress,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };

  const outPath = path.join(__dirname, '..', `deployed-${network.name}.json`);
  fs.writeFileSync(outPath, JSON.stringify(addresses, null, 2));
  console.log(`\nAddresses saved to deployed-${network.name}.json`);
  console.log(JSON.stringify(addresses, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
