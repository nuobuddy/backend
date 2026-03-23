import {
  NextFunction, Request, Response,
} from 'express';
import jwt from 'jsonwebtoken';
import { env } from '@/config/env';
import { sendServerError, sendUnauthorized } from '@/lib/response';

interface AuthTokenPayload {
  userId: string;
  role: 'user' | 'admin';
}

function extractToken(req: Request): string | null {
  const { authorization } = req.headers;

  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }

  const token = authorization.slice('Bearer '.length).trim();
  return token || null;
}

export function auth(req: Request, res: Response, next: NextFunction): void {
  if (!env.jwt.secret) {
    sendServerError(res, 'JWT secret is not configured.');
    return;
  }

  const token = extractToken(req);

  if (!token) {
    sendUnauthorized(res, 'Authentication token is required.');
    return;
  }

  try {
    const payload = jwt.verify(token, env.jwt.secret) as AuthTokenPayload;
    req.user = payload;
    next();
  } catch {
    sendUnauthorized(res, 'Invalid or expired token.');
  }
}
