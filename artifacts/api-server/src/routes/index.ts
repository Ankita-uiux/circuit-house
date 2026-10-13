import { Router, type IRouter } from "express";
import healthRouter from "./health";
import shopRouter from "./shop";
import assistantSettingsRouter from "./assistant-settings";
import chatSessionsRouter from "./chat-sessions";

const router: IRouter = Router();

router.use(healthRouter);
router.use(shopRouter);
router.use(assistantSettingsRouter);
router.use(chatSessionsRouter);

export default router;
