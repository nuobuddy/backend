import {
  IRouter, Router, Request, Response,
} from 'express';
import { asyncHandler } from '@/middleware/asyncHandler';
import { authRequired } from '@/middleware/auth';
import { sendError, sendSuccess } from '@/lib/response';
import { UserService } from '@/services/UserService';
import { AuthService } from '@/services/AuthService';
import { EmailService } from '@/services/EmailService';
import { AppDataSource } from '@/config/database';
import { User } from '@/entities/User';

const router: IRouter = Router();

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function toAuthUser(user: { id: string; username: string; email: string; role: 'user' | 'admin' }): {
  id: string;
  username: string;
  email: string;
  role: 'user' | 'admin';
} {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
  };
}

function toProfileUser(user: {
  id: string;
  username: string;
  email: string;
  role: 'user' | 'admin';
  isActive: boolean;
  createdAt: Date;
}): {
  id: string;
  username: string;
  email: string;
  role: 'user' | 'admin';
  isActive: boolean;
  createdAt: Date;
} {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

/**
 * POST /user/register
 * Body: { username, email, password }
 */
router.post('/register', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { username, email, password, code } = req.body as {
    username?: string;
    email?: string;
    password?: string;
    code?: string;
  };

  if (!username || !email || !password || !code) {
    sendError(res, 'username, email, password, code are required', 400);
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
    const codeOk = await EmailService.verifyCode(email, code, 'register');
    if (!codeOk) {
      sendError(res, 'invalid or expired verification code', 400);
      return;
    }

    const user = await UserService.register(username, email, password);
    const token = AuthService.signToken({ userId: user.id, role: user.role });
    sendSuccess(res, { token, user: toAuthUser(user) }, 'Registration successful');
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
    sendError(res, 'email and password are required', 400);
    return;
  }
  if (!isValidEmail(email)) {
    sendError(res, 'invalid email format', 400);
    return;
  }

  const user = await UserService.validateCredentials({ email }, password);
  if (!user) {
    sendError(res, 'invalid credentials', 401);
    return;
  }

  const token = AuthService.signToken({ userId: user.id, role: user.role });
  sendSuccess(res, { token, user: toAuthUser(user) }, 'Login successful');
}));

/**
 * GET /user/profile
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

  sendSuccess(res, toProfileUser(user), 'Success');
}));

/**
 * POST /user/profile/update
 * Body: { username?, password? }
 */
router.post('/profile/update', authRequired, asyncHandler(async (req: Request, res: Response): Promise<void> => {
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
  const userEntity = await userRepo.findOne({ where: { id: userId } });
  if (!userEntity) {
    sendError(res, 'user not found', 404);
    return;
  }

  if (username && username !== userEntity.username) {
    const exists = await userRepo.findOne({ where: { username } });
    if (exists) {
      sendError(res, 'username already in use', 409);
      return;
    }
    userEntity.username = username;
    await userRepo.save(userEntity);
  }

  if (password) {
    await UserService.resetPassword(userId, password);
  }

  const user = await UserService.findById(userId);
  if (!user) {
    sendError(res, 'user not found', 404);
    return;
  }
  sendSuccess(res, toProfileUser(user), 'Profile updated successfully');
}));

/**
 * POST /user/send-code
 * Body: { email }
 */
router.post('/send-code', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { email, type } = req.body as { email?: string; type?: 'forgot-password' | 'register' };

  if (!email || !type) {
    sendError(res, 'email and type are required', 400);
    return;
  }
  if (!isValidEmail(email)) {
    sendError(res, 'invalid email format', 400);
    return;
  }

  const hasRecent = await EmailService.hasRecentCode(email, type);
  if (hasRecent) {
    sendError(res, 'Please wait before requesting another code', 429);
    return;
  }

  const code = await EmailService.sendVerificationCode(email, type);
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
    sendError(res, 'email, code, and newPassword are required', 400);
    return;
  }
  if (!isValidEmail(email)) {
    sendError(res, 'invalid email format', 400);
    return;
  }
  if (newPassword.length < 6) {
    sendError(res, 'newPassword must be at least 6 characters', 400);
    return;
  }

  const isValid = await EmailService.verifyCode(email, code, 'forgot-password');
  if (!isValid) {
    sendError(res, 'invalid or expired verification code', 400);
    return;
  }

  const user = await UserService.findByEmail(email);
  if (!user) {
    sendError(res, 'user not found', 404);
    return;
  }

  await UserService.resetPassword(user.id, newPassword);
  sendSuccess(res, null, 'Password reset successful');
}));

export default router;
