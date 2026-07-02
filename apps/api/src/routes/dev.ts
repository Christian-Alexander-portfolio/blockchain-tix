/**
 * Developer seed endpoint — only mounted when ENABLE_DEV_SEED_ENDPOINT=true.
 * Requires an active ADMIN session as a second guard.
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import * as crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { ethers } from 'ethers';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

const ALGORITHM = 'aes-256-gcm';

function encryptKey(privateKey: string, masterKeyHex: string) {
  const key = Buffer.from(masterKeyHex, 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(privateKey, 'utf8'), cipher.final()]);
  return {
    encryptedKey: encrypted.toString('base64'),
    keyIv: iv.toString('base64'),
    keyAuthTag: cipher.getAuthTag().toString('base64'),
  };
}

async function upsertUserWithWallet(opts: {
  email: string;
  password: string;
  name: string;
  role: 'USER' | 'ORGANIZER' | 'SCANNER' | 'ADMIN';
  masterKey: string;
}) {
  const existing = await prisma.user.findUnique({
    where: { email: opts.email },
    include: { wallet: true },
  });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: opts.role,
        emailVerified: true,
        passwordHash: await bcrypt.hash(opts.password, 10),
      },
    });
    return { userId: existing.id, walletAddress: existing.wallet?.address ?? null };
  }

  const wallet = ethers.Wallet.createRandom();
  const keyData = encryptKey(wallet.privateKey, opts.masterKey);

  const user = await prisma.user.create({
    data: {
      email: opts.email,
      passwordHash: await bcrypt.hash(opts.password, 10),
      name: opts.name,
      role: opts.role,
      emailVerified: true,
      wallet: { create: { address: wallet.address, ...keyData } },
    },
  });

  return { userId: user.id, walletAddress: wallet.address };
}

async function runDemoSeed(masterKey: string) {
  const log: string[] = [];

  // Demo organizer
  const { userId: orgUserId } = await upsertUserWithWallet({
    email: 'organizer@demo.com',
    password: 'Demo1234!',
    name: 'Demo Organizer',
    role: 'ORGANIZER',
    masterKey,
  });
  log.push('organizer@demo.com');

  const organizer = await prisma.organizer.upsert({
    where: { userId: orgUserId },
    create: {
      userId: orgUserId,
      orgName: 'Live Demo Events',
      description: 'Demo organizer for testing.',
      status: 'APPROVED',
    },
    update: { status: 'APPROVED' },
  });

  // Demo buyer
  await upsertUserWithWallet({
    email: 'buyer@demo.com',
    password: 'Demo1234!',
    name: 'Demo Buyer',
    role: 'USER',
    masterKey,
  });
  log.push('buyer@demo.com');

  // Demo scanner
  await upsertUserWithWallet({
    email: 'scanner@demo.com',
    password: 'Demo1234!',
    name: 'Door Scanner',
    role: 'SCANNER',
    masterKey,
  });
  log.push('scanner@demo.com');

  // Demo event (idempotent)
  const existing = await prisma.event.findFirst({
    where: { slug: 'summer-blockchain-fest-demo' },
  });

  if (!existing) {
    const count = await prisma.event.count();
    const event = await prisma.event.create({
      data: {
        title: 'Summer Blockchain Fest',
        slug: 'summer-blockchain-fest-demo',
        description: 'A demo music festival. Every ticket is on Polygon.',
        venue: 'Central Park Amphitheater',
        address: '1 Central Park W',
        city: 'New York',
        country: 'US',
        startsAt: new Date('2026-09-15T18:00:00Z'),
        endsAt: new Date('2026-09-15T23:00:00Z'),
        isPublished: true,
        organizerId: organizer.id,
        blockchainEventId: BigInt(count + 1),
      },
    });

    await prisma.ticketTier.createMany({
      data: [
        {
          eventId: event.id,
          name: 'General Admission',
          faceValueCents: 2500,
          totalSupply: 500,
          remainingSupply: 500,
          blockchainTierId: BigInt(1),
        },
        {
          eventId: event.id,
          name: 'VIP',
          faceValueCents: 7500,
          totalSupply: 50,
          remainingSupply: 50,
          blockchainTierId: BigInt(2),
        },
      ],
    });
    log.push('demo event created');
  } else {
    log.push('demo event already exists');
  }

  return log;
}

async function runReset(masterKey: string) {
  // Delete in FK-safe order
  await prisma.scanLog.deleteMany();
  await prisma.usdcPaymentSession.deleteMany();
  await prisma.order.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.ticketTier.deleteMany();
  await prisma.event.deleteMany();
  await prisma.organizer.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.user.deleteMany();
  await prisma.platformSettings.deleteMany();

  // Re-seed settings
  await prisma.platformSettings.create({
    data: { id: 'singleton', resaleMarkupMaxBps: 1500, platformFeeBps: 250 },
  });

  // Re-seed super admin
  await upsertUserWithWallet({
    email: 'mckdunkey@gmail.com',
    password: 'Password1!',
    name: 'McKay (Super Admin)',
    role: 'ADMIN',
    masterKey,
  });

  // Re-seed demo data
  const demoLog = await runDemoSeed(masterKey);
  return ['database wiped', 'settings restored', 'admin restored', ...demoLog];
}

// POST /api/dev/seed
router.post('/seed', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response) => {
  const { mode } = z.object({ mode: z.enum(['demo', 'reset']) }).parse(req.body);

  const masterKey = process.env.WALLET_MASTER_KEY ?? '0'.repeat(64);

  if (mode === 'reset') {
    const log = await runReset(masterKey);
    res.json({ success: true, mode: 'reset', log });
  } else {
    const log = await runDemoSeed(masterKey);
    res.json({ success: true, mode: 'demo', log });
  }
});

export default router;
