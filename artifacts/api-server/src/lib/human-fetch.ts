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

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface FetchResult {
  url: string;
  statusCode: number;
  contentType: string;
  body: string;
  finalUrl: string;
}

export interface HumanFetchOptions {
  timeoutMs?: number;
  referer?: string;
  cookies?: string;
}

export async function humanFetch(
  targetUrl: string,
  options: HumanFetchOptions = {}
): Promise<FetchResult> {
  const { timeoutMs = 10000, referer, cookies } = options;

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

  if (referer) {
    headers["Referer"] = referer;
  }

  if (cookies) {
    headers["Cookie"] = cookies;
  }

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
      url: targetUrl,
      statusCode: response.status,
      contentType: response.headers.get("content-type") ?? "",
      body,
      finalUrl: response.url,
    };
  } finally {
    clearTimeout(timer);
  }
}

export { randomDelay };
