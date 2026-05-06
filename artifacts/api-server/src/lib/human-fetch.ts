import { ProxyAgent, fetch as undiciFetch } from "undici";
import { pickProxy, getProxy, recordSuccess, recordFailure, aliveProxyCount, type ProxyEntry } from "./proxy-pool";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1",
];

const ACCEPT_LANGUAGES = [
  "zh-CN,zh;q=0.9,en;q=0.8",
  "en-US,en;q=0.9",
  "en-GB,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
  "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7",
];

export function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface FetchResult {
  url: string;
  statusCode: number;
  contentType: string;
  body: string;
  finalUrl: string;
  proxyUsed?: string;
  retriedProxies?: string[];
  fallbackToDirect?: boolean;
  preferredProxyUsed?: boolean;
}

export interface HumanFetchOptions {
  timeoutMs?: number;
  referer?: string;
  cookies?: string;
  useProxy?: boolean;
  proxyStrategy?: "random" | "roundrobin";
  forceProxy?: string;
  /** 优先使用指定 ID 的代理，失败后再走正常轮换 */
  preferredProxyId?: string;
  /** 代理全部失败时是否自动回退直连，默认 true */
  fallbackToDirect?: boolean;
  /** 最多尝试几个不同代理，默认 3 */
  maxProxyRetries?: number;
}

function buildHeaders(referer?: string, cookies?: string): Record<string, string> {
  const userAgent = randomPick(USER_AGENTS);
  const acceptLanguage = randomPick(ACCEPT_LANGUAGES);

  const headers: Record<string, string> = {
    "User-Agent": userAgent,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": acceptLanguage,
    "Accept-Encoding": "gzip, deflate, br",
    Connection: "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": referer ? "cross-site" : "none",
    "Sec-Fetch-User": "?1",
    "Cache-Control": "max-age=0",
    DNT: "1",
  };

  if (referer) headers["Referer"] = referer;
  if (cookies) headers["Cookie"] = cookies;

  return headers;
}

async function fetchViaProxy(
  targetUrl: string,
  proxy: ProxyEntry,
  headers: Record<string, string>,
  timeoutMs: number
): Promise<{ body: string; statusCode: number; contentType: string; finalUrl: string }> {
  const agent = new ProxyAgent({
    uri: proxy.url,
    connectTimeout: timeoutMs,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await undiciFetch(targetUrl, {
      method: "GET",
      headers,
      signal: controller.signal,
      dispatcher: agent,
      redirect: "follow",
    } as Parameters<typeof undiciFetch>[1]);

    const body = await response.text();
    return {
      body,
      statusCode: response.status,
      contentType: response.headers.get("content-type") ?? "",
      finalUrl: response.url,
    };
  } finally {
    clearTimeout(timer);
    await agent.close().catch(() => {});
  }
}

async function fetchDirect(
  targetUrl: string,
  headers: Record<string, string>,
  timeoutMs: number
): Promise<{ body: string; statusCode: number; contentType: string; finalUrl: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(targetUrl, {
      method: "GET",
      headers,
      signal: controller.signal,
      redirect: "follow",
    });

    const body = await response.text();
    return {
      body,
      statusCode: response.status,
      contentType: response.headers.get("content-type") ?? "",
      finalUrl: response.url,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function humanFetch(
  targetUrl: string,
  options: HumanFetchOptions = {}
): Promise<FetchResult> {
  const {
    timeoutMs = 10000,
    referer,
    cookies,
    useProxy = false,
    proxyStrategy = "roundrobin",
    preferredProxyId,
    fallbackToDirect = true,
    maxProxyRetries = 3,
  } = options;

  const headers = buildHeaders(referer, cookies);

  if (!useProxy) {
    const result = await fetchDirect(targetUrl, headers, timeoutMs);
    return { url: targetUrl, ...result };
  }

  // --- 代理重试轮换逻辑 ---
  const totalAlive = aliveProxyCount();
  const maxAttempts = Math.min(maxProxyRetries, Math.max(totalAlive, preferredProxyId ? 1 : 0));
  const triedIds = new Set<string>();
  const retriedProxies: string[] = [];
  let lastError: unknown;
  let attempt = 0;

  // 首选代理：先尝试一次
  if (preferredProxyId) {
    const preferred = getProxy(preferredProxyId);
    if (preferred && preferred.alive) {
      triedIds.add(preferred.id);
      const start = Date.now();
      try {
        const result = await fetchViaProxy(targetUrl, preferred, headers, timeoutMs);
        recordSuccess(preferred.id, Date.now() - start);
        return {
          url: targetUrl,
          ...result,
          proxyUsed: preferred.url,
          preferredProxyUsed: true,
        };
      } catch (err) {
        recordFailure(preferred.id);
        lastError = err;
        retriedProxies.push(preferred.url);
      }
      attempt = 1;
    }
  }

  for (; attempt < maxAttempts; attempt++) {
    const proxy = pickProxy(proxyStrategy, triedIds);
    if (!proxy) break;

    triedIds.add(proxy.id);
    if (attempt > 0) retriedProxies.push(proxy.url);

    const start = Date.now();
    try {
      const result = await fetchViaProxy(targetUrl, proxy, headers, timeoutMs);
      recordSuccess(proxy.id, Date.now() - start);
      return {
        url: targetUrl,
        ...result,
        proxyUsed: proxy.url,
        retriedProxies: retriedProxies.length > 0 ? retriedProxies : undefined,
      };
    } catch (err) {
      recordFailure(proxy.id);
      lastError = err;
    }
  }

  // 全部代理失败 — 决定是否回退直连
  if (fallbackToDirect) {
    const result = await fetchDirect(targetUrl, headers, timeoutMs);
    return {
      url: targetUrl,
      ...result,
      fallbackToDirect: true,
      retriedProxies: retriedProxies.length > 0 ? retriedProxies : undefined,
    };
  }

  throw lastError ?? new Error("所有代理均失败且未启用直连回退");
}
