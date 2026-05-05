import { Router, type IRouter } from "express";
import * as cheerio from "cheerio";
import { humanFetch } from "../lib/human-fetch";

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

  $("script, style, noscript, nav, footer, header").remove();
  const bodyText = $("body").text().replace(/\s+/g, " ").trim().slice(0, 2000);

  return { title, metaDescription, headings, links: links.slice(0, 50), bodyText };
}

router.get("/fetch-page", async (req, res) => {
  const targetUrl = req.query.url as string;
  const referer = req.query.referer as string | undefined;
  const cookies = req.query.cookies as string | undefined;
  const useProxy = req.query.proxy === "true";
  const proxyStrategy = (req.query.strategy as "random" | "roundrobin" | undefined) ?? "roundrobin";
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

  try {
    const result = await humanFetch(targetUrl, { referer, cookies, useProxy, proxyStrategy, fallbackToDirect, maxProxyRetries });
    const parsedContent = parseHtml(result.body, result.finalUrl);

    req.log.info({ url: targetUrl, statusCode: result.statusCode, proxy: result.proxyUsed ?? "直连" }, "fetch-page 成功");

    res.json({
      url: targetUrl,
      finalUrl: result.finalUrl,
      statusCode: result.statusCode,
      contentType: result.contentType,
      proxyUsed: result.proxyUsed ?? null,
      retriedProxies: result.retriedProxies ?? [],
      fallbackToDirect: result.fallbackToDirect ?? false,
      parsed: parsedContent,
      rawBody: result.body,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "未知错误";
    req.log.error({ url: targetUrl, err }, "fetch-page 失败");
    res.status(500).json({ error: `请求失败: ${message}` });
  }
});

export default router;
