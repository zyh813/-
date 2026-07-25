import { db, alertConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { ProxyEntry } from "./proxy-pool";
import { logger } from "./logger";

export type AlertEvent = "offline" | "recovery" | "latency_spike";

export interface AlertConfig {
  webhookUrl: string | null;
  onOffline: boolean;
  onRecovery: boolean;
  latencyThresholdMs: number | null;
  cooldownMinutes: number;
}

const ALERT_KEY = "default";

let cachedConfig: AlertConfig | null = null;
// proxyId → timestamp of last alert sent
const cooldownMap = new Map<string, number>();

export async function loadAlertConfig(): Promise<AlertConfig> {
  try {
    const rows = await db
      .select()
      .from(alertConfigTable)
      .where(eq(alertConfigTable.key, ALERT_KEY));
    if (rows.length === 0) {
      cachedConfig = {
        webhookUrl: null,
        onOffline: true,
        onRecovery: true,
        latencyThresholdMs: null,
        cooldownMinutes: 30,
      };
    } else {
      const r = rows[0];
      cachedConfig = {
        webhookUrl: r.webhookUrl ?? null,
        onOffline: r.onOffline,
        onRecovery: r.onRecovery,
        latencyThresholdMs: r.latencyThresholdMs ?? null,
        cooldownMinutes: r.cooldownMinutes,
      };
    }
  } catch (err) {
    logger.error({ err }, "alert-sender: 加载报警配置失败");
    cachedConfig = {
      webhookUrl: null,
      onOffline: true,
      onRecovery: true,
      latencyThresholdMs: null,
      cooldownMinutes: 30,
    };
  }
  return cachedConfig;
}

export function invalidateAlertConfigCache(): void {
  cachedConfig = null;
}

export async function getAlertConfig(): Promise<AlertConfig> {
  if (cachedConfig) return cachedConfig;
  return loadAlertConfig();
}

export async function saveAlertConfig(config: AlertConfig): Promise<void> {
  await db
    .insert(alertConfigTable)
    .values({
      key: ALERT_KEY,
      webhookUrl: config.webhookUrl,
      onOffline: config.onOffline,
      onRecovery: config.onRecovery,
      latencyThresholdMs: config.latencyThresholdMs,
      cooldownMinutes: config.cooldownMinutes,
    })
    .onConflictDoUpdate({
      target: alertConfigTable.key,
      set: {
        webhookUrl: config.webhookUrl,
        onOffline: config.onOffline,
        onRecovery: config.onRecovery,
        latencyThresholdMs: config.latencyThresholdMs,
        cooldownMinutes: config.cooldownMinutes,
      },
    });
  cachedConfig = config;
}

function isCoolingDown(proxyId: string, cooldownMinutes: number): boolean {
  const last = cooldownMap.get(proxyId);
  if (!last) return false;
  return Date.now() - last < cooldownMinutes * 60 * 1000;
}

function formatMessage(event: AlertEvent, proxy: ProxyEntry, latencyMs?: number): string {
  const label = proxy.label ? `${proxy.label} ` : "";
  const url = proxy.url;
  switch (event) {
    case "offline":
      return `🔴 代理离线\n${label}${url}\n连续失败 ${proxy.consecutiveFails} 次`;
    case "recovery":
      return `🟢 代理恢复\n${label}${url}\n延迟 ${latencyMs}ms`;
    case "latency_spike":
      return `🟡 延迟过高\n${label}${url}\n当前延迟 ${latencyMs}ms`;
  }
}

async function sendWebhook(webhookUrl: string, text: string): Promise<void> {
  // Detect Telegram bot URL: https://api.telegram.org/bot.../sendMessage
  const isTelegram = /api\.telegram\.org\/bot[^/]+\/sendMessage/.test(webhookUrl);

  let body: string;
  let headers: Record<string, string> = { "Content-Type": "application/json" };

  if (isTelegram) {
    // Extract chat_id from query param if present; otherwise throw
    const parsed = new URL(webhookUrl);
    const chatId = parsed.searchParams.get("chat_id");
    if (!chatId) throw new Error("Telegram webhook URL 缺少 chat_id 参数");
    // Build Telegram sendMessage body, POST to URL without query params
    const baseUrl = `${parsed.origin}${parsed.pathname}`;
    body = JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" });
    const res = await fetch(baseUrl, { method: "POST", headers, body });
    if (!res.ok) throw new Error(`Telegram API 返回 ${res.status}`);
    return;
  }

  // Generic webhook: POST JSON { text, timestamp }
  body = JSON.stringify({ text, timestamp: new Date().toISOString() });
  const res = await fetch(webhookUrl, { method: "POST", headers, body });
  if (!res.ok) throw new Error(`Webhook 返回 ${res.status}`);
}

export async function triggerAlert(
  event: AlertEvent,
  proxy: ProxyEntry,
  latencyMs?: number,
): Promise<void> {
  const config = await getAlertConfig();
  if (!config.webhookUrl) return;

  if (event === "offline" && !config.onOffline) return;
  if (event === "recovery" && !config.onRecovery) return;
  if (event === "latency_spike") {
    if (!config.latencyThresholdMs) return;
    if (latencyMs === undefined || latencyMs < config.latencyThresholdMs) return;
  }

  if (isCoolingDown(proxy.id, config.cooldownMinutes)) {
    logger.info({ proxyId: proxy.id, event }, "alert-sender: 冷却中，跳过报警");
    return;
  }

  const text = formatMessage(event, proxy, latencyMs);
  try {
    await sendWebhook(config.webhookUrl, text);
    cooldownMap.set(proxy.id, Date.now());
    logger.info({ proxyId: proxy.id, event }, "alert-sender: 报警已发送");
  } catch (err) {
    logger.error({ err, proxyId: proxy.id, event }, "alert-sender: 发送报警失败");
  }
}

export async function testAlert(webhookUrl: string): Promise<{ success: boolean; message: string }> {
  try {
    await sendWebhook(webhookUrl, "✅ 代理报警测试\n这是一条测试通知，配置成功！");
    return { success: true, message: "测试通知发送成功" };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : "发送失败" };
  }
}
