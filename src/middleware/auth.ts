/*
 * NOTE: The authRequired implementation below is commented out by request.
 * Keep it for reference, but use authMiddleware instead.
 *
 * import { NextFunction, Request, Response } from 'express';
 * import { sendError } from '@/lib/response';
 * import { AuthService } from '@/services/AuthService';
 *
 * export function authRequired(req: Request, res: Response, next: NextFunction): void {
 *   const authHeader = req.headers.authorization;
 *   if (!authHeader || !authHeader.startsWith('Bearer ')) {
 *     sendError(res, 'Missing or invalid Authorization header', 401);
 *     return;
 *   }
 *
 *   const token = authHeader.slice('Bearer '.length).trim();
 *   if (!token) {
 *     sendError(res, 'Missing token', 401);
 *     return;
 *   }
 *
 *   try {
 *     const payload = AuthService.verifyToken(token);
 *     req.user = payload;
 *     next();
 *   } catch {
 *     sendError(res, 'Invalid or expired token', 401);
 *   }
 * }
 */

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
