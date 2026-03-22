import jwt from 'jsonwebtoken';
import type { JwtPayload } from '@/types/express';

const TOKEN_EXPIRES_IN = '7d';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET ?? '';
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  return secret;
}

export class AuthService {
  static signToken(payload: JwtPayload): string {
    const secret = getJwtSecret();
    return jwt.sign(payload, secret, { expiresIn: TOKEN_EXPIRES_IN });
  }

  static verifyToken(token: string): JwtPayload {
    const secret = getJwtSecret();
    return jwt.verify(token, secret) as JwtPayload;
import { env } from '@/config/env';
import { User } from '@/entities/User';
import type { JwtPayload } from '@/types/express.d';

export class AuthService {
  /**
   * Sign a JWT token for a user.
   */
  static signToken(user: User): string {
    const payload: JwtPayload = {
      userId: user.id,
      role: user.role,
    };

    return jwt.sign(payload, env.jwt.secret, {
      expiresIn: env.jwt.expiresIn as jwt.SignOptions['expiresIn'],
    });
  }

  /**
   * Verify and decode a JWT token.
   */
  static verifyToken(token: string): JwtPayload {
    return jwt.verify(token, env.jwt.secret) as JwtPayload;
  }
}
