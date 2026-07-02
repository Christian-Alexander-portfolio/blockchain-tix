import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { getGateway } from '../lib/braintree';

const router = Router();

// GET /api/payments/braintree-token
router.get('/braintree-token', requireAuth, async (req: Request, res: Response) => {
  const result = await getGateway().clientToken.generate({});
  res.json({ clientToken: result.clientToken });
});

// GET /api/payments/usdc-session/:id/status — poll for USDC payment confirmation
router.get('/usdc-session/:id/status', requireAuth, async (req: Request, res: Response) => {
  const session = await prisma.usdcPaymentSession.findUnique({
    where: { id: req.params.id },
  });
  if (!session || session.userId !== req.userId) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  if (session.expiresAt < new Date()) {
    res.status(422).json({ error: 'Payment session expired' });
    return;
  }
  res.json({
    fulfilled: session.fulfilled,
    txHash: session.txHash,
  });
});

export default router;
