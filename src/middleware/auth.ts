import { NextFunction, Request, Response } from 'express';
import { sendError } from '@/lib/response';
import { AuthService } from '@/services/AuthService';
import type { JwtPayload } from '@/types/express';

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export function authRequired(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendError(res, 'Missing or invalid Authorization header', 401);
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    sendError(res, 'Missing token', 401);
    return;
  }

  try {
    const payload = AuthService.verifyToken(token);
    req.user = payload;
    next();
  } catch {
    sendError(res, 'Invalid or expired token', 401);
  }
}
