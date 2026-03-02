import {
  IRouter, Router, Request, Response,
} from 'express';
import { sendSuccess } from '@/lib/response';

const router: IRouter = Router();

interface HealthData {
  status: 'ok';
  uptime: number;
  timestamp: string;
  memory: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
  };
}

/**
 * GET /health
 * Returns the current runtime health status of the server.
 */
router.get('/', (_req: Request, res: Response): void => {
  const mem = process.memoryUsage();
  const data: HealthData = {
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    memory: {
      rss: mem.rss,
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
    },
  };
  sendSuccess(res, data);
});

export default router;
