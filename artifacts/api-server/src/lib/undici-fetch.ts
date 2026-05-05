import { ProxyAgent, fetch as undiciFetchRaw } from "undici";

export async function undiciFetch(
  targetUrl: string,
  proxyUrl: string,
  timeoutMs: number
): Promise<{ statusCode: number; body: string }> {
  const agent = new ProxyAgent({ uri: proxyUrl, connectTimeout: timeoutMs });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await undiciFetchRaw(targetUrl, {
      method: "GET",
      signal: controller.signal,
      dispatcher: agent,
    } as Parameters<typeof undiciFetchRaw>[1]);
    const body = await res.text();
    return { statusCode: res.status, body };
  } finally {
    clearTimeout(timer);
    await agent.close().catch(() => {});
  }
}
