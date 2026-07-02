import { ethers } from 'hardhat';
import { expect } from 'chai';
import { TicketNFT, TicketMarketplace, MockUSDC } from '../typechain-types';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

describe('TicketMarketplace', () => {
  let nft: TicketNFT;
  let marketplace: TicketMarketplace;
  let usdc: MockUSDC;
  let owner: HardhatEthersSigner;
  let seller: HardhatEthersSigner;
  let buyer: HardhatEthersSigner;

  const FACE_VALUE = 5000n; // $50.00 in cents
  const MAX_MARKUP_BPS = 1500n; // 15%
  const PLATFORM_FEE_BPS = 250n; // 2.5%

  beforeEach(async () => {
    [owner, seller, buyer] = await ethers.getSigners();

    const MockUSDCFactory = await ethers.getContractFactory('MockUSDC');
    usdc = await MockUSDCFactory.deploy();

    const TicketNFTFactory = await ethers.getContractFactory('TicketNFT');
    nft = await TicketNFTFactory.deploy(owner.address, 'https://api.test.com/metadata/');

    const MarketplaceFactory = await ethers.getContractFactory('TicketMarketplace');
    marketplace = await MarketplaceFactory.deploy(
      await nft.getAddress(),
      await usdc.getAddress(),
      PLATFORM_FEE_BPS,
      MAX_MARKUP_BPS,
      owner.address,
    );

    await nft.setMarketplace(await marketplace.getAddress());

    // Mint a ticket to seller
    await nft.mintTicket(seller.address, 1n, 1n, FACE_VALUE);
  });

  describe('Listing', () => {
    it('lists a ticket for resale at face value', async () => {
      const tx = await marketplace.listTicket(1n, FACE_VALUE, seller.address, false);
      const receipt = await tx.wait();
      expect(receipt?.status).to.equal(1);

      const listing = await marketplace.listings(0n);
      expect(listing.tokenId).to.equal(1n);
      expect(listing.seller).to.equal(seller.address);
      expect(listing.askPriceCents).to.equal(FACE_VALUE);
      expect(listing.active).to.equal(true);
    });

    it('lists a ticket at max allowed markup (15%)', async () => {
      const maxPrice = FACE_VALUE + (FACE_VALUE * MAX_MARKUP_BPS) / 10000n;
      await expect(marketplace.listTicket(1n, maxPrice, seller.address, false)).to.not.be.reverted;
    });

    it('rejects listing above max markup', async () => {
      const tooHigh = FACE_VALUE + (FACE_VALUE * 2000n) / 10000n; // 20% markup
      await expect(
        marketplace.listTicket(1n, tooHigh, seller.address, false),
      ).to.be.revertedWith('Marketplace: price exceeds max markup');
    });

    it('rejects listing below face value', async () => {
      await expect(
        marketplace.listTicket(1n, FACE_VALUE - 1n, seller.address, false),
      ).to.be.revertedWith('Marketplace: price below face value');
    });

    it('rejects listing if seller does not own token', async () => {
      await expect(
        marketplace.listTicket(1n, FACE_VALUE, buyer.address, false),
      ).to.be.revertedWith('Marketplace: seller does not own token');
    });
  });

  describe('Braintree sale (off-chain payment)', () => {
    beforeEach(async () => {
      await marketplace.listTicket(1n, 5500n, seller.address, false); // listingId = 0
    });

    it('transfers NFT from seller to buyer on fulfillment', async () => {
      await marketplace.fulfillBraintreeSale(0n, buyer.address);
      expect(await nft.ownerOf(1n)).to.equal(buyer.address);
    });

    it('marks listing as inactive after sale', async () => {
      await marketplace.fulfillBraintreeSale(0n, buyer.address);
      const listing = await marketplace.listings(0n);
      expect(listing.active).to.equal(false);
    });

    it('rejects double-fulfillment', async () => {
      await marketplace.fulfillBraintreeSale(0n, buyer.address);
      await expect(
        marketplace.fulfillBraintreeSale(0n, buyer.address),
      ).to.be.revertedWith('Marketplace: listing not active');
    });

    it('emits TicketSold event', async () => {
      await expect(marketplace.fulfillBraintreeSale(0n, buyer.address))
        .to.emit(marketplace, 'TicketSold')
        .withArgs(0n, 1n, buyer.address, 5500n);
    });
  });

  describe('USDC sale (on-chain payment)', () => {
    const ASK_PRICE_CENTS = 5500n;
    // Convert cents to USDC 6-decimal: $55.00 = 55_000_000 USDC wei
    const ASK_PRICE_USDC = 55_000_000n;

    beforeEach(async () => {
      await marketplace.listTicket(1n, ASK_PRICE_CENTS, seller.address, true); // listingId = 0
      // Fund buyer with USDC
      await usdc.mint(buyer.address, ASK_PRICE_USDC * 10n);
      // Buyer approves marketplace
      await usdc
        .connect(buyer)
        .approve(await marketplace.getAddress(), ASK_PRICE_USDC);
    });

    it('transfers NFT and USDC on fulfillment', async () => {
      const sellerBalanceBefore = await usdc.balanceOf(seller.address);
      await marketplace.fulfillUsdcSale(0n, buyer.address, ASK_PRICE_USDC);

      expect(await nft.ownerOf(1n)).to.equal(buyer.address);
      const fee = (ASK_PRICE_USDC * PLATFORM_FEE_BPS) / 10000n;
      const sellerAmount = ASK_PRICE_USDC - fee;
      expect(await usdc.balanceOf(seller.address)).to.equal(sellerBalanceBefore + sellerAmount);
      expect(await usdc.balanceOf(await marketplace.getAddress())).to.equal(fee);
    });
  });

  describe('Admin controls', () => {
    it('owner can update max markup', async () => {
      await marketplace.setMaxResaleMarkupBps(2000n);
      expect(await marketplace.maxResaleMarkupBps()).to.equal(2000n);
    });

    it('owner can update platform fee', async () => {
      await marketplace.setPlatformFeeBps(500n);
      expect(await marketplace.platformFeeBps()).to.equal(500n);
    });

    it('rejects fee above 20%', async () => {
      await expect(marketplace.setPlatformFeeBps(2001n)).to.be.revertedWith(
        'Fee cannot exceed 20%',
      );
    });

    it('rejects markup above 100%', async () => {
      await expect(marketplace.setMaxResaleMarkupBps(10001n)).to.be.revertedWith(
        'Cannot exceed 100%',
      );
    });
  });
});
