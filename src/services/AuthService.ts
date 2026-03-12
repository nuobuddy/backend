import jwt from 'jsonwebtoken';
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
