import { IRouter, Router } from 'express';
import healthRouter from './health';
import adminRouter from './admin';
import userRouter from './user';
import chatRouter from './chat';
import commonRouter from './common';

const router: IRouter = Router();

router.use('/health', healthRouter);
router.use('/admin', adminRouter);
router.use('/user', userRouter);
router.use('/chat', chatRouter);
router.use('/common', commonRouter);

export default router;
