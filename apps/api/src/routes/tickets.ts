import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { getGateway } from '../lib/braintree';
import { decryptQrSecret } from '../lib/wallet';
import { signQrToken } from '../lib/jwt';
import { mintTicketForOrder } from '../services/mintService';

const router = Router();

// GET /api/tickets/mine — my tickets
router.get('/mine', requireAuth, async (req: Request, res: Response) => {
  const tickets = await prisma.ticket.findMany({
    where: { ownerId: req.userId },
    include: {
      tier: true,
      event: { select: { id: true, title: true, slug: true, venue: true, startsAt: true, imageUrl: true } },
      listing: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(tickets);
});

// GET /api/tickets/:id/qr — get short-lived QR JWT
router.get('/:id/qr', requireAuth, async (req: Request, res: Response) => {
  const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }
  if (ticket.ownerId !== req.userId) {
    res.status(403).json({ error: 'Not your ticket' });
    return;
  }
  if (ticket.status === 'SCANNED') {
    res.status(422).json({ error: 'Ticket already scanned' });
    return;
  }

  const qrSecret = decryptQrSecret(ticket.qrSecret, ticket.qrSecretIv, ticket.qrSecretTag);
  const qrToken = signQrToken(ticket.id, qrSecret);

  res.json({ qrToken, expiresInSeconds: 300 });
});

// POST /api/tickets/purchase — buy a primary ticket
router.post('/purchase', requireAuth, async (req: Request, res: Response) => {
  const body = z
    .object({
      tierId: z.string(),
      paymentNonce: z.string().optional(),
      paymentMethod: z.enum(['BRAINTREE_CARD', 'BRAINTREE_APPLE_PAY', 'BRAINTREE_GOOGLE_PAY', 'USDC_POLYGON']),
    })
    .parse(req.body);

  const tier = await prisma.ticketTier.findUnique({
    where: { id: body.tierId },
    include: { event: true },
  });
  if (!tier) {
    res.status(404).json({ error: 'Ticket tier not found' });
    return;
  }
  if (!tier.event.isPublished || tier.event.isCancelled) {
    res.status(422).json({ error: 'Event is not available' });
    return;
  }
  if (tier.remainingSupply <= 0) {
    res.status(422).json({ error: 'Tickets sold out' });
    return;
  }
  if (tier.salesEndAt && tier.salesEndAt < new Date()) {
    res.status(422).json({ error: 'Ticket sales have ended' });
    return;
  }

  // USDC: create a session and return deposit info
  if (body.paymentMethod === 'USDC_POLYGON') {
    const userWallet = await prisma.wallet.findUnique({ where: { userId: req.userId } });
    if (!userWallet) {
      res.status(422).json({ error: 'User wallet not found' });
      return;
    }

    // USDC amount = faceValueCents / 100 with 6 decimal precision
    const usdcAmount = (tier.faceValueCents / 100).toFixed(6);

    const session = await prisma.usdcPaymentSession.create({
      data: {
        toAddress: userWallet.address, // We monitor user's own address; they send from external wallet
        expectedUsdc: usdcAmount,
        amountCents: tier.faceValueCents,
        tierId: body.tierId,
        userId: req.userId!,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    res.json({
      type: 'USDC_SESSION',
      session: {
        id: session.id,
        toAddress: session.toAddress,
        expectedUsdc: session.expectedUsdc,
        amountCents: session.amountCents,
        expiresAt: session.expiresAt,
      },
    });
    return;
  }

  // Braintree payment
  if (!body.paymentNonce) {
    res.status(400).json({ error: 'paymentNonce required for card/PayPal payments' });
    return;
  }

  const amountUSD = (tier.faceValueCents / 100).toFixed(2);

  // Reserve supply atomically
  const updated = await prisma.ticketTier.updateMany({
    where: { id: body.tierId, remainingSupply: { gt: 0 } },
    data: { remainingSupply: { decrement: 1 } },
  });

  if (updated.count === 0) {
    res.status(422).json({ error: 'Tickets sold out' });
    return;
  }

  // Create pending order
  const order = await prisma.order.create({
    data: {
      buyerId: req.userId!,
      ticketId: 'pending', // placeholder — real ticketId assigned after mint
      amountCents: tier.faceValueCents,
      paymentMethod: body.paymentMethod,
    },
  });

  // Charge via Braintree
  const result = await getGateway().transaction.sale({
    amount: amountUSD,
    paymentMethodNonce: body.paymentNonce,
    options: { submitForSettlement: true },
  });

  if (!result.success) {
    // Rollback supply
    await prisma.ticketTier.update({
      where: { id: body.tierId },
      data: { remainingSupply: { increment: 1 } },
    });
    await prisma.order.update({ where: { id: order.id }, data: { status: 'FAILED' } });
    res.status(422).json({ error: result.message ?? 'Payment failed' });
    return;
  }

  // Update order with transaction ID
  await prisma.order.update({
    where: { id: order.id },
    data: { braintreeTransId: result.transaction.id },
  });

  // Mint NFT (async — but we wait for it so user gets immediate confirmation)
  const { tokenId, txHash } = await mintTicketForOrder({
    userId: req.userId!,
    tierId: body.tierId,
    orderId: order.id,
  });

  const ticket = await prisma.ticket.findUnique({
    where: { tokenId },
    include: {
      tier: true,
      event: { select: { id: true, title: true, slug: true, venue: true, startsAt: true, imageUrl: true } },
    },
  });

  res.status(201).json({ ticket, txHash });
});

// POST /api/tickets/:id/list-for-resale
router.post('/:id/list-for-resale', requireAuth, async (req: Request, res: Response) => {
  const body = z.object({ askPriceCents: z.number().int().min(1) }).parse(req.body);

  const ticket = await prisma.ticket.findUnique({
    where: { id: req.params.id },
    include: { tier: true },
  });
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }
  if (ticket.ownerId !== req.userId) {
    res.status(403).json({ error: 'Not your ticket' });
    return;
  }
  if (ticket.status !== 'OWNED') {
    res.status(422).json({ error: `Cannot list a ticket with status: ${ticket.status}` });
    return;
  }

  const settings = await prisma.platformSettings.findUnique({ where: { id: 'singleton' } });
  const maxBps = settings?.resaleMarkupMaxBps ?? 1500;
  const maxPrice = ticket.tier.faceValueCents + Math.floor(ticket.tier.faceValueCents * maxBps / 10000);

  if (body.askPriceCents > maxPrice) {
    res.status(422).json({
      error: `Resale price exceeds maximum allowed (${(maxBps / 100).toFixed(0)}% above face value)`,
      maxAllowedCents: maxPrice,
    });
    return;
  }
  if (body.askPriceCents < ticket.tier.faceValueCents) {
    res.status(422).json({ error: 'Resale price cannot be below face value' });
    return;
  }

  // Call on-chain marketplace
  const { getMarketplaceContract } = await import('../lib/blockchain');
  const marketplace = getMarketplaceContract();
  const sellerWallet = await prisma.wallet.findUnique({ where: { userId: req.userId } });
  if (!sellerWallet) {
    res.status(422).json({ error: 'Seller wallet not found' });
    return;
  }

  const tx = await marketplace.listTicket(
    BigInt(ticket.tokenId),
    BigInt(body.askPriceCents),
    sellerWallet.address,
    false, // Braintree payment (off-chain)
  );
  const receipt = await (tx as any).wait(1);

  // Extract on-chain listing ID from TicketListed event
  const iface = new (await import('ethers')).ethers.Interface([
    'event TicketListed(uint256 indexed listingId, uint256 indexed tokenId, address indexed seller, uint256 askPriceCents)',
  ]);
  let onChainListingId: bigint = BigInt(0);
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
      if (parsed?.name === 'TicketListed') {
        onChainListingId = parsed.args[0] as bigint;
        break;
      }
    } catch {}
  }

  const listing = await prisma.$transaction([
    prisma.ticket.update({ where: { id: req.params.id }, data: { status: 'LISTED' } }),
    prisma.listing.create({
      data: {
        ticketId: req.params.id,
        sellerId: req.userId!,
        askPriceCents: body.askPriceCents,
        onChainListingId,
        listTxHash: receipt.hash,
      },
    }),
  ]);

  res.status(201).json(listing[1]);
});

// DELETE /api/tickets/:id/listing — cancel listing
router.delete('/:id/listing', requireAuth, async (req: Request, res: Response) => {
  const ticket = await prisma.ticket.findUnique({
    where: { id: req.params.id },
    include: { listing: true },
  });
  if (!ticket || !ticket.listing) {
    res.status(404).json({ error: 'No active listing for this ticket' });
    return;
  }
  if (ticket.ownerId !== req.userId) {
    res.status(403).json({ error: 'Not your ticket' });
    return;
  }

  const { getMarketplaceContract } = await import('../lib/blockchain');
  const marketplace = getMarketplaceContract();
  const tx = await marketplace.cancelListing(ticket.listing.onChainListingId);
  await (tx as any).wait(1);

  await prisma.$transaction([
    prisma.ticket.update({ where: { id: req.params.id }, data: { status: 'OWNED' } }),
    prisma.listing.update({ where: { id: ticket.listing.id }, data: { status: 'CANCELLED' } }),
  ]);

  res.json({ success: true });
});

export default router;
