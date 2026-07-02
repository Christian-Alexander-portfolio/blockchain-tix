import { Router, Request, Response } from 'express';
import { z } from 'zod';
import slugify from 'slugify';
import multer from 'multer';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { uploadToR2 } from '../lib/r2';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const eventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  venue: z.string().min(1),
  address: z.string().min(1),
  city: z.string().min(1),
  country: z.string().min(1),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
});

const tierSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  faceValueCents: z.number().int().min(1),
  totalSupply: z.number().int().min(1),
  salesStartAt: z.string().datetime().optional(),
  salesEndAt: z.string().datetime().optional(),
});

function makeSlug(title: string): string {
  const base = slugify(title, { lower: true, strict: true });
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base}-${suffix}`;
}

// GET /api/events — list published events
router.get('/', async (req: Request, res: Response) => {
  const { city, search, page = '1', limit = '20' } = req.query as Record<string, string>;

  const where: any = { isPublished: true, isCancelled: false, startsAt: { gte: new Date() } };
  if (city) where.city = { contains: city, mode: 'insensitive' };
  if (search) where.title = { contains: search, mode: 'insensitive' };

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      include: {
        organizer: { select: { id: true, orgName: true, logoUrl: true } },
        tiers: { select: { id: true, name: true, faceValueCents: true, remainingSupply: true } },
      },
      orderBy: { startsAt: 'asc' },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
    }),
    prisma.event.count({ where }),
  ]);

  res.json({ events, total, page: parseInt(page), limit: parseInt(limit) });
});

// GET /api/events/:slug
router.get('/:slug', async (req: Request, res: Response) => {
  const event = await prisma.event.findUnique({
    where: { slug: req.params.slug },
    include: {
      organizer: { select: { id: true, orgName: true, logoUrl: true, description: true } },
      tiers: true,
    },
  });
  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }
  res.json(event);
});

// POST /api/events — create event (ORGANIZER or ADMIN)
router.post('/', requireAuth, requireRole('ORGANIZER', 'ADMIN'), async (req: Request, res: Response) => {
  const body = eventSchema.parse(req.body);

  const organizer = await prisma.organizer.findUnique({
    where: { userId: req.userId },
  });
  if (!organizer || organizer.status !== 'APPROVED') {
    res.status(403).json({ error: 'Organizer account not approved' });
    return;
  }

  // Auto-increment blockchainEventId
  const count = await prisma.event.count();
  const event = await prisma.event.create({
    data: {
      ...body,
      slug: makeSlug(body.title),
      startsAt: new Date(body.startsAt),
      endsAt: new Date(body.endsAt),
      organizerId: organizer.id,
      blockchainEventId: BigInt(count + 1),
    },
    include: {
      organizer: { select: { id: true, orgName: true, logoUrl: true } },
      tiers: true,
    },
  });

  res.status(201).json(event);
});

// PATCH /api/events/:id
router.patch('/:id', requireAuth, requireRole('ORGANIZER', 'ADMIN'), async (req: Request, res: Response) => {
  const body = eventSchema.partial().parse(req.body);

  const event = await prisma.event.findUnique({ where: { id: req.params.id }, include: { organizer: true } });
  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }
  if (req.userRole !== 'ADMIN' && event.organizer.userId !== req.userId) {
    res.status(403).json({ error: 'Not your event' });
    return;
  }

  const updated = await prisma.event.update({
    where: { id: req.params.id },
    data: {
      ...body,
      ...(body.startsAt ? { startsAt: new Date(body.startsAt) } : {}),
      ...(body.endsAt ? { endsAt: new Date(body.endsAt) } : {}),
    },
    include: { tiers: true, organizer: { select: { id: true, orgName: true, logoUrl: true } } },
  });

  res.json(updated);
});

// PATCH /api/events/:id/publish
router.patch('/:id/publish', requireAuth, requireRole('ORGANIZER', 'ADMIN'), async (req: Request, res: Response) => {
  const event = await prisma.event.findUnique({
    where: { id: req.params.id },
    include: { organizer: true, tiers: true },
  });
  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }
  if (req.userRole !== 'ADMIN' && event.organizer.userId !== req.userId) {
    res.status(403).json({ error: 'Not your event' });
    return;
  }
  if (event.tiers.length === 0) {
    res.status(422).json({ error: 'Event must have at least one ticket tier before publishing' });
    return;
  }

  const updated = await prisma.event.update({
    where: { id: req.params.id },
    data: { isPublished: true },
  });
  res.json(updated);
});

// DELETE /api/events/:id (soft cancel)
router.delete('/:id', requireAuth, requireRole('ORGANIZER', 'ADMIN'), async (req: Request, res: Response) => {
  const event = await prisma.event.findUnique({
    where: { id: req.params.id },
    include: { organizer: true },
  });
  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }
  if (req.userRole !== 'ADMIN' && event.organizer.userId !== req.userId) {
    res.status(403).json({ error: 'Not your event' });
    return;
  }

  await prisma.event.update({ where: { id: req.params.id }, data: { isCancelled: true, isPublished: false } });
  res.json({ success: true });
});

// POST /api/events/:id/tiers
router.post('/:id/tiers', requireAuth, requireRole('ORGANIZER', 'ADMIN'), async (req: Request, res: Response) => {
  const body = tierSchema.parse(req.body);
  const event = await prisma.event.findUnique({
    where: { id: req.params.id },
    include: { organizer: true, tiers: true },
  });
  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }
  if (req.userRole !== 'ADMIN' && event.organizer.userId !== req.userId) {
    res.status(403).json({ error: 'Not your event' });
    return;
  }

  const tierCount = event.tiers.length;
  const tier = await prisma.ticketTier.create({
    data: {
      ...body,
      remainingSupply: body.totalSupply,
      eventId: req.params.id,
      blockchainTierId: BigInt(tierCount + 1),
      ...(body.salesStartAt ? { salesStartAt: new Date(body.salesStartAt) } : {}),
      ...(body.salesEndAt ? { salesEndAt: new Date(body.salesEndAt) } : {}),
    },
  });

  res.status(201).json(tier);
});

// PATCH /api/events/:id/tiers/:tierId
router.patch('/:id/tiers/:tierId', requireAuth, requireRole('ORGANIZER', 'ADMIN'), async (req: Request, res: Response) => {
  const body = tierSchema.partial().parse(req.body);
  const tier = await prisma.ticketTier.update({
    where: { id: req.params.tierId },
    data: body,
  });
  res.json(tier);
});

// POST /api/events/:id/image
router.post('/:id/image', requireAuth, requireRole('ORGANIZER', 'ADMIN'), upload.single('image'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  const event = await prisma.event.findUnique({
    where: { id: req.params.id },
    include: { organizer: true },
  });
  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }
  if (req.userRole !== 'ADMIN' && event.organizer.userId !== req.userId) {
    res.status(403).json({ error: 'Not your event' });
    return;
  }

  const imageUrl = await uploadToR2(req.file.buffer, req.file.originalname, req.file.mimetype, 'events');
  await prisma.event.update({ where: { id: req.params.id }, data: { imageUrl } });
  res.json({ imageUrl });
});

export default router;
