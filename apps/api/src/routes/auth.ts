import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/jwt';
import { createWallet } from '../lib/wallet';
import { requireAuth } from '../middleware/auth';
import type { AuthResponse, ApiUser } from '@blockchain-tickets/shared';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

async function issueTokens(userId: string, email: string, role: string) {
  const accessToken = signAccessToken({ sub: userId, email, role: role as any });

  const jti = crypto.randomUUID();
  const refreshToken = signRefreshToken({ sub: userId, jti });

  await prisma.refreshToken.create({
    data: {
      token: jti,
      userId,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  return { accessToken, refreshToken };
}

function formatUser(user: any, walletAddress: string): ApiUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    walletAddress,
    avatarUrl: user.avatarUrl ?? null,
  };
}

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  const body = registerSchema.parse(req.body);

  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) {
    res.status(409).json({ error: 'Email already in use' });
    return;
  }

  const passwordHash = await bcrypt.hash(body.password, 12);
  const walletData = createWallet();

  const user = await prisma.user.create({
    data: {
      email: body.email,
      passwordHash,
      name: body.name,
      wallet: {
        create: {
          address: walletData.address,
          encryptedKey: walletData.encryptedKey,
          keyIv: walletData.keyIv,
          keyAuthTag: walletData.keyAuthTag,
        },
      },
    },
    include: { wallet: true },
  });

  const { accessToken, refreshToken } = await issueTokens(user.id, user.email, user.role);

  const response: AuthResponse = {
    accessToken,
    refreshToken,
    user: formatUser(user, user.wallet!.address),
  };

  res.status(201).json(response);
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const body = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({
    where: { email: body.email },
    include: { wallet: true },
  });

  if (!user || !user.passwordHash) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const valid = await bcrypt.compare(body.password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const { accessToken, refreshToken } = await issueTokens(user.id, user.email, user.role);

  const response: AuthResponse = {
    accessToken,
    refreshToken,
    user: formatUser(user, user.wallet?.address ?? ''),
  };

  res.json(response);
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = z.object({ refreshToken: z.string() }).parse(req.body);

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
    return;
  }

  const stored = await prisma.refreshToken.findUnique({ where: { token: payload.jti } });
  if (!stored || stored.expiresAt < new Date()) {
    res.status(401).json({ error: 'Refresh token expired or revoked' });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { wallet: true },
  });

  if (!user) {
    res.status(401).json({ error: 'User not found' });
    return;
  }

  // Rotate: delete old, issue new
  await prisma.refreshToken.delete({ where: { token: payload.jti } });
  const tokens = await issueTokens(user.id, user.email, user.role);

  res.json({
    ...tokens,
    user: formatUser(user, user.wallet?.address ?? ''),
  });
});

// POST /api/auth/logout
router.post('/logout', requireAuth, async (req: Request, res: Response) => {
  // Revoke all refresh tokens for this user
  await prisma.refreshToken.deleteMany({ where: { userId: req.userId } });
  res.json({ success: true });
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    include: { wallet: true },
  });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json(formatUser(user, user.wallet?.address ?? ''));
});

// POST /api/auth/google (exchange Google ID token from mobile)
router.post('/google', async (req: Request, res: Response) => {
  const { idToken, name } = z
    .object({ idToken: z.string(), name: z.string().optional() })
    .parse(req.body);

  // Verify Google ID token
  const googleRes = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`,
  );
  if (!googleRes.ok) {
    res.status(401).json({ error: 'Invalid Google token' });
    return;
  }
  const googlePayload = (await googleRes.json()) as {
    sub: string;
    email: string;
    name: string;
    picture: string;
  };

  let user = await prisma.user.findFirst({
    where: { OR: [{ googleId: googlePayload.sub }, { email: googlePayload.email }] },
    include: { wallet: true },
  });

  if (!user) {
    const walletData = createWallet();
    user = await prisma.user.create({
      data: {
        email: googlePayload.email,
        googleId: googlePayload.sub,
        name: name ?? googlePayload.name,
        avatarUrl: googlePayload.picture,
        emailVerified: true,
        wallet: {
          create: {
            address: walletData.address,
            encryptedKey: walletData.encryptedKey,
            keyIv: walletData.keyIv,
            keyAuthTag: walletData.keyAuthTag,
          },
        },
      },
      include: { wallet: true },
    });
  } else if (!user.googleId) {
    // Link Google to existing email account
    user = await prisma.user.update({
      where: { id: user.id },
      data: { googleId: googlePayload.sub, avatarUrl: googlePayload.picture, emailVerified: true },
      include: { wallet: true },
    });
  }

  const { accessToken, refreshToken } = await issueTokens(user.id, user.email, user.role);

  res.json({
    accessToken,
    refreshToken,
    user: formatUser(user, user.wallet?.address ?? ''),
  } as AuthResponse);
});

export default router;
