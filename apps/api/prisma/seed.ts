/**
 * Database seed script.
 *
 * Usage:
 *   pnpm --filter api db:seed                   # safe defaults (upsert only)
 *   pnpm --filter api db:seed -- --reset        # wipe all data, then seed fresh
 *   pnpm --filter api db:seed -- --demo         # also create demo organizer + event
 *   pnpm --filter api db:seed -- --reset --demo # full clean slate with demo data
 *
 * Individual section flags (combined with above as needed):
 *   --skip-admin      skip creating admin accounts
 *   --skip-settings   skip platform settings
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { ethers } from 'ethers';

const prisma = new PrismaClient();

// ─── Flags ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const RESET = args.includes('--reset');
const DEMO = args.includes('--demo');
const SKIP_ADMIN = args.includes('--skip-admin');
const SKIP_SETTINGS = args.includes('--skip-settings');

// ─── Encryption helper (mirrors apps/api/src/lib/wallet.ts) ──────────────────
const ALGORITHM = 'aes-256-gcm';

function encryptPrivateKey(privateKey: string, masterKeyHex: string) {
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

async function createUserWithWallet(opts: {
  email: string;
  password: string;
  name: string;
  role: 'USER' | 'ORGANIZER' | 'SCANNER' | 'ADMIN';
  masterKey: string;
}) {
  const wallet = ethers.Wallet.createRandom();
  const keyData = encryptPrivateKey(wallet.privateKey, opts.masterKey);

  const user = await prisma.user.upsert({
    where: { email: opts.email },
    create: {
      email: opts.email,
      passwordHash: await bcrypt.hash(opts.password, 12),
      name: opts.name,
      role: opts.role,
      emailVerified: true,
      wallet: { create: { address: wallet.address, ...keyData } },
    },
    update: {
      // On re-seed without --reset: update role + password but keep existing wallet
      role: opts.role,
      passwordHash: await bcrypt.hash(opts.password, 12),
      emailVerified: true,
    },
  });

  return { user, walletAddress: wallet.address };
}

// ─── Reset ────────────────────────────────────────────────────────────────────
async function resetDatabase() {
  console.log('⚠️  --reset: deleting all data...');
  // Order matters — FK constraints
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
  console.log('✓ All tables cleared\n');
}

// ─── Platform Settings ────────────────────────────────────────────────────────
async function seedSettings() {
  await prisma.platformSettings.upsert({
    where: { id: 'singleton' },
    create: {
      id: 'singleton',
      resaleMarkupMaxBps: 1500,  // 15% max above face value
      platformFeeBps: 250,       // 2.5% platform fee on all sales
    },
    update: {
      // Never overwrite admin-configured values on a plain re-seed
    },
  });
  console.log('✓ PlatformSettings: resale cap 15%, platform fee 2.5%');
}

// ─── Admin Accounts ───────────────────────────────────────────────────────────
async function seedAdmins(masterKey: string) {
  // ── Super admin (you) ──────────────────────────────────────────────────────
  const { user: superAdmin, walletAddress: superAdminWallet } = await createUserWithWallet({
    email: 'mckdunkey@gmail.com',
    password: 'Password1!',
    name: 'McKay (Super Admin)',
    role: 'ADMIN',
    masterKey,
  });
  console.log(`✓ Super admin:  ${superAdmin.email}`);
  console.log(`  Password:     Password1!`);
  console.log(`  Wallet:       ${superAdminWallet}`);
  console.log(`  Role:         ADMIN`);
}

// ─── Demo Data ────────────────────────────────────────────────────────────────
async function seedDemo(masterKey: string) {
  console.log('\n── Demo data ────────────────────────────────────────────');

  // Demo organizer user
  const { user: orgUser } = await createUserWithWallet({
    email: 'organizer@demo.com',
    password: 'Demo1234!',
    name: 'Demo Organizer',
    role: 'ORGANIZER',
    masterKey,
  });
  console.log(`✓ Demo organizer: ${orgUser.email}  (password: Demo1234!)`);

  // Approved organizer profile
  const organizer = await prisma.organizer.upsert({
    where: { userId: orgUser.id },
    create: {
      userId: orgUser.id,
      orgName: 'Live Demo Events',
      description: 'A demo event organizer account for testing.',
      websiteUrl: 'https://example.com',
      status: 'APPROVED',
    },
    update: { status: 'APPROVED' },
  });

  // Demo buyer
  const { user: buyer } = await createUserWithWallet({
    email: 'buyer@demo.com',
    password: 'Demo1234!',
    name: 'Demo Buyer',
    role: 'USER',
    masterKey,
  });
  console.log(`✓ Demo buyer:     ${buyer.email}     (password: Demo1234!)`);

  // Demo scanner
  const { user: scanner } = await createUserWithWallet({
    email: 'scanner@demo.com',
    password: 'Demo1234!',
    name: 'Door Scanner',
    role: 'SCANNER',
    masterKey,
  });
  console.log(`✓ Demo scanner:   ${scanner.email}   (password: Demo1234!)`);

  // Demo event (published, future date)
  const existing = await prisma.event.findFirst({
    where: { slug: { startsWith: 'summer-blockchain-fest' } },
  });

  if (!existing) {
    const eventCount = await prisma.event.count();
    const event = await prisma.event.create({
      data: {
        title: 'Summer Blockchain Fest',
        slug: 'summer-blockchain-fest-demo',
        description:
          'A demo music festival where every ticket lives on the Polygon blockchain. No scalping, no fakes.',
        venue: 'Central Park Amphitheater',
        address: '1 Central Park W',
        city: 'New York',
        country: 'US',
        startsAt: new Date('2026-09-15T18:00:00Z'),
        endsAt: new Date('2026-09-15T23:00:00Z'),
        isPublished: true,
        organizerId: organizer.id,
        blockchainEventId: BigInt(eventCount + 1),
      },
    });

    // Two ticket tiers
    await prisma.ticketTier.createMany({
      data: [
        {
          eventId: event.id,
          name: 'General Admission',
          faceValueCents: 2500,   // $25
          totalSupply: 500,
          remainingSupply: 500,
          blockchainTierId: BigInt(1),
        },
        {
          eventId: event.id,
          name: 'VIP',
          faceValueCents: 7500,   // $75
          totalSupply: 50,
          remainingSupply: 50,
          blockchainTierId: BigInt(2),
        },
      ],
    });

    console.log(`✓ Demo event:     "${event.title}" (published, 2 tiers)`);
  } else {
    console.log(`  Demo event already exists — skipped`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const masterKey = process.env.WALLET_MASTER_KEY;
  if (!masterKey || masterKey.length !== 64) {
    // Fall back to a zeroed key in local dev; never in production
    if (process.env.NODE_ENV === 'production') {
      throw new Error('WALLET_MASTER_KEY must be set to a 64-char hex string in production');
    }
    console.warn('⚠️  WALLET_MASTER_KEY not set — using zeroed dev key (never use in production)\n');
  }
  const key = masterKey ?? '0'.repeat(64);

  console.log(`\n🌱 Seeding database${RESET ? ' (RESET mode)' : ''}${DEMO ? ' + demo data' : ''}...\n`);

  if (RESET) await resetDatabase();

  if (!SKIP_SETTINGS) await seedSettings();
  if (!SKIP_ADMIN) await seedAdmins(key);
  if (DEMO) await seedDemo(key);

  console.log('\n✅ Seed complete\n');
}

main()
  .catch((err) => {
    console.error('\n❌ Seed failed:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
