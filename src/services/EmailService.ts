import { redis } from '@/config/redis';
import { UserService } from './UserService';

const VERIFICATION_CODE_EXPIRY = 300; // 5 minutes in seconds

/**
 * Generate a 6-digit verification code.
 */
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * EmailService for handling verification codes via Redis.
 */
export class EmailService {
  /**
   * Send a password reset verification code to user's email.
   * Returns the code (for development/testing - in production, send via email service).
   */
  static async sendPasswordResetCode(email: string): Promise<string> {
    const user = await UserService.findByEmail(email);
    if (!user) {
      // Don't reveal if email exists
      return '';
    }

    const code = generateCode();
    const key = `password_reset:${email}`;

    // Store code in Redis with 5-minute expiry
    await redis.setex(key, VERIFICATION_CODE_EXPIRY, code);

    // TODO: Integrate with actual email service (SendGrid, AWS SES, etc.)
    // For now, log the code (remove in production)
    console.log(`[DEV] Password reset code for ${email}: ${code}`);

    return code;
  }

  /**
   * Verify the password reset code.
   * Returns true if valid, false otherwise.
   */
  static async verifyPasswordResetCode(
    email: string,
    code: string,
  ): Promise<boolean> {
    const key = `password_reset:${email}`;
    const storedCode = await redis.get(key);

    if (!storedCode) {
      return false;
    }

    if (storedCode !== code) {
      return false;
    }

    // Code is valid - delete it to prevent reuse
    await redis.del(key);
    return true;
  }

  /**
   * Check if a password reset code exists (for rate limiting).
   */
  static async hasRecentCode(email: string): Promise<boolean> {
    const key = `password_reset:${email}`;
    const exists = await redis.exists(key);
    return exists === 1;
  }
}
