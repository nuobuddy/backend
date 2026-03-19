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
  }
}
