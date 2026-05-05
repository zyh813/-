import { Router, type IRouter } from "express";

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

    req.log.info({ url: targetUrl, statusCode }, "fetch-page 请求成功");

    res.json({
      url: targetUrl,
      statusCode,
      contentType,
      body,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "未知错误";
    req.log.error({ url: targetUrl, err }, "fetch-page 请求失败");
    res.status(500).json({ error: `请求失败: ${message}` });
  }
});

export default router;
