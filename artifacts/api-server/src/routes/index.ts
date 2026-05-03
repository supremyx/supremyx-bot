import { Router, type IRouter } from "express";
import healthRouter from "./health";
import rankingRouter from "./ranking";

const router: IRouter = Router();

router.use(healthRouter);
router.use(rankingRouter);

export default router;
