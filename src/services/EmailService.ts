import { redis } from '@/config/redis';
import { UserService } from './UserService';

const VERIFICATION_CODE_EXPIRY = 300; // 5 minutes in seconds
const RATE_LIMIT_SECONDS = 30; // rate limit window in seconds
type VerificationType = 'forgot-password' | 'register';

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
   * Send a verification code for a specific flow.
   * Returns the code (for development/testing - in production, send via email service).
   */
  static async sendVerificationCode(email: string, type: VerificationType): Promise<string> {
    if (type === 'forgot-password') {
      const user = await UserService.findByEmail(email);
      if (!user) {
        // Don't reveal if email exists
        return '';
      }
    }

    const code = generateCode();
    const key = `verification:${type}:${email}`;
    const rateKey = `verification:rate:${type}:${email}`;

    // Store code in Redis with 5-minute expiry
    await redis.setex(key, VERIFICATION_CODE_EXPIRY, code);
    // Rate limit per email + type
    await redis.setex(rateKey, RATE_LIMIT_SECONDS, '1');

    // TODO: Integrate with actual email service (SendGrid, AWS SES, etc.)
    // For now, log the code (remove in production)
    console.log(`[DEV] ${type} code for ${email}: ${code}`);

    return code;
  }

  /**
   * Verify a code for a specific flow.
   * Returns true if valid, false otherwise.
   */
  static async verifyCode(
    email: string,
    code: string,
    type: VerificationType,
  ): Promise<boolean> {
    const key = `verification:${type}:${email}`;
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
   * Check if a verification code exists (for rate limiting).
   */
  static async hasRecentCode(email: string, type: VerificationType): Promise<boolean> {
    const rateKey = `verification:rate:${type}:${email}`;
    const exists = await redis.exists(rateKey);
    return exists === 1;
  }

  /**
   * Legacy compatibility: password reset code helpers.
   */
  static async sendPasswordResetCode(email: string): Promise<string> {
    return this.sendVerificationCode(email, 'forgot-password');
  }

  static async verifyPasswordResetCode(email: string, code: string): Promise<boolean> {
    return this.verifyCode(email, code, 'forgot-password');
  }

  static async hasRecentCodeForReset(email: string): Promise<boolean> {
    return this.hasRecentCode(email, 'forgot-password');
  }
}
