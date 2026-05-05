import { Router, type IRouter } from "express";
import healthRouter from "./health";
import fetchPageRouter from "./fetch-page";

const router: IRouter = Router();

router.use(healthRouter);
router.use(fetchPageRouter);

export default router;
