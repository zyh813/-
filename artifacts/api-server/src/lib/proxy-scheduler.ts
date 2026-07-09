import { listProxies, markAlive, markDead, poolStats, removeDeadProxies } from "./proxy-pool";
import { undiciFetch } from "./undici-fetch";
import { logger } from "./logger";
import { saveSchedulerConfigToDb } from "./proxy-db";

interface SchedulerState {
  enabled: boolean;
  intervalMs: number;
  testUrl: string;
  autoClearDead: boolean;
  timer: ReturnType<typeof setInterval> | null;
  lastRunAt: string | null;
  lastRunStats: { total: number; alive: number; dead: number } | null;
  nextRunAt: string | null;
  runCount: number;
  lastAutoClearedCount: number | null;
}

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_TEST_URL = "https://httpbin.org/ip";

const state: SchedulerState = {
  enabled: false,
  intervalMs: DEFAULT_INTERVAL_MS,
  testUrl: DEFAULT_TEST_URL,
  autoClearDead: false,
  timer: null,
  lastRunAt: null,
  lastRunStats: null,
  nextRunAt: null,
  runCount: 0,
  lastAutoClearedCount: null,
};

async function runHealthCheck(): Promise<void> {
  const proxies = listProxies();
  if (proxies.length === 0) {
    logger.info("proxy-scheduler: 代理池为空，跳过检测");
    return;
  }

  logger.info({ total: proxies.length, testUrl: state.testUrl }, "proxy-scheduler: 开始健康检测");

  await Promise.allSettled(
    proxies.map(async (proxy) => {
      const start = Date.now();
      try {
        await undiciFetch(state.testUrl, proxy.url, 8000);
        const latencyMs = Date.now() - start;
        markAlive(proxy.id, latencyMs);
        logger.info({ proxy: proxy.url, latencyMs }, "proxy-scheduler: 代理正常");
      } catch {
        markDead(proxy.id);
        logger.warn({ proxy: proxy.url }, "proxy-scheduler: 代理失效");
      }
    })
  );

  state.lastRunAt = new Date().toISOString();
  state.lastRunStats = poolStats();
  state.runCount++;

  if (state.autoClearDead) {
    const { removed } = removeDeadProxies();
    state.lastAutoClearedCount = removed;
    if (removed > 0) {
      logger.info({ removed }, "proxy-scheduler: 自动清除失效代理");
    }
  }

  if (state.enabled) {
    state.nextRunAt = new Date(Date.now() + state.intervalMs).toISOString();
  }

  logger.info(state.lastRunStats, "proxy-scheduler: 检测完成");
}

export function startScheduler(intervalMs?: number, testUrl?: string, autoClearDead?: boolean): void {
  if (intervalMs && intervalMs > 0) state.intervalMs = intervalMs;
  if (testUrl) state.testUrl = testUrl;
  if (autoClearDead !== undefined) state.autoClearDead = autoClearDead;

  if (state.timer) {
    clearInterval(state.timer);
  }

  state.enabled = true;
  state.nextRunAt = new Date(Date.now() + state.intervalMs).toISOString();
  state.timer = setInterval(() => {
    runHealthCheck().catch((err) => logger.error({ err }, "proxy-scheduler: 检测出错"));
  }, state.intervalMs);

  saveSchedulerConfigToDb({
    enabled: true,
    intervalMs: state.intervalMs,
    testUrl: state.testUrl,
    autoClearDead: state.autoClearDead,
  }).catch(() => {});

  logger.info(
    { intervalMs: state.intervalMs, testUrl: state.testUrl, autoClearDead: state.autoClearDead },
    "proxy-scheduler: 已启动"
  );
}

export function stopScheduler(): void {
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
  state.enabled = false;
  state.nextRunAt = null;

  saveSchedulerConfigToDb({
    enabled: false,
    intervalMs: state.intervalMs,
    testUrl: state.testUrl,
    autoClearDead: state.autoClearDead,
  }).catch(() => {});

  logger.info("proxy-scheduler: 已停止");
}

export async function runNow(): Promise<void> {
  await runHealthCheck();
}

export function getSchedulerStatus() {
  return {
    enabled: state.enabled,
    intervalMs: state.intervalMs,
    intervalMinutes: Math.round(state.intervalMs / 60000),
    testUrl: state.testUrl,
    autoClearDead: state.autoClearDead,
    lastRunAt: state.lastRunAt,
    lastRunStats: state.lastRunStats,
    nextRunAt: state.nextRunAt,
    runCount: state.runCount,
    lastAutoClearedCount: state.lastAutoClearedCount,
  };
}
