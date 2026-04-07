import { IRouter, Router } from 'express';
import healthRouter from './health';
import settingsRouter from './settings';
import adminRouter from './admin';
import userRouter from './user';
import chatRouter from './chat';

const router: IRouter = Router();

router.use('/health', healthRouter);
router.use('/settings', settingsRouter);
router.use('/admin', adminRouter);
router.use('/user', userRouter);
router.use('/chat', chatRouter);

export default router;
