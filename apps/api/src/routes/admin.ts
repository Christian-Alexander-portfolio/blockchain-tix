import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// All admin routes require ADMIN role
router.use(requireAuth, requireRole('ADMIN'));

// GET /api/admin/organizers
router.get('/organizers', async (req: Request, res: Response) => {
  const { status } = req.query as Record<string, string>;
  const organizers = await prisma.organizer.findMany({
    where: status ? { status: status as any } : undefined,
    include: { user: { select: { id: true, email: true, name: true, createdAt: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(organizers);
});

// PATCH /api/admin/organizers/:id/approve
router.patch('/organizers/:id/approve', async (req: Request, res: Response) => {
  const organizer = await prisma.organizer.update({
    where: { id: req.params.id },
    data: { status: 'APPROVED' },
    include: { user: true },
  });
  // Also update user role
  await prisma.user.update({ where: { id: organizer.userId }, data: { role: 'ORGANIZER' } });
  res.json(organizer);
});

// PATCH /api/admin/organizers/:id/suspend
router.patch('/organizers/:id/suspend', async (req: Request, res: Response) => {
  const organizer = await prisma.organizer.update({
    where: { id: req.params.id },
    data: { status: 'SUSPENDED' },
  });
  res.json(organizer);
});

// GET /api/admin/settings
router.get('/settings', async (req: Request, res: Response) => {
  const settings = await prisma.platformSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton' },
    update: {},
  });
  res.json(settings);
});

// PATCH /api/admin/settings
router.patch('/settings', async (req: Request, res: Response) => {
  const body = z
    .object({
      resaleMarkupMaxBps: z.number().int().min(0).max(10000).optional(),
      platformFeeBps: z.number().int().min(0).max(2000).optional(),
      maintenanceMode: z.boolean().optional(),
    })
    .parse(req.body);

  const settings = await prisma.platformSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', ...body },
    update: body,
  });

  // Sync markup to smart contract if changed
  if (body.resaleMarkupMaxBps !== undefined) {
    const { getMarketplaceContract } = await import('../lib/blockchain');
    const marketplace = getMarketplaceContract();
    await marketplace.setMaxResaleMarkupBps(BigInt(body.resaleMarkupMaxBps)).catch((e: Error) =>
      console.error('Failed to sync markup to contract:', e.message),
    );
  }

  res.json(settings);
});

// GET /api/admin/events
router.get('/events', async (req: Request, res: Response) => {
  const { page = '1', limit = '20' } = req.query as Record<string, string>;
  const [events, total] = await Promise.all([
    prisma.event.findMany({
      include: {
        organizer: { select: { id: true, orgName: true } },
        tiers: { select: { id: true, name: true, remainingSupply: true, totalSupply: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
    }),
    prisma.event.count(),
  ]);
  res.json({ events, total });
});

// GET /api/admin/users
router.get('/users', async (req: Request, res: Response) => {
  const { page = '1', limit = '50' } = req.query as Record<string, string>;
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, createdAt: true, wallet: { select: { address: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
    }),
    prisma.user.count(),
  ]);
  res.json({ users, total });
});

// PATCH /api/admin/users/:id/role
router.patch('/users/:id/role', async (req: Request, res: Response) => {
  const { role } = z.object({ role: z.enum(['USER', 'ORGANIZER', 'SCANNER', 'ADMIN']) }).parse(req.body);
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { role } });
  res.json({ id: user.id, role: user.role });
});

// GET /api/admin/analytics
router.get('/analytics', async (req: Request, res: Response) => {
  const [totalUsers, totalEvents, totalTickets, completedOrders] = await Promise.all([
    prisma.user.count(),
    prisma.event.count({ where: { isPublished: true } }),
    prisma.ticket.count(),
    prisma.order.findMany({
      where: { status: 'COMPLETED' },
      select: { amountCents: true, paymentMethod: true, platformFeeCents: true },
    }),
  ]);

  const totalRevenueCents = completedOrders.reduce((sum: number, o) => sum + o.amountCents, 0);
  const platformRevenueCents = completedOrders.reduce((sum: number, o) => sum + o.platformFeeCents, 0);

  res.json({
    totalUsers,
    totalEvents,
    totalTickets,
    totalOrders: completedOrders.length,
    totalRevenueCents,
    platformRevenueCents,
  });
});

// GET /api/admin/scan-logs
router.get('/scan-logs', async (req: Request, res: Response) => {
  const { eventId } = req.query as Record<string, string>;
  const logs = await prisma.scanLog.findMany({
    where: eventId ? { eventId } : undefined,
    include: {
      ticket: { select: { tokenId: true, tier: { select: { name: true } } } },
      scanner: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json(logs);
});

export default router;
