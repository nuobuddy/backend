import { IRouter, Router } from "express";
import healthRouter from "./health";
import settingsRouter from "./settings";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use("/health", healthRouter);
router.use("/settings", settingsRouter);
router.use("/admin", adminRouter);

export default router;