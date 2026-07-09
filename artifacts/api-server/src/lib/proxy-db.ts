import { db, proxiesTable, schedulerConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { ProxyEntry } from "./proxy-pool";
import { logger } from "./logger";

const SCHEDULER_KEY = "default";

export async function loadProxiesFromDb(): Promise<ProxyEntry[]> {
  try {
    const rows = await db.select().from(proxiesTable);
    return rows.map((r) => ({
      id: r.id,
      url: r.url,
      protocol: r.protocol as ProxyEntry["protocol"],
      label: r.label ?? undefined,
      addedAt: r.addedAt.toISOString(),
      lastUsedAt: r.lastUsedAt?.toISOString(),
      lastCheckedAt: r.lastCheckedAt?.toISOString(),
      successCount: r.successCount,
      failureCount: r.failureCount,
      consecutiveFails: r.consecutiveFails,
      alive: r.alive,
      latencyMs: r.latencyMs ?? undefined,
    }));
  } catch (err) {
    logger.error({ err }, "proxy-db: 从数据库加载代理失败");
    return [];
  }
}

export async function saveProxyToDb(proxy: ProxyEntry): Promise<void> {
  try {
    await db
      .insert(proxiesTable)
      .values({
        id: proxy.id,
        url: proxy.url,
        protocol: proxy.protocol,
        label: proxy.label ?? null,
        successCount: proxy.successCount,
        failureCount: proxy.failureCount,
        consecutiveFails: proxy.consecutiveFails,
        alive: proxy.alive,
        latencyMs: proxy.latencyMs ?? null,
        lastUsedAt: proxy.lastUsedAt ? new Date(proxy.lastUsedAt) : null,
        lastCheckedAt: proxy.lastCheckedAt ? new Date(proxy.lastCheckedAt) : null,
      })
      .onConflictDoUpdate({
        target: proxiesTable.id,
        set: {
          url: proxy.url,
          protocol: proxy.protocol,
          label: proxy.label ?? null,
          successCount: proxy.successCount,
          failureCount: proxy.failureCount,
          consecutiveFails: proxy.consecutiveFails,
          alive: proxy.alive,
          latencyMs: proxy.latencyMs ?? null,
          lastUsedAt: proxy.lastUsedAt ? new Date(proxy.lastUsedAt) : null,
          lastCheckedAt: proxy.lastCheckedAt ? new Date(proxy.lastCheckedAt) : null,
        },
      });
  } catch (err) {
    logger.error({ err, id: proxy.id }, "proxy-db: 保存代理失败");
  }
}

export async function deleteProxyFromDb(id: string): Promise<void> {
  try {
    await db.delete(proxiesTable).where(eq(proxiesTable.id, id));
  } catch (err) {
    logger.error({ err, id }, "proxy-db: 删除代理失败");
  }
}

export async function deleteAllProxiesFromDb(): Promise<void> {
  try {
    await db.delete(proxiesTable);
  } catch (err) {
    logger.error({ err }, "proxy-db: 清空代理池失败");
  }
}

export async function updateProxyStatsInDb(
  id: string,
  fields: Partial<{
    successCount: number;
    failureCount: number;
    consecutiveFails: number;
    alive: boolean;
    latencyMs: number | null;
    lastUsedAt: string | null;
    lastCheckedAt: string | null;
  }>
): Promise<void> {
  try {
    const update: Record<string, unknown> = {};
    if (fields.successCount !== undefined) update.successCount = fields.successCount;
    if (fields.failureCount !== undefined) update.failureCount = fields.failureCount;
    if (fields.consecutiveFails !== undefined) update.consecutiveFails = fields.consecutiveFails;
    if (fields.alive !== undefined) update.alive = fields.alive;
    if ("latencyMs" in fields) update.latencyMs = fields.latencyMs ?? null;
    if ("lastUsedAt" in fields) update.lastUsedAt = fields.lastUsedAt ? new Date(fields.lastUsedAt) : null;
    if ("lastCheckedAt" in fields) update.lastCheckedAt = fields.lastCheckedAt ? new Date(fields.lastCheckedAt) : null;

    await db.update(proxiesTable).set(update).where(eq(proxiesTable.id, id));
  } catch (err) {
    logger.error({ err, id }, "proxy-db: 更新代理状态失败");
  }
}

export async function loadSchedulerConfigFromDb(): Promise<{
  enabled: boolean;
  intervalMs: number;
  testUrl: string;
  autoClearDead: boolean;
} | null> {
  try {
    const rows = await db
      .select()
      .from(schedulerConfigTable)
      .where(eq(schedulerConfigTable.key, SCHEDULER_KEY));
    if (rows.length === 0) return null;
    const row = rows[0];
    return { enabled: row.enabled, intervalMs: row.intervalMs, testUrl: row.testUrl, autoClearDead: row.autoClearDead };
  } catch (err) {
    logger.error({ err }, "proxy-db: 加载调度器配置失败");
    return null;
  }
}

export async function saveSchedulerConfigToDb(config: {
  enabled: boolean;
  intervalMs: number;
  testUrl: string;
  autoClearDead: boolean;
}): Promise<void> {
  try {
    await db
      .insert(schedulerConfigTable)
      .values({ key: SCHEDULER_KEY, ...config })
      .onConflictDoUpdate({
        target: schedulerConfigTable.key,
        set: config,
      });
  } catch (err) {
    logger.error({ err }, "proxy-db: 保存调度器配置失败");
  }
}
