import jwt from 'jsonwebtoken';
import { config } from '../config';
import type { UserRole } from '@blockchain-tickets/shared';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, config.jwtAccessSecret, { expiresIn: '15m' });
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, config.jwtRefreshSecret, { expiresIn: '30d' });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, config.jwtAccessSecret) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, config.jwtRefreshSecret) as RefreshTokenPayload;
}

// QR codes use short-lived JWTs signed with the ticket's unique qrSecret
export function signQrToken(ticketId: string, qrSecret: string): string {
  return jwt.sign({ tid: ticketId }, qrSecret, { expiresIn: '5m' });
}

export function verifyQrToken(token: string, qrSecret: string): { tid: string } {
  return jwt.verify(token, qrSecret) as { tid: string };
}
