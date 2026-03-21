import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '@/config/env';
import { sendUnauthorized } from '@/lib/response';
import type { JwtPayload } from '@/types/express.d';

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

/**
 * JWT authentication middleware.
 * Extracts and verifies the Bearer token from Authorization header.
 */
export function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendUnauthorized(res, 'Missing or invalid authorization header');
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, env.jwt.secret) as JwtPayload;
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      sendUnauthorized(res, 'Token expired');
    } else {
      sendUnauthorized(res, 'Invalid token');
    }
  }
}
