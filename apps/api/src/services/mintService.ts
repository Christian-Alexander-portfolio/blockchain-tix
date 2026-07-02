import { ethers } from 'ethers';
import * as crypto from 'crypto';
import { prisma } from '../lib/prisma';
import {
  getNftContract,
  getMarketplaceContract,
  extractTokenIdFromMintReceipt,
} from '../lib/blockchain';
import { encryptQrSecret, generateQrSecret } from '../lib/wallet';
import { uploadJsonToR2 } from '../lib/r2';
import { config } from '../config';

export async function mintTicketForOrder(params: {
  userId: string;
  tierId: string;
  orderId: string;
}): Promise<{ tokenId: string; txHash: string }> {
  const { userId, tierId, orderId } = params;

  // Load required data
  const [wallet, tier] = await Promise.all([
    prisma.wallet.findUnique({ where: { userId } }),
    prisma.ticketTier.findUnique({
      where: { id: tierId },
      include: { event: true },
    }),
  ]);

  if (!wallet) throw new Error('User wallet not found');
  if (!tier) throw new Error('Ticket tier not found');

  const nft = getNftContract();

  // Upload token metadata to R2 first
  const tempTokenId = `pending-${crypto.randomBytes(8).toString('hex')}`;
  const metadataUrl = await uploadJsonToR2(`metadata/${tempTokenId}.json`, {
    name: `${tier.event.title} - ${tier.name}`,
    description: `Ticket for ${tier.event.title} at ${tier.event.venue}`,
    image: tier.event.imageUrl ?? '',
    attributes: [
      { trait_type: 'Event', value: tier.event.title },
      { trait_type: 'Tier', value: tier.name },
      { trait_type: 'Venue', value: tier.event.venue },
      { trait_type: 'Date', value: tier.event.startsAt.toISOString() },
      { trait_type: 'Face Value', value: `$${(tier.faceValueCents / 100).toFixed(2)}` },
    ],
  });

  // Mint the NFT
  const tx = await nft.mintTicket(
    wallet.address,
    tier.event.blockchainEventId ?? BigInt(0),
    tier.blockchainTierId ?? BigInt(0),
    BigInt(tier.faceValueCents),
  );

  const receipt = await (tx as ethers.TransactionResponse).wait(2);
  if (!receipt) throw new Error('Mint transaction failed');

  const tokenId = extractTokenIdFromMintReceipt(receipt);
  const tokenIdStr = tokenId.toString();

  // Update metadata with correct token ID
  await uploadJsonToR2(`metadata/${tokenIdStr}.json`, {
    name: `${tier.event.title} - ${tier.name}`,
    description: `Ticket for ${tier.event.title} at ${tier.event.venue}`,
    image: tier.event.imageUrl ?? '',
    attributes: [
      { trait_type: 'Event', value: tier.event.title },
      { trait_type: 'Tier', value: tier.name },
      { trait_type: 'Venue', value: tier.event.venue },
      { trait_type: 'Date', value: tier.event.startsAt.toISOString() },
      { trait_type: 'Face Value', value: `$${(tier.faceValueCents / 100).toFixed(2)}` },
      { trait_type: 'Token ID', value: tokenIdStr },
    ],
  });

  // Generate and encrypt QR secret
  const qrSecret = generateQrSecret();
  const { encrypted, iv, tag } = encryptQrSecret(qrSecret);

  // Create ticket in DB
  await prisma.$transaction([
    prisma.ticket.create({
      data: {
        tokenId: tokenIdStr,
        ownerId: userId,
        eventId: tier.eventId,
        tierId,
        mintTxHash: receipt.hash,
        qrSecret: encrypted,
        qrSecretIv: iv,
        qrSecretTag: tag,
      },
    }),
    prisma.order.update({
      where: { id: orderId },
      data: { status: 'COMPLETED' },
    }),
  ]);

  return { tokenId: tokenIdStr, txHash: receipt.hash };
}

export async function executeResaleSale(params: {
  listingId: string;
  buyerId: string;
  orderId: string;
  isUsdc: boolean;
  usdcAmount?: bigint;
}): Promise<{ txHash: string }> {
  const { listingId, buyerId, orderId, isUsdc, usdcAmount } = params;

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: { ticket: true, seller: { include: { wallet: true } } },
  });
  if (!listing) throw new Error('Listing not found');

  const buyerWallet = await prisma.wallet.findUnique({ where: { userId: buyerId } });
  if (!buyerWallet) throw new Error('Buyer wallet not found');

  const marketplace = getMarketplaceContract();
  const onChainListingId = listing.onChainListingId;
  if (onChainListingId === null || onChainListingId === undefined) {
    throw new Error('Listing not on-chain yet');
  }

  let tx: ethers.TransactionResponse;
  if (isUsdc && usdcAmount) {
    tx = await marketplace.fulfillUsdcSale(onChainListingId, buyerWallet.address, usdcAmount);
  } else {
    tx = await marketplace.fulfillBraintreeSale(onChainListingId, buyerWallet.address);
  }

  const receipt = await tx.wait(2);
  if (!receipt) throw new Error('Resale transaction failed');

  // Update DB: transfer ownership, close listing, complete order
  await prisma.$transaction([
    prisma.ticket.update({
      where: { id: listing.ticketId },
      data: { ownerId: buyerId, status: 'OWNED' },
    }),
    prisma.listing.update({
      where: { id: listingId },
      data: { status: 'SOLD', soldTxHash: receipt.hash },
    }),
    prisma.order.update({
      where: { id: orderId },
      data: { status: 'COMPLETED' },
    }),
  ]);

  return { txHash: receipt.hash };
}
