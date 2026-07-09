import { Router, type IRouter } from "express";
import { undiciFetch } from "../lib/undici-fetch";
import {
  addProxy,
  removeProxy,
  listProxies,
  clearProxies,
  removeDeadProxies,
  poolStats,
  markAlive,
  markDead,
  getProxy,
  getLatencyHistory,
} from "../lib/proxy-pool";
import {
  startScheduler,
  stopScheduler,
  runNow,
  getSchedulerStatus,
} from "../lib/proxy-scheduler";

const router: IRouter = Router();

router.get("/proxies", (_req, res) => {
  res.json({ stats: poolStats(), proxies: listProxies() });
});

router.post("/proxies", (req, res) => {
  const body = req.body as { url?: unknown; label?: unknown; urls?: unknown[] };

  if (Array.isArray(body.urls)) {
    const results: { url: string; result: object }[] = [];
    for (const item of body.urls) {
      const url = typeof item === "string" ? item : (item as { url?: string })?.url ?? "";
      const label =
        typeof item === "object" && item !== null
          ? ((item as { label?: string }).label ?? undefined)
          : undefined;
      const group =
        typeof item === "object" && item !== null
          ? ((item as { group?: string }).group ?? (body as { group?: string }).group ?? undefined)
          : (body as { group?: string }).group ?? undefined;
      const result = addProxy(url, label, group);
      results.push({ url, result });
    }
    req.log.info({ count: results.length }, "批量添加代理");
    res.status(201).json({ results });
    return;
  }

  if (typeof body.url !== "string" || !body.url) {
    res.status(400).json({ error: "缺少参数：url" });
    return;
  }

  const result = addProxy(
    body.url,
    typeof body.label === "string" ? body.label : undefined,
    typeof (body as { group?: string }).group === "string" ? (body as { group?: string }).group : undefined,
  );
  if ("error" in result) {
    res.status(400).json(result);
    return;
  }

  req.log.info({ proxy: body.url }, "添加代理");
  res.status(201).json(result);
});

router.delete("/proxies", (req, res) => {
  clearProxies();
  req.log.info("清空代理池");
  res.json({ message: "代理池已清空" });
});

router.delete("/proxies/dead", (req, res) => {
  const { removed } = removeDeadProxies();
  req.log.info({ removed }, "清除失效代理");
  res.json({ removed, message: `已清除 ${removed} 个失效代理` });
});

router.delete("/proxies/:id", (req, res) => {
  const { id } = req.params;
  const deleted = removeProxy(id);
  if (!deleted) {
    res.status(404).json({ error: "代理不存在" });
    return;
  }
  req.log.info({ id }, "删除代理");
  res.json({ message: "已删除" });
});

router.get("/proxies/:id/latency-history", (req, res) => {
  const { id } = req.params;
  const proxy = getProxy(id);
  if (!proxy) {
    res.status(404).json({ error: "代理不存在" });
    return;
  }
  res.json({ id, history: getLatencyHistory(id) });
});

router.post("/proxies/:id/check", async (req, res) => {
  const { id } = req.params;
  const proxy = getProxy(id);
  if (!proxy) {
    res.status(404).json({ error: "代理不存在" });
    return;
  }

  const testUrl = (req.body as { testUrl?: string })?.testUrl ?? "https://httpbin.org/ip";
  const start = Date.now();

  try {
    const response = await undiciFetch(testUrl, proxy.url, 8000);
    const latencyMs = Date.now() - start;
    markAlive(id, latencyMs);
    req.log.info({ id, latencyMs }, "代理检测成功");
    res.json({ alive: true, latencyMs, statusCode: response.statusCode, body: response.body.slice(0, 500) });
  } catch (err: unknown) {
    markDead(id);
    const message = err instanceof Error ? err.message : "未知错误";
    req.log.warn({ id, err }, "代理检测失败");
    res.json({ alive: false, error: message });
  }
});

router.post("/proxies/check-all", async (req, res) => {
  const proxies = listProxies();
  if (proxies.length === 0) {
    res.json({ message: "代理池为空", results: [] });
    return;
  }

  const testUrl = (req.body as { testUrl?: string })?.testUrl ?? "https://httpbin.org/ip";

  const results = await Promise.allSettled(
    proxies.map(async (proxy) => {
      const start = Date.now();
      try {
        const response = await undiciFetch(testUrl, proxy.url, 8000);
        const latencyMs = Date.now() - start;
        markAlive(proxy.id, latencyMs);
        return { id: proxy.id, url: proxy.url, alive: true, latencyMs, statusCode: response.statusCode };
      } catch (err: unknown) {
        markDead(proxy.id);
        return { id: proxy.id, url: proxy.url, alive: false, error: err instanceof Error ? err.message : "未知错误" };
      }
    })
  );

  const parsed = results.map((r) => (r.status === "fulfilled" ? r.value : { error: "检测异常" }));
  req.log.info({ total: proxies.length }, "批量检测代理完成");
  res.json({ total: proxies.length, stats: poolStats(), results: parsed });
});

router.get("/proxies/scheduler", (_req, res) => {
  res.json(getSchedulerStatus());
});

router.post("/proxies/scheduler/start", (req, res) => {
  const body = req.body as { intervalMinutes?: number; testUrl?: string; autoClearDead?: boolean };
  const intervalMs = body.intervalMinutes ? body.intervalMinutes * 60 * 1000 : undefined;
  startScheduler(intervalMs, body.testUrl, body.autoClearDead);
  req.log.info({ intervalMs, testUrl: body.testUrl, autoClearDead: body.autoClearDead }, "定时检测已启动");
  res.json({ message: "定时检测已启动", status: getSchedulerStatus() });
});

router.post("/proxies/scheduler/stop", (req, res) => {
  stopScheduler();
  req.log.info("定时检测已停止");
  res.json({ message: "定时检测已停止", status: getSchedulerStatus() });
});

router.post("/proxies/scheduler/run-now", async (req, res) => {
  req.log.info("手动触发代理检测");
  await runNow();
  res.json({ message: "检测完成", status: getSchedulerStatus() });
});

export default router;
