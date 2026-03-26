import { IRouter, Router } from 'express';
import healthRouter from './health';
import settingsRouter from './settings';
import adminRouter from './admin';
import chatRouter from './chat';
import userRouter from './user';

const router: IRouter = Router();

router.use('/health', healthRouter);
router.use('/settings', settingsRouter);
router.use('/admin', adminRouter);
router.use('/chat', chatRouter);
router.use('/user', userRouter);

export default router;
