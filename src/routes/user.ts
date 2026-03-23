import {
  IRouter, Router, Request, Response,
} from 'express';
import { asyncHandler } from '@/middleware/asyncHandler';
import { authRequired } from '@/middleware/auth';
import { sendError, sendSuccess } from '@/lib/response';
import { UserService } from '@/services/UserService';
import { AuthService } from '@/services/AuthService';
import { AppDataSource } from '@/config/database';
import { User } from '@/entities/User';
import { authMiddleware, AuthRequest } from '@/middleware/auth';
import { sendSuccess, sendError, sendBadRequest } from '@/lib/response';
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
    sendError(res, 'username, email, password are required', 400);
    return;
  }
  if (!isValidEmail(email)) {
    sendError(res, 'invalid email format', 400);
    return;
  }
  if (password.length < 6) {
    sendError(res, 'password must be at least 6 characters', 400);
    return;
  }

  try {
    const user = await UserService.register(username, email, password);
    sendSuccess(res, { user }, 'registered', 201);
  } catch (err) {
    sendError(res, (err as Error).message, 400);
  }
}));

/**
 * POST /user/login
 * Body: { email?, username?, password }
 */
router.post('/login', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { email, username, password } = req.body as {
    email?: string;
    username?: string;
    password?: string;
  };

  if (!password || (!email && !username)) {
    sendError(res, 'email or username and password are required', 400);
    return;
  }
  if (email && !isValidEmail(email)) {
    sendError(res, 'invalid email format', 400);
    return;
  }

  const user = await UserService.validateCredentials({ email, username }, password);
  if (!user) {
    sendError(res, 'invalid credentials', 401);
    return;
  }

  const token = AuthService.signToken({ userId: user.id, role: user.role });
  sendSuccess(res, { token, user }, 'login success');
}));

/**
 * GET /user/me
 */
router.get('/me', authRequired, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    sendError(res, 'unauthorized', 401);
    return;
  }

  const user = await UserService.findById(userId);
  if (!user) {
    sendError(res, 'user not found', 404);
    return;
  }

  sendSuccess(res, { user });
}));

/**
 * GET /user/profile
 * Same as /user/me for profile retrieval.
 */
router.get('/profile', authRequired, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    sendError(res, 'unauthorized', 401);
    return;
  }

  const user = await UserService.findById(userId);
  if (!user) {
    sendError(res, 'user not found', 404);
    return;
  }

  sendSuccess(res, { user });
}));

/**
 * PUT /user/me
 * Body: { username?, email? }
 */
router.put('/me', authRequired, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    sendError(res, 'unauthorized', 401);
    return;
  }

  const { username, email } = req.body as {
    username?: string;
    email?: string;
  };

  if (!username && !email) {
    sendError(res, 'username or email is required', 400);
    return;
  }
  if (email && !isValidEmail(email)) {
    sendError(res, 'invalid email format', 400);
    return;
  }

  const userRepo = AppDataSource.getRepository(User);
  const user = await userRepo.findOne({ where: { id: userId } });
  if (!user) {
    sendError(res, 'user not found', 404);
    return;
  }

  if (email && email !== user.email) {
    const emailExists = await userRepo.findOne({ where: { email } });
    if (emailExists) {
      sendError(res, 'email already in use', 409);
      return;
    }
    user.email = email;
  }
  if (username && username !== user.username) {
    const usernameExists = await userRepo.findOne({ where: { username } });
    if (usernameExists) {
      sendError(res, 'username already in use', 409);
      return;
    }
    user.username = username;
  }

  const saved = await userRepo.save(user);
  const publicUser = await UserService.findById(saved.id);
  sendSuccess(res, { user: publicUser });
}));

/**
 * POST /user/updateProfile
 * Body: { username?, password? }
 */
router.post('/updateProfile', authRequired, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    sendError(res, 'unauthorized', 401);
    return;
  }

  const { username, password } = req.body as {
    username?: string;
    password?: string;
  };

  if (!username && !password) {
    sendError(res, 'username or password is required', 400);
    return;
  }
  if (password && password.length < 6) {
    sendError(res, 'password must be at least 6 characters', 400);
    return;
  }

  const userRepo = AppDataSource.getRepository(User);
  const user = await userRepo.findOne({ where: { id: userId } });
  if (!user) {
    sendError(res, 'user not found', 404);
    return;
  }

  if (username && username !== user.username) {
    const usernameExists = await userRepo.findOne({ where: { username } });
    if (usernameExists) {
      sendError(res, 'username already in use', 409);
      return;
    }
    user.username = username;
  }

  if (password) {
    await UserService.resetPassword(user.id, password);
    const publicUser = await UserService.findById(user.id);
    sendSuccess(res, { user: publicUser }, 'profile updated');
    return;
  }

  const saved = await userRepo.save(user);
  const publicUser = await UserService.findById(saved.id);
  sendSuccess(res, { user: publicUser }, 'profile updated');
}));
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
