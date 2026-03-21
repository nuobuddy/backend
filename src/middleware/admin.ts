import { NextFunction, Response } from 'express';
import { sendForbidden } from '@/lib/response';
import type { AuthRequest } from './auth';

/**
 * Admin role verification middleware.
 * Must be used after authMiddleware.
 */
export function adminMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    sendForbidden(res, 'Authentication required');
    return;
  }

  if (req.user.role !== 'admin') {
    sendForbidden(res, 'Admin access required');
    return;
  }

  next();
}
