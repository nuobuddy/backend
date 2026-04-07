import {
  IRouter, Router, Request, Response,
} from 'express';
import { asyncHandler } from '@/middleware/asyncHandler';
import { authMiddleware, AuthRequest } from '@/middleware/auth';
import { sendError, sendSuccess } from '@/lib/response';
import { UserService } from '@/services/UserService';
import { AuthService } from '@/services/AuthService';
import { EmailService } from '@/services/EmailService';

const router: IRouter = Router();

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * POST /user/register
 * Body: { username, email, password }
 */
router.post('/register', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { username, email, password } = req.body as {
    username?: string;
    email?: string;
    password?: string;
  };

  if (!username || !email || !password) {
    sendError(res, 'Username, email, and password are required', 400);
    return;
  }
  if (!isValidEmail(email)) {
    sendError(res, 'Invalid email format', 400);
    return;
  }
  if (password.length < 6) {
    sendError(res, 'Password must be at least 6 characters', 400);
    return;
  }

  try {
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
  } catch (err) {
    sendError(res, (err as Error).message, 400);
  }
}));

/**
 * POST /user/login
 * Body: { email, password }
 */
router.post('/login', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as {
    email?: string;
    password?: string;
  };

  if (!email || !password) {
    sendError(res, 'Email and password are required', 400);
    return;
  }
  if (!isValidEmail(email)) {
    sendError(res, 'Invalid email format', 400);
    return;
  }

  const user = await UserService.validateCredentials(email, password);
  if (!user) {
    sendError(res, 'Invalid credentials', 401);
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
}));

/**
 * GET /user/profile
 */
router.get('/profile', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
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
  }, 'Success');
}));

/**
 * POST /user/profile/update
 * Body: { username?, password? }
 */
router.post('/profile/update', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { userId } = req.user!;
  const { username, password } = req.body as {
    username?: string;
    password?: string;
  };

  if (!username && !password) {
    sendError(res, 'Username or password is required', 400);
    return;
  }

  if (password && password.length < 6) {
    sendError(res, 'Password must be at least 6 characters', 400);
    return;
  }

  const user = await UserService.updateProfile(userId, { username, password });

  sendSuccess(res, {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  }, 'Profile updated successfully');
}));

/**
 * POST /user/send-code
 * Body: { email, type }
 */
router.post('/send-code', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { email, type } = req.body as { email?: string; type?: 'forgot-password' | 'register' };

  if (!email || !type) {
    sendError(res, 'Email and type are required', 400);
    return;
  }
  if (!isValidEmail(email)) {
    sendError(res, 'Invalid email format', 400);
    return;
  }

  const hasRecent = await EmailService.hasRecentCode(email, type);
  if (hasRecent) {
    sendError(res, 'Please wait before requesting another code', 429);
    return;
  }

  const code = await EmailService.sendVerificationCode(email, type);
  // DEBUG: return code for local testing only
  sendSuccess(res, { code }, 'If the email exists, a verification code has been sent');
}));

/**
 * POST /user/forgot-password
 * Body: { email, code, newPassword }
 */
router.post('/forgot-password', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { email, code, newPassword } = req.body as {
    email?: string;
    code?: string;
    newPassword?: string;
  };

  if (!email || !code || !newPassword) {
    sendError(res, 'Email, code, and newPassword are required', 400);
    return;
  }
  if (!isValidEmail(email)) {
    sendError(res, 'Invalid email format', 400);
    return;
  }
  if (newPassword.length < 6) {
    sendError(res, 'New password must be at least 6 characters', 400);
    return;
  }

  const isValid = await EmailService.verifyCode(email, code, 'forgot-password');
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
}));

export default router;
