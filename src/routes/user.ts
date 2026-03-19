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

export default router;
