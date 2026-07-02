import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ethers } from 'ethers';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { gateway } from '../lib/braintree';
import { executeResaleSale } from '../services/mintService';

const router = Router();

// GET /api/listings — browse active resale listings
router.get('/', async (req: Request, res: Response) => {
  const { eventId, page = '1', limit = '20' } = req.query as Record<string, string>;

  const where: any = { status: 'ACTIVE' };
  if (eventId) where.ticket = { eventId };

  const [listings, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      include: {
        seller: { select: { id: true, name: true } },
        ticket: {
          include: {
            tier: { select: { id: true, name: true, faceValueCents: true } },
            event: { select: { id: true, title: true, slug: true, venue: true, startsAt: true, imageUrl: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
    }),
    prisma.listing.count({ where }),
  ]);

  res.json({ listings, total, page: parseInt(page), limit: parseInt(limit) });
});

// GET /api/listings/:id
router.get('/:id', async (req: Request, res: Response) => {
  const listing = await prisma.listing.findUnique({
    where: { id: req.params.id },
    include: {
      seller: { select: { id: true, name: true } },
      ticket: {
        include: {
          tier: true,
          event: { select: { id: true, title: true, slug: true, venue: true, startsAt: true, imageUrl: true, address: true, city: true } },
        },
      },
    },
  });
  if (!listing) {
    res.status(404).json({ error: 'Listing not found' });
    return;
  }
  res.json(listing);
});

// POST /api/listings/:id/buy — purchase a resale ticket
router.post('/:id/buy', requireAuth, async (req: Request, res: Response) => {
  const body = z.object({ paymentNonce: z.string() }).parse(req.body);

  const listing = await prisma.listing.findUnique({
    where: { id: req.params.id },
    include: { ticket: { include: { tier: true } }, seller: true },
  });

  if (!listing || listing.status !== 'ACTIVE') {
    res.status(404).json({ error: 'Listing not found or no longer active' });
    return;
  }
  if (listing.sellerId === req.userId) {
    res.status(422).json({ error: 'Cannot buy your own listing' });
    return;
  }

  // Re-validate price cap server-side
  const settings = await prisma.platformSettings.findUnique({ where: { id: 'singleton' } });
  const maxBps = settings?.resaleMarkupMaxBps ?? 1500;
  const maxPrice = listing.ticket.tier.faceValueCents + Math.floor(listing.ticket.tier.faceValueCents * maxBps / 10000);
  if (listing.askPriceCents > maxPrice) {
    res.status(422).json({ error: 'Listing price exceeds current platform maximum' });
    return;
  }

  const amountUSD = (listing.askPriceCents / 100).toFixed(2);

  // Create pending order
  const order = await prisma.order.create({
    data: {
      buyerId: req.userId!,
      ticketId: listing.ticketId,
      listingId: listing.id,
      amountCents: listing.askPriceCents,
      paymentMethod: 'BRAINTREE_CARD',
    },
  });

  // Charge buyer
  const result = await gateway.transaction.sale({
    amount: amountUSD,
    paymentMethodNonce: body.paymentNonce,
    options: { submitForSettlement: true },
  });

  if (!result.success) {
    await prisma.order.update({ where: { id: order.id }, data: { status: 'FAILED' } });
    res.status(422).json({ error: result.message ?? 'Payment failed' });
    return;
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { braintreeTransId: result.transaction.id },
  });

  // Execute on-chain NFT transfer
  const { txHash } = await executeResaleSale({
    listingId: listing.id,
    buyerId: req.userId!,
    orderId: order.id,
    isUsdc: false,
  });

  const ticket = await prisma.ticket.findUnique({
    where: { id: listing.ticketId },
    include: {
      tier: true,
      event: { select: { id: true, title: true, slug: true, venue: true, startsAt: true, imageUrl: true } },
    },
  });

  res.json({ ticket, txHash, orderId: order.id });
});

export default router;
