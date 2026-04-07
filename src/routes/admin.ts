import {
  IRouter, Router, Request, Response,
} from 'express';
import { asyncHandler } from '@/middleware/asyncHandler';
import { authMiddleware } from '@/middleware/auth';
import { adminMiddleware } from '@/middleware/admin';
import { sendSuccess, sendBadRequest, sendNotFound } from '@/lib/response';
import { UserService } from '@/services/UserService';
import SettingService from '@/services/SettingService';

const router: IRouter = Router();

// All admin routes require both auth and admin middleware
const adminGuard = [authMiddleware, adminMiddleware];

// ====================================================================
// GET /admin/user  — Paginated user list
// ====================================================================
router.get(
  '/user',
  adminGuard,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit as string, 10) || 10),
    );

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

// ====================================================================
// POST /admin/user/create  — Create a new user
// ====================================================================
router.post(
  '/user/create',
  adminGuard,
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

    try {
      const user = await UserService.createUser({
        username,
        email,
        password,
        role,
      });

      sendSuccess(
        res,
        {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt,
        },
        'User created successfully',
      );
    } catch (err) {
      sendBadRequest(res, (err as Error).message);
    }
  }),
);

// ====================================================================
// POST /admin/user/delete  — Delete a user
// ====================================================================
router.post(
  '/user/delete',
  adminGuard,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.body as { id?: string };

    if (!id) {
      sendBadRequest(res, 'User ID is required');
      return;
    }

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

// ====================================================================
// POST /admin/user/:id/password  — Reset a user's password
// ====================================================================
router.post(
  '/user/:id/password',
  adminGuard,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { newPassword } = req.body as { newPassword?: string };

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

    await UserService.resetPassword(id, newPassword);
    sendSuccess(res, null, 'Password reset successfully');
  }),
);

// ====================================================================
// POST /admin/user/:id/status  — Enable / disable a user account
// ====================================================================
router.post(
  '/user/:id/status',
  adminGuard,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { isActive } = req.body as { isActive?: unknown };

    if (typeof isActive !== 'boolean') {
      sendBadRequest(res, 'isActive must be a boolean');
      return;
    }

    const user = await UserService.findById(id);
    if (!user) {
      sendNotFound(res, 'User not found');
      return;
    }

    await UserService.updateStatus(id, isActive);
    sendSuccess(
      res,
      null,
      `User ${isActive ? 'enabled' : 'disabled'} successfully`,
    );
  }),
);

// ====================================================================
// GET /admin/settings  — Get all system settings
// ====================================================================
router.get(
  '/settings',
  adminGuard,
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const all = await SettingService.getAll();
    sendSuccess(res, {
      settings: all.map((s) => ({
        key: s.key,
        value: s.value,
        description: s.description ?? null,
        updatedAt: s.updatedAt,
      })),
    });
  }),
);

// ====================================================================
// PUT /admin/settings  — Batch update system settings (upsert)
// ====================================================================
router.put(
  '/settings',
  adminGuard,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const body = req.body as Record<string, unknown>;

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      sendBadRequest(res, 'Request body must be a key-value object');
      return;
    }

    // Only accept string values
    const invalidKey = Object.keys(body).find(
      (k) => typeof body[k] !== 'string',
    );
    if (invalidKey) {
      sendBadRequest(res, `Value for key "${invalidKey}" must be a string`);
      return;
    }
    const entries = body as Record<string, string>;

    await SettingService.batchSet(entries);
    sendSuccess(res, null, 'Settings updated successfully');
  }),
);

export default router;
