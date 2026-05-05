import { Router, type IRouter } from "express";
import * as cheerio from "cheerio";

const router: IRouter = Router();

router.get("/fetch-page", async (req, res) => {
  const targetUrl = req.query.url as string;

  if (!targetUrl) {
    res.status(400).json({ error: "缺少参数：url" });
    return;
  }

  try {
    const parsedUrl = new URL(targetUrl);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      res.status(400).json({ error: "仅支持 http 和 https 协议" });
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const statusCode = response.status;
    const contentType = response.headers.get("content-type") ?? "";
    const body = await response.text();

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
        const absolute = new URL(href, targetUrl).href;
        if (text || absolute) {
          links.push({ text: text || "(无文字)", href: absolute });
        }
      } catch {
      }
    });

    const headings: { level: string; text: string }[] = [];
    $("h1, h2, h3, h4, h5, h6").each((_i, el) => {
      const text = $(el).text().trim();
      if (text) {
        headings.push({ level: el.tagName.toLowerCase(), text });
      }
    });

    $("script, style, noscript, nav, footer, header").remove();
    const bodyText = $("body")
      .text()
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 2000);

    req.log.info({ url: targetUrl, statusCode }, "fetch-page 请求成功");

    res.json({
      url: targetUrl,
      statusCode,
      contentType,
      parsed: {
        title,
        metaDescription,
        headings,
        links: links.slice(0, 50),
        bodyText,
      },
      rawBody: body,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "未知错误";
    req.log.error({ url: targetUrl, err }, "fetch-page 请求失败");
    res.status(500).json({ error: `请求失败: ${message}` });
  }
});

export default router;
