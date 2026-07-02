import { ethers } from 'hardhat';
import { expect } from 'chai';
import { TicketNFT, TicketMarketplace, MockUSDC } from '../typechain-types';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

describe('TicketNFT', () => {
  let nft: TicketNFT;
  let marketplace: TicketMarketplace;
  let usdc: MockUSDC;
  let owner: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let attacker: HardhatEthersSigner;

  beforeEach(async () => {
    [owner, user1, user2, attacker] = await ethers.getSigners();

    const MockUSDCFactory = await ethers.getContractFactory('MockUSDC');
    usdc = await MockUSDCFactory.deploy();

    const TicketNFTFactory = await ethers.getContractFactory('TicketNFT');
    nft = await TicketNFTFactory.deploy(owner.address, 'https://api.test.com/metadata/');

    const MarketplaceFactory = await ethers.getContractFactory('TicketMarketplace');
    marketplace = await MarketplaceFactory.deploy(
      await nft.getAddress(),
      await usdc.getAddress(),
      250,
      1500,
      owner.address,
    );

    await nft.setMarketplace(await marketplace.getAddress());
  });

  it('mints a ticket to a user and records data', async () => {
    const tx = await nft.mintTicket(user1.address, 1n, 1n, 5000n);
    const receipt = await tx.wait();
    expect(receipt?.status).to.equal(1);

    expect(await nft.ownerOf(1n)).to.equal(user1.address);
    const data = await nft.ticketData(1n);
    expect(data.eventId).to.equal(1n);
    expect(data.tierId).to.equal(1n);
    expect(data.faceValueCents).to.equal(5000n);
    expect(data.scanned).to.equal(false);
  });

  it('blocks direct peer-to-peer transfer between users', async () => {
    await nft.mintTicket(user1.address, 1n, 1n, 5000n);
    await expect(
      nft.connect(user1).transferFrom(user1.address, user2.address, 1n),
    ).to.be.revertedWith('TicketNFT: transfers only via marketplace');
  });

  it('blocks safeTransferFrom by non-marketplace', async () => {
    await nft.mintTicket(user1.address, 1n, 1n, 5000n);
    await expect(
      nft.connect(user1)['safeTransferFrom(address,address,uint256)'](user1.address, user2.address, 1n),
    ).to.be.revertedWith('TicketNFT: transfers only via marketplace');
  });

  it('allows transfer via marketplace (fulfillBraintreeSale)', async () => {
    await nft.mintTicket(user1.address, 1n, 1n, 5000n);
    await marketplace.listTicket(1n, 5500n, user1.address, false);

    await marketplace.fulfillBraintreeSale(0n, user2.address);
    expect(await nft.ownerOf(1n)).to.equal(user2.address);
  });

  it('marks ticket as scanned and updates state', async () => {
    await nft.mintTicket(user1.address, 1n, 1n, 5000n);
    await nft.markScanned(1n);
    const data = await nft.ticketData(1n);
    expect(data.scanned).to.equal(true);
  });

  it('only MINTER_ROLE can mint', async () => {
    await expect(
      nft.connect(attacker).mintTicket(attacker.address, 1n, 1n, 5000n),
    ).to.be.reverted;
  });

  it('tracks total supply correctly', async () => {
    await nft.mintTicket(user1.address, 1n, 1n, 5000n);
    await nft.mintTicket(user2.address, 1n, 2n, 7500n);
    expect(await nft.totalSupply()).to.equal(2n);
  });
});
