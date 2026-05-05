import { Router, type IRouter } from "express";
import healthRouter from "./health";
import fetchPageRouter from "./fetch-page";
import fetchPagesRouter from "./fetch-pages";

const router: IRouter = Router();

router.use(healthRouter);
router.use(fetchPageRouter);
router.use(fetchPagesRouter);

export default router;
