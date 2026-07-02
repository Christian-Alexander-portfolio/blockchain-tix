import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();

// POST /api/organizer/apply — apply to become an organizer
router.post('/apply', requireAuth, async (req: Request, res: Response) => {
  const body = z
    .object({
      orgName: z.string().min(1).max(200),
      description: z.string().optional(),
      websiteUrl: z.string().url().optional(),
    })
    .parse(req.body);

  const existing = await prisma.organizer.findUnique({ where: { userId: req.userId } });
  if (existing) {
    res.status(409).json({ error: 'Already applied', status: existing.status });
    return;
  }

  const organizer = await prisma.organizer.create({
    data: { userId: req.userId!, ...body },
  });

  res.status(201).json(organizer);
});

// GET /api/organizer/me — get own organizer profile
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const organizer = await prisma.organizer.findUnique({
    where: { userId: req.userId },
    include: { events: { include: { tiers: true }, orderBy: { createdAt: 'desc' } } },
  });
  if (!organizer) {
    res.status(404).json({ error: 'Not an organizer' });
    return;
  }
  res.json(organizer);
});

// GET /api/organizer/events
router.get('/events', requireAuth, async (req: Request, res: Response) => {
  const organizer = await prisma.organizer.findUnique({ where: { userId: req.userId } });
  if (!organizer) {
    res.status(403).json({ error: 'Not an organizer' });
    return;
  }

  const events = await prisma.event.findMany({
    where: { organizerId: organizer.id },
    include: {
      tiers: { select: { id: true, name: true, totalSupply: true, remainingSupply: true, faceValueCents: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json(events);
});

// GET /api/organizer/events/:id/sales — sales analytics for an event
router.get('/events/:id/sales', requireAuth, async (req: Request, res: Response) => {
  const organizer = await prisma.organizer.findUnique({ where: { userId: req.userId } });
  if (!organizer) {
    res.status(403).json({ error: 'Not an organizer' });
    return;
  }

  const event = await prisma.event.findFirst({
    where: { id: req.params.id, organizerId: organizer.id },
    include: { tiers: { include: { tickets: { select: { status: true } } } } },
  });

  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }

  const salesData = event.tiers.map((tier) => ({
    tierId: tier.id,
    tierName: tier.name,
    totalSupply: tier.totalSupply,
    sold: tier.totalSupply - tier.remainingSupply,
    remaining: tier.remainingSupply,
    faceValueCents: tier.faceValueCents,
    revenueCents: (tier.totalSupply - tier.remainingSupply) * tier.faceValueCents,
    scanned: tier.tickets.filter((t) => t.status === 'SCANNED').length,
  }));

  const totalRevenue = salesData.reduce((sum, t) => sum + t.revenueCents, 0);
  res.json({ event: { id: event.id, title: event.title }, tiers: salesData, totalRevenueCents: totalRevenue });
});

export default router;
