import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../lib/jwt';
import type { UserRole } from '@blockchain-tickets/shared';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userRole?: UserRole;
      userEmail?: string;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const payload = verifyAccessToken(header.slice(7));
    req.userId = payload.sub;
    req.userRole = payload.role;
    req.userEmail = payload.email;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  };
}
