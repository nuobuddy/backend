import {
  IRouter, Router, Request, Response,
} from 'express';
import { asyncHandler } from '@/middleware/asyncHandler';
import { sendSuccess } from '@/lib/response';

const router: IRouter = Router();

/**
 * GET /user
 * Placeholder — list available user endpoints.
 */
router.get('/', asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  sendSuccess(res, null, 'User API');
}));

export default router;
