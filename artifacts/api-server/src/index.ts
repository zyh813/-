import app from "./app";
import { logger } from "./lib/logger";
import { startScheduler } from "./lib/proxy-scheduler";
import { loadProxiesFromDb, loadSchedulerConfigFromDb } from "./lib/proxy-db";
import { loadProxyIntoMemory } from "./lib/proxy-pool";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function bootstrap() {
  // Start listening first so healthcheck passes immediately
  await new Promise<void>((resolve, reject) => {
    app.listen(port, (err?: Error) => {
      if (err) { logger.error({ err }, "Error listening on port"); reject(err); return; }
      logger.info({ port }, "Server listening");
      resolve();
    });
  });

  // DB init runs after the server is already accepting requests
  try {
    const proxies = await loadProxiesFromDb();
    for (const proxy of proxies) {
      loadProxyIntoMemory(proxy);
    }
    logger.info({ count: proxies.length }, "从数据库恢复代理池");

    const savedConfig = await loadSchedulerConfigFromDb();
    if (savedConfig && savedConfig.enabled) {
      startScheduler(savedConfig.intervalMs, savedConfig.testUrl, savedConfig.autoClearDead);
      logger.info({ intervalMs: savedConfig.intervalMs, autoClearDead: savedConfig.autoClearDead }, "从数据库恢复调度器配置");
    } else {
      startScheduler(5 * 60 * 1000, "https://httpbin.org/ip", false);
    }
  } catch (err) {
    logger.error({ err }, "DB 初始化失败，服务继续运行");
  }
}

bootstrap().catch((err) => {
  logger.error({ err }, "启动失败");
  process.exit(1);
});
