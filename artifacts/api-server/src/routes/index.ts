import { Router, type IRouter } from "express";
import healthRouter from "./health";
import fetchPageRouter from "./fetch-page";
import fetchPagesRouter from "./fetch-pages";
import proxiesRouter from "./proxies";
import trafficRouter from "./traffic";

const router: IRouter = Router();

router.use(healthRouter);
router.use(fetchPageRouter);
router.use(fetchPagesRouter);
router.use(proxiesRouter);
router.use(trafficRouter);

export default router;
