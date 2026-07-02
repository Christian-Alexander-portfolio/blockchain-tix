import { ethers } from 'ethers';
import { config } from '../config';

// Minimal ABIs — only what we call
const NFT_ABI = [
  'function mintTicket(address to, uint256 eventId, uint256 tierId, uint256 faceValueCents) external returns (uint256)',
  'function markScanned(uint256 tokenId) external',
  'function getFaceValueCents(uint256 tokenId) external view returns (uint256)',
  'function ownerOf(uint256 tokenId) external view returns (address)',
  'function setMarketplace(address marketplace) external',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
];

const MARKETPLACE_ABI = [
  'function listTicket(uint256 tokenId, uint256 askPriceCents, address seller, bool isUsdcPayment) external returns (uint256)',
  'function cancelListing(uint256 listingId) external',
  'function fulfillBraintreeSale(uint256 listingId, address buyer) external',
  'function fulfillUsdcSale(uint256 listingId, address buyer, uint256 usdcAmount) external',
  'function listings(uint256) external view returns (uint256 tokenId, address seller, uint256 askPriceCents, bool active, bool isUsdcPayment)',
  'function setMaxResaleMarkupBps(uint256 bps) external',
  'function setPlatformFeeBps(uint256 bps) external',
  'event TicketListed(uint256 indexed listingId, uint256 indexed tokenId, address indexed seller, uint256 askPriceCents)',
  'event TicketSold(uint256 indexed listingId, uint256 indexed tokenId, address indexed buyer, uint256 salePriceCents)',
];

const USDC_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address, uint256) returns (bool)',
  'function transferFrom(address, address, uint256) returns (bool)',
  'function approve(address, uint256) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];

let _provider: ethers.JsonRpcProvider | null = null;
let _deployerWallet: ethers.Wallet | null = null;

export function getProvider(): ethers.JsonRpcProvider {
  if (!_provider) {
    _provider = new ethers.JsonRpcProvider(config.polygonRpcUrl);
  }
  return _provider;
}

export function getDeployerWallet(): ethers.Wallet {
  if (!_deployerWallet) {
    _deployerWallet = new ethers.Wallet(config.deployerPrivateKey, getProvider());
  }
  return _deployerWallet;
}

export function getNftContract(signer?: ethers.Signer): ethers.Contract {
  return new ethers.Contract(
    config.nftContractAddress,
    NFT_ABI,
    signer ?? getDeployerWallet(),
  );
}

export function getMarketplaceContract(signer?: ethers.Signer): ethers.Contract {
  return new ethers.Contract(
    config.marketplaceContractAddress,
    MARKETPLACE_ABI,
    signer ?? getDeployerWallet(),
  );
}

export function getUsdcContract(signer?: ethers.Signer): ethers.Contract {
  return new ethers.Contract(
    config.usdcContractAddress,
    USDC_ABI,
    signer ?? getProvider(),
  );
}

export function getWalletSigner(privateKey: string): ethers.Wallet {
  return new ethers.Wallet(privateKey, getProvider());
}

/** Extract tokenId from the Transfer event emitted during mint */
export function extractTokenIdFromMintReceipt(
  receipt: ethers.TransactionReceipt,
): bigint {
  const nftInterface = new ethers.Interface(NFT_ABI);
  for (const log of receipt.logs) {
    try {
      const parsed = nftInterface.parseLog({ topics: [...log.topics], data: log.data });
      if (parsed?.name === 'Transfer' && parsed.args[0] === ethers.ZeroAddress) {
        return parsed.args[2] as bigint;
      }
    } catch {
      // not this contract's log
    }
  }
  throw new Error('Transfer event not found in mint receipt');
}
