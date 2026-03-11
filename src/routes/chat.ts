import {
  IRouter, Router, Request, Response,
} from 'express';
import { asyncHandler } from '@/middleware/asyncHandler';
import { sendSuccess } from '@/lib/response';

const router: IRouter = Router();

/**
 * GET /chat
 * Placeholder — list available chat endpoints.
 */
router.get('/', asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  sendSuccess(res, null, 'Chat API');
}));

export default router;
