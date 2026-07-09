import { Router, type IRouter } from "express";
import { listTraffic, getTrafficEntry, clearTraffic, trafficStats } from "../lib/traffic-store";

const router: IRouter = Router();

router.get("/traffic", (req, res) => {
  const { url, status, source, limit, offset } = req.query as Record<string, string>;
  const result = listTraffic({
    url,
    status,
    source,
    limit: limit ? Number(limit) : undefined,
    offset: offset ? Number(offset) : undefined,
  });
  res.json({ ...result, stats: trafficStats() });
});

router.get("/traffic/:id", (req, res) => {
  const entry = getTrafficEntry(req.params.id);
  if (!entry) {
    res.status(404).json({ error: "未找到该流量记录" });
    return;
  }
  res.json(entry);
});

router.delete("/traffic", (req, res) => {
  clearTraffic();
  req.log.info("流量记录已清空");
  res.json({ message: "流量记录已清空" });
});

export default router;
