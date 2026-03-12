import {
  IRouter, Router, Request, Response,
} from 'express';
import { asyncHandler } from '@/middleware/asyncHandler';
import { authMiddleware } from '@/middleware/auth';
import { adminMiddleware } from '@/middleware/admin';
import { sendSuccess, sendBadRequest, sendNotFound } from '@/lib/response';
import { UserService } from '@/services/UserService';

const router: IRouter = Router();

// All admin routes require both auth and admin middleware
const adminHandler = [authMiddleware, adminMiddleware];

/**
 * GET /admin/users
 * Get paginated user list (admin only).
 */
router.get(
  '/users',
  adminHandler,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 10));

    const { users, total } = await UserService.findAll(page, limit);

    sendSuccess(res, {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  }),
);

/**
 * POST /admin/users
 * Create a new user (admin only).
 */
router.post(
  '/users',
  adminHandler,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const {
      username, email, password, role = 'user',
    } = req.body;

    if (!username || !email || !password) {
      sendBadRequest(res, 'Username, email, and password are required');
      return;
    }

    if (!['user', 'admin'].includes(role)) {
      sendBadRequest(res, 'Role must be either "user" or "admin"');
      return;
    }

    if (password.length < 6) {
      sendBadRequest(res, 'Password must be at least 6 characters');
      return;
    }

    const user = await UserService.createUser({
      username, email, password, role,
    });

    sendSuccess(res, {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    }, 'User created successfully');
  }),
);

/**
 * DELETE /admin/users/:id
 * Delete a user (admin only).
 */
router.delete(
  '/users/:id',
  adminHandler,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    try {
      await UserService.deleteUser(id);
      sendSuccess(res, null, 'User deleted successfully');
    } catch (error) {
      if (error instanceof Error && error.message === 'User not found') {
        sendNotFound(res, 'User not found');
      } else {
        throw error;
      }
    }
  }),
);

/**
 * PATCH /admin/users/:id/password
 * Reset a user's password (admin only).
 */
router.patch(
  '/users/:id/password',
  adminHandler,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
      sendBadRequest(res, 'New password is required');
      return;
    }

    if (newPassword.length < 6) {
      sendBadRequest(res, 'Password must be at least 6 characters');
      return;
    }

    const user = await UserService.findById(id);
    if (!user) {
      sendNotFound(res, 'User not found');
      return;
    }

    // Use the public resetPassword function
    await UserService.resetPassword(id, newPassword);

    sendSuccess(res, null, 'Password reset successfully');
  }),
);

export default router;
