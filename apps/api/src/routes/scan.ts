import { Router, Request, Response } from 'express';
import { z } from 'zod';
import * as jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { decryptQrSecret, encryptQrSecret, generateQrSecret } from '../lib/wallet';
import { verifyQrToken } from '../lib/jwt';
import { getNftContract } from '../lib/blockchain';

const router = Router();

// POST /api/scan/verify
router.post(
  '/verify',
  requireAuth,
  requireRole('ADMIN', 'ORGANIZER', 'SCANNER'),
  async (req: Request, res: Response) => {
    const { token, eventId } = z
      .object({ token: z.string(), eventId: z.string() })
      .parse(req.body);

    // Decode without verifying to extract ticketId
    const unverified = jwt.decode(token) as { tid?: string } | null;
    if (!unverified?.tid) {
      res.status(422).json({
        success: false,
        reason: 'INVALID_TOKEN',
      });
      return;
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: unverified.tid },
      include: {
        owner: { select: { name: true } },
        tier: { select: { name: true } },
        event: { select: { title: true } },
      },
    });

    if (!ticket) {
      await prisma.scanLog.create({
        data: { ticketId: unverified.tid, scannerId: req.userId, eventId, success: false, failReason: 'INVALID_TOKEN', ipAddress: req.ip },
      });
      res.status(422).json({ success: false, reason: 'INVALID_TOKEN' });
      return;
    }

    // Verify ticket belongs to this event
    if (ticket.eventId !== eventId) {
      await prisma.scanLog.create({
        data: { ticketId: ticket.id, scannerId: req.userId, eventId, success: false, failReason: 'WRONG_EVENT', ipAddress: req.ip },
      });
      res.status(422).json({ success: false, reason: 'WRONG_EVENT' });
      return;
    }

    // Check status
    if (ticket.status === 'SCANNED') {
      await prisma.scanLog.create({
        data: { ticketId: ticket.id, scannerId: req.userId, eventId, success: false, failReason: 'ALREADY_SCANNED', ipAddress: req.ip },
      });
      res.status(422).json({ success: false, reason: 'ALREADY_SCANNED' });
      return;
    }

    if (ticket.status === 'VOID' || ticket.status === 'TRANSFERRED') {
      await prisma.scanLog.create({
        data: { ticketId: ticket.id, scannerId: req.userId, eventId, success: false, failReason: 'TICKET_VOID', ipAddress: req.ip },
      });
      res.status(422).json({ success: false, reason: 'TICKET_VOID' });
      return;
    }

    // Verify JWT with the ticket's qrSecret
    const qrSecret = decryptQrSecret(ticket.qrSecret, ticket.qrSecretIv, ticket.qrSecretTag);
    try {
      verifyQrToken(token, qrSecret);
    } catch (err: any) {
      const reason = err.name === 'TokenExpiredError' ? 'EXPIRED' : 'INVALID_TOKEN';
      await prisma.scanLog.create({
        data: { ticketId: ticket.id, scannerId: req.userId, eventId, success: false, failReason: reason, ipAddress: req.ip },
      });
      res.status(422).json({ success: false, reason });
      return;
    }

    // Success — rotate QR secret and mark ticket as scanned
    const newSecret = generateQrSecret();
    const { encrypted, iv, tag } = encryptQrSecret(newSecret);

    await prisma.$transaction([
      prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          status: 'SCANNED',
          usedAt: new Date(),
          qrSecret: encrypted,
          qrSecretIv: iv,
          qrSecretTag: tag,
        },
      }),
      prisma.scanLog.create({
        data: { ticketId: ticket.id, scannerId: req.userId, eventId, success: true, ipAddress: req.ip },
      }),
    ]);

    // Mark on blockchain (non-blocking)
    getNftContract()
      .markScanned(BigInt(ticket.tokenId))
      .catch((err: Error) => console.error('markScanned blockchain call failed:', err.message));

    res.json({
      success: true,
      ticket: {
        holderName: ticket.owner.name,
        tierName: ticket.tier.name,
        eventTitle: ticket.event.title,
      },
    });
  },
);

export default router;
