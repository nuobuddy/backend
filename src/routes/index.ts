import { IRouter, Router } from 'express';
import healthRouter from './health';

const router: IRouter = Router();

router.use('/health', healthRouter);

export default router;
