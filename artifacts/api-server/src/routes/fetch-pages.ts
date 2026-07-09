import { Router, type IRouter } from "express";
import { humanFetch, randomDelay } from "../lib/human-fetch";
import { parseHtml } from "./fetch-page";
import { recordTraffic } from "../lib/traffic-store";

const router: IRouter = Router();

const MAX_URLS = 20;
const CONCURRENCY = 3;
const DELAY_MIN_MS = 800;
const DELAY_MAX_MS = 2500;

interface UrlTask {
  url: string;
  referer?: string;
  cookies?: string;
  useProxy?: boolean;
  proxyStrategy?: "random" | "roundrobin";
  fallbackToDirect?: boolean;
  maxProxyRetries?: number;
}

interface PageResult {
  url: string;
  finalUrl?: string;
  statusCode?: number;
  contentType?: string;
  parsed?: ReturnType<typeof parseHtml>;
  error?: string;
}

async function fetchWithDelay(
  task: UrlTask,
  index: number
): Promise<PageResult> {
  if (index > 0) {
    await randomDelay(DELAY_MIN_MS, DELAY_MAX_MS);
  }

  const start = Date.now();
  try {
    const result = await humanFetch(task.url, {
      referer: task.referer,
      cookies: task.cookies,
      useProxy: task.useProxy,
      proxyStrategy: task.proxyStrategy,
      fallbackToDirect: task.fallbackToDirect ?? true,
      maxProxyRetries: task.maxProxyRetries ?? 3,
    });
    const parsed = parseHtml(result.body, result.finalUrl);
    recordTraffic({
      source: "fetch-pages",
      method: "GET",
      targetUrl: task.url,
      finalUrl: result.finalUrl,
      statusCode: result.statusCode,
      contentType: result.contentType,
      durationMs: Date.now() - start,
      responseSize: result.body.length,
      proxyUsed: result.proxyUsed ?? null,
      fallbackToDirect: result.fallbackToDirect ?? false,
      error: null,
      requestHeaders: { "User-Agent": "humanFetch" },
      responseBodyPreview: result.body.slice(0, 2000),
    });
    return {
      url: task.url,
      finalUrl: result.finalUrl,
      statusCode: result.statusCode,
      contentType: result.contentType,
      parsed,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "未知错误";
    recordTraffic({
      source: "fetch-pages",
      method: "GET",
      targetUrl: task.url,
      finalUrl: task.url,
      statusCode: null,
      contentType: null,
      durationMs: Date.now() - start,
      responseSize: 0,
      proxyUsed: null,
      fallbackToDirect: false,
      error: message,
      requestHeaders: { "User-Agent": "humanFetch" },
      responseBodyPreview: null,
    });
    return {
      url: task.url,
      error: message,
    };
  }
}

async function runWithConcurrency(
  tasks: UrlTask[],
  concurrency: number
): Promise<PageResult[]> {
  const results: PageResult[] = new Array(tasks.length);
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const current = index++;
      results[current] = await fetchWithDelay(tasks[current], current);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () =>
    worker()
  );
  await Promise.all(workers);

  return results;
}

router.post("/fetch-pages", async (req, res) => {
  const body = req.body as {
    urls?: unknown;
    referer?: string;
    cookies?: string;
    useProxy?: boolean;
    proxyStrategy?: "random" | "roundrobin";
    fallbackToDirect?: boolean;
    maxProxyRetries?: number;
  };

  if (!Array.isArray(body.urls) || body.urls.length === 0) {
    res.status(400).json({ error: "缺少参数：urls（数组）" });
    return;
  }

  const rawUrls = body.urls as unknown[];

  if (rawUrls.length > MAX_URLS) {
    res.status(400).json({ error: `最多支持 ${MAX_URLS} 个 URL` });
    return;
  }

  const tasks: UrlTask[] = [];
  const invalid: string[] = [];

  for (const item of rawUrls) {
    const url = typeof item === "string" ? item : (item as { url?: string })?.url;
    if (!url) {
      invalid.push(String(item));
      continue;
    }
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        invalid.push(url);
        continue;
      }
      const isObj = typeof item === "object" && item !== null;
      tasks.push({
        url,
        referer: isObj ? ((item as { referer?: string }).referer ?? body.referer) : body.referer,
        cookies: isObj ? ((item as { cookies?: string }).cookies ?? body.cookies) : body.cookies,
        useProxy: isObj ? ((item as { useProxy?: boolean }).useProxy ?? body.useProxy) : body.useProxy,
        proxyStrategy: isObj
          ? ((item as { proxyStrategy?: "random" | "roundrobin" }).proxyStrategy ?? body.proxyStrategy)
          : body.proxyStrategy,
        fallbackToDirect: body.fallbackToDirect,
        maxProxyRetries: body.maxProxyRetries,
      });
    } catch {
      invalid.push(String(item));
    }
  }

  req.log.info(
    { total: tasks.length, invalid: invalid.length },
    "fetch-pages 批量请求开始"
  );

  const results = await runWithConcurrency(tasks, CONCURRENCY);

  const succeeded = results.filter((r) => !r.error).length;
  const failed = results.filter((r) => !!r.error).length;

  req.log.info({ succeeded, failed }, "fetch-pages 批量请求完成");

  res.json({
    total: tasks.length,
    succeeded,
    failed,
    invalidUrls: invalid,
    results,
  });
});

export default router;
