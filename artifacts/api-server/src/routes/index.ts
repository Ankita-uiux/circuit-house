import { Router, type IRouter } from "express";
import healthRouter from "./health";
import shopRouter from "./shop";
import assistantSettingsRouter from "./assistant-settings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(shopRouter);
router.use(assistantSettingsRouter);

export default router;
