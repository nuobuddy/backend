import {
  IRouter, Router, Request, Response,
} from 'express';
import { asyncHandler } from '@/middleware/asyncHandler';
import { sendSuccess } from '@/lib/response';
import { UserService } from '../services/UserService';

const router: IRouter = Router();

/**
 * GET /admin
 * Simple admin route check
 */
router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, null, 'Admin API');
}));

/**
 * GET /admin/users?page=1&limit=10
 * Get paginated user list
 */
router.get('/users', asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 10);

  const result = await UserService.findAll(page, limit);

  return sendSuccess(res, result, 'OK');
}));

/**
 * POST /admin/users
 * Create a new user
 */
router.post('/users', asyncHandler(async (req: Request, res: Response) => {
  const {
    username, email, password, role,
  } = req.body;

  if (!username || !email || !password) {
    res.status(400).json({
      status: 400,
      data: null,
      message: 'Missing required fields',
    });
    return;
  }

  const user = await UserService.createUser({
    username,
    email,
    password,
    role: role ?? 'user',
  });

  sendSuccess(res, user, 'User created successfully');
}));

/**
 * POST /admin/users/delete
 * Delete a user
 */
router.post('/users/delete', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.body;

  if (!userId) {
    res.status(400).json({
      status: 400,
      data: null,
      message: 'userId is required',
    });
    return;
  }

  await UserService.deleteUser(userId);

  sendSuccess(res, null, 'User deleted successfully');
}));

/**
 * POST /admin/users/reset-password
 * Reset user password
 */
router.post('/users/:id/reset-password', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  if (!id || !newPassword) {
    res.status(400).json({
      status: 400,
      data: null,
      message: 'id and newPassword are required',
    });
    return;
  }

  await UserService.resetPassword(id, newPassword);

  sendSuccess(res, null, 'Password reset successfully');
}));

export default router;
