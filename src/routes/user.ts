import {
  IRouter, Router, Request, Response,
} from 'express';
import { asyncHandler } from '@/middleware/asyncHandler';
import { authMiddleware, AuthRequest } from '@/middleware/auth';
import { sendSuccess, sendError, sendBadRequest } from '@/lib/response';
import { UserService } from '@/services/UserService';
import { AuthService } from '@/services/AuthService';
import { EmailService } from '@/services/EmailService';

const router: IRouter = Router();

/**
 * POST /user/register
 * Register a new user.
 */
router.post(
  '/register',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      sendBadRequest(res, 'Username, email, and password are required');
      return;
    }

    if (password.length < 6) {
      sendBadRequest(res, 'Password must be at least 6 characters');
      return;
    }

    const user = await UserService.register({ username, email, password });
    const token = AuthService.signToken(user);

    sendSuccess(res, {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    }, 'Registration successful');
  }),
);

/**
 * POST /user/login
 * Login with email and password.
 */
router.post(
  '/login',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body;

    if (!email || !password) {
      sendBadRequest(res, 'Email and password are required');
      return;
    }

    const user = await UserService.validateCredentials(email, password);

    if (!user) {
      sendError(res, 'Invalid email or password', 401);
      return;
    }

    const token = AuthService.signToken(user);

    sendSuccess(res, {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    }, 'Login successful');
  }),
);

/**
 * GET /user/profile
 * Get current user profile (requires auth).
 */
router.get(
  '/profile',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { userId } = req.user!;
    const user = await UserService.findById(userId);

    if (!user) {
      sendError(res, 'User not found', 404);
      return;
    }

    sendSuccess(res, {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    });
  }),
);

/**
 * PUT /user/profile
 * Update current user profile (requires auth).
 */
router.put(
  '/profile',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { userId } = req.user!;
    const { username, password } = req.body;

    if (!username && !password) {
      sendBadRequest(res, 'Username or password is required');
      return;
    }

    const user = await UserService.updateProfile(userId, { username, password });

    sendSuccess(res, {
      id: user.id,
      username: user.username,
      email: user.email,
    }, 'Profile updated');
  }),
);

/**
 * POST /user/forgot-password
 * Request a password reset code.
 */
router.post(
  '/forgot-password',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { email } = req.body;

    if (!email) {
      sendBadRequest(res, 'Email is required');
      return;
    }

    // Check for rate limiting (one code per 60 seconds)
    const hasRecent = await EmailService.hasRecentCode(email);
    if (hasRecent) {
      sendError(res, 'Please wait before requesting another code', 429);
      return;
    }

    await EmailService.sendPasswordResetCode(email);

    // Always return success to prevent email enumeration
    sendSuccess(res, null, 'If the email exists, a verification code has been sent');
  }),
);

/**
 * POST /user/reset-password
 * Reset password using verification code.
 */
router.post(
  '/reset-password',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      sendBadRequest(res, 'Email, code, and new password are required');
      return;
    }

    if (newPassword.length < 6) {
      sendBadRequest(res, 'Password must be at least 6 characters');
      return;
    }

    const isValid = await EmailService.verifyPasswordResetCode(email, code);

    if (!isValid) {
      sendError(res, 'Invalid or expired verification code', 400);
      return;
    }

    const user = await UserService.findByEmail(email);
    if (!user) {
      sendError(res, 'User not found', 404);
      return;
    }

    await UserService.resetPassword(user.id, newPassword);

    sendSuccess(res, null, 'Password reset successful');
  }),
);

export default router;
