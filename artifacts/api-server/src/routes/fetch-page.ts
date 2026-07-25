import { Router, type IRouter } from "express";
import * as cheerio from "cheerio";
import { humanFetch } from "../lib/human-fetch";
import { recordTraffic } from "../lib/traffic-store";

const router: IRouter = Router();

export function parseHtml(body: string, baseUrl: string) {
  const $ = cheerio.load(body);

  const title = $("title").first().text().trim() || null;
  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() || null;

  const links: { text: string; href: string }[] = [];
  $("a[href]").each((_i, el) => {
    const href = $(el).attr("href") ?? "";
    const text = $(el).text().trim();
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
    try {
      const absolute = new URL(href, baseUrl).href;
      links.push({ text: text || "(无文字)", href: absolute });
    } catch {
    }
  });

  const headings: { level: string; text: string }[] = [];
  $("h1, h2, h3, h4, h5, h6").each((_i, el) => {
    const text = $(el).text().trim();
    if (text) headings.push({ level: el.tagName.toLowerCase(), text });
  });

  // Remove all non-content elements before text extraction
  $("script, style, noscript, nav, footer, header, aside, iframe, [type='text/css'], [type='text/javascript']").remove();
  // Remove common ad / sidebar / toolbar wrappers
  $("[id*='ad'], [class*='ad-'], [class*='sidebar'], [class*='toolbar'], [class*='topnav'], [class*='header'], [class*='footer'], [class*='cookie'], [class*='banner'], [role='navigation'], [role='banner']").remove();

  // Shared line filter applied to every extracted text chunk
  function isUsableLine(raw: string): boolean {
    if (!raw || raw.length < 8) return false;
    // JSON key-value fragments
    if (/^["']?\w+["']?\s*:\s*["'\[{]/.test(raw)) return false;
    // Mostly URL-encoded (%XX) content
    if ((raw.match(/%[0-9A-Fa-f]{2}/g)?.length ?? 0) > 3) return false;
    // CSS selector blocks
    if (/^\s*[\w\-.#*>]+\s*\{/.test(raw)) return false;
    // Pure URL lines
    if (/^https?:\/\/\S+$/.test(raw)) return false;
    return true;
  }

  // Step 1: try semantic paragraph elements inside a content container
  const contentSelectors = "main, article, [role='main'], #main, #content, .content, .main";
  const $container = $(contentSelectors).first().length
    ? $(contentSelectors).first()
    : $("body");

  const sentences: string[] = [];
  $container.find("p, li, td, th, blockquote, figcaption, h1, h2, h3, h4, h5, h6, dd, dt").each((_i, el) => {
    const raw = $(el).text().replace(/\s+/g, " ").trim();
    if (isUsableLine(raw)) sentences.push(raw);
  });

  // Step 2: fallback — if semantic extraction yielded too little, take all body text and split into lines
  if (sentences.join("").length < 100) {
    const allText = $("body").text();
    // Split on newlines and Chinese sentence enders, then filter each chunk
    allText.split(/[\n\r。！？.!?]/).forEach(chunk => {
      const raw = chunk.replace(/\s+/g, " ").trim();
      if (isUsableLine(raw)) sentences.push(raw);
    });
  }

  const bodyText = sentences
    .join(" ")
    .replace(/<[^>]{0,200}>/g, " ")   // strip any residual HTML tags
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2000);

  return { title, metaDescription, headings, links: links.slice(0, 50), bodyText };
}

router.get("/fetch-page", async (req, res) => {
  const targetUrl = req.query.url as string;
  const referer = req.query.referer as string | undefined;
  const cookies = req.query.cookies as string | undefined;
  const useProxy = req.query.proxy === "true";
  const proxyStrategy = (req.query.strategy as "random" | "roundrobin" | undefined) ?? "roundrobin";
  const preferredProxyId = req.query.proxyId as string | undefined;
  const fallbackToDirect = req.query.fallback !== "false";
  const maxProxyRetries = Math.min(Number(req.query.retries ?? "3"), 10);

  if (!targetUrl) {
    res.status(400).json({ error: "缺少参数：url" });
    return;
  }

  try {
    const parsed = new URL(targetUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      res.status(400).json({ error: "仅支持 http 和 https 协议" });
      return;
    }
  } catch {
    res.status(400).json({ error: "无效的 URL 格式" });
    return;
  }

  const start = Date.now();
  try {
    const result = await humanFetch(targetUrl, { referer, cookies, useProxy, proxyStrategy, preferredProxyId, fallbackToDirect, maxProxyRetries });
    const parsedContent = parseHtml(result.body, result.finalUrl);
    const durationMs = Date.now() - start;

    req.log.info({ url: targetUrl, statusCode: result.statusCode, proxy: result.proxyUsed ?? "直连" }, "fetch-page 成功");

    recordTraffic({
      source: "fetch-page",
      method: "GET",
      targetUrl,
      finalUrl: result.finalUrl,
      statusCode: result.statusCode,
      contentType: result.contentType,
      durationMs,
      responseSize: result.body.length,
      proxyUsed: result.proxyUsed ?? null,
      fallbackToDirect: result.fallbackToDirect ?? false,
      error: null,
      requestHeaders: { "User-Agent": "humanFetch" },
      responseBodyPreview: result.body.slice(0, 2000),
    });

    res.json({
      url: targetUrl,
      finalUrl: result.finalUrl,
      statusCode: result.statusCode,
      contentType: result.contentType,
      proxyUsed: result.proxyUsed ?? null,
      retriedProxies: result.retriedProxies ?? [],
      fallbackToDirect: result.fallbackToDirect ?? false,
      preferredProxyUsed: result.preferredProxyUsed ?? false,
      parsed: parsedContent,
      rawBody: result.body,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "未知错误";
    req.log.error({ url: targetUrl, err }, "fetch-page 失败");
    recordTraffic({
      source: "fetch-page",
      method: "GET",
      targetUrl,
      finalUrl: targetUrl,
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
    res.status(500).json({ error: `请求失败: ${message}` });
  }
});

export default router;
