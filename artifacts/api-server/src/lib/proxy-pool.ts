import {
  saveProxyToDb,
  deleteProxyFromDb,
  deleteAllProxiesFromDb,
  updateProxyStatsInDb,
} from "./proxy-db";

export interface ProxyEntry {
  id: string;
  url: string;
  protocol: "http" | "https" | "socks5";
  label?: string;
  group?: string;
  addedAt: string;
  lastUsedAt?: string;
  lastCheckedAt?: string;
  successCount: number;
  failureCount: number;
  consecutiveFails: number;
  alive: boolean;
  latencyMs?: number;
}

interface ProxyPool {
  proxies: Map<string, ProxyEntry>;
  roundRobinIndex: number;
}

const MAX_CONSECUTIVE_FAILS = 3;
const MAX_LATENCY_HISTORY = 50;

export interface LatencyPoint {
  timestamp: string;
  latencyMs: number;
}

const pool: ProxyPool = {
  proxies: new Map(),
  roundRobinIndex: 0,
};

const latencyHistory: Map<string, LatencyPoint[]> = new Map();

function pushLatencyHistory(id: string, latencyMs: number): void {
  const list = latencyHistory.get(id) ?? [];
  list.push({ timestamp: new Date().toISOString(), latencyMs });
  if (list.length > MAX_LATENCY_HISTORY) list.shift();
  latencyHistory.set(id, list);
}

export function getLatencyHistory(id: string): LatencyPoint[] {
  return latencyHistory.get(id) ?? [];
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function loadProxyIntoMemory(entry: ProxyEntry): void {
  pool.proxies.set(entry.id, entry);
}

export function addProxy(
  rawUrl: string,
  label?: string,
  group?: string,
): ProxyEntry | { error: string } {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { error: "无效的代理 URL 格式" };
  }

  const protocol = parsed.protocol.replace(":", "") as ProxyEntry["protocol"];
  if (!["http", "https", "socks5"].includes(protocol)) {
    return { error: "仅支持 http / https / socks5 协议" };
  }

  for (const entry of pool.proxies.values()) {
    if (entry.url === rawUrl) {
      return { error: "该代理已存在" };
    }
  }

  const id = generateId();
  const entry: ProxyEntry = {
    id,
    url: rawUrl,
    protocol,
    label,
    group,
    addedAt: new Date().toISOString(),
    successCount: 0,
    failureCount: 0,
    consecutiveFails: 0,
    alive: true,
  };

  pool.proxies.set(id, entry);
  saveProxyToDb(entry).catch(() => {});
  return entry;
}

export function removeProxy(id: string): boolean {
  const deleted = pool.proxies.delete(id);
  if (deleted) {
    deleteProxyFromDb(id).catch(() => {});
    latencyHistory.delete(id);
  }
  return deleted;
}

export function listProxies(): ProxyEntry[] {
  return Array.from(pool.proxies.values());
}

export function getProxy(id: string): ProxyEntry | undefined {
  return pool.proxies.get(id);
}

export function clearProxies(): void {
  pool.proxies.clear();
  pool.roundRobinIndex = 0;
  latencyHistory.clear();
  deleteAllProxiesFromDb().catch(() => {});
}

export function removeDeadProxies(): { removed: number; ids: string[] } {
  const deadIds: string[] = [];
  for (const [id, entry] of pool.proxies.entries()) {
    if (!entry.alive) {
      pool.proxies.delete(id);
      deadIds.push(id);
      deleteProxyFromDb(id).catch(() => {});
      latencyHistory.delete(id);
    }
  }
  return { removed: deadIds.length, ids: deadIds };
}

export function recordSuccess(id: string, latencyMs: number): void {
  const entry = pool.proxies.get(id);
  if (!entry) return;
  entry.successCount++;
  entry.consecutiveFails = 0;
  entry.alive = true;
  entry.latencyMs = latencyMs;
  entry.lastUsedAt = new Date().toISOString();
  pushLatencyHistory(id, latencyMs);
  updateProxyStatsInDb(id, {
    successCount: entry.successCount,
    consecutiveFails: 0,
    alive: true,
    latencyMs,
    lastUsedAt: entry.lastUsedAt,
  }).catch(() => {});
}

export function recordFailure(id: string): void {
  const entry = pool.proxies.get(id);
  if (!entry) return;
  entry.failureCount++;
  entry.consecutiveFails++;
  entry.lastUsedAt = new Date().toISOString();
  if (entry.consecutiveFails >= MAX_CONSECUTIVE_FAILS) {
    entry.alive = false;
  }
  updateProxyStatsInDb(id, {
    failureCount: entry.failureCount,
    consecutiveFails: entry.consecutiveFails,
    alive: entry.alive,
    lastUsedAt: entry.lastUsedAt,
  }).catch(() => {});
}

export function markAlive(id: string, latencyMs: number): void {
  const entry = pool.proxies.get(id);
  if (!entry) return;
  entry.alive = true;
  entry.consecutiveFails = 0;
  entry.latencyMs = latencyMs;
  entry.lastCheckedAt = new Date().toISOString();
  pushLatencyHistory(id, latencyMs);
  updateProxyStatsInDb(id, {
    alive: true,
    consecutiveFails: 0,
    latencyMs,
    lastCheckedAt: entry.lastCheckedAt,
  }).catch(() => {});
}

export function markDead(id: string): void {
  const entry = pool.proxies.get(id);
  if (!entry) return;
  entry.alive = false;
  entry.lastCheckedAt = new Date().toISOString();
  updateProxyStatsInDb(id, {
    alive: false,
    lastCheckedAt: entry.lastCheckedAt,
  }).catch(() => {});
}

export function pickProxy(
  strategy: "random" | "roundrobin" = "roundrobin",
  excludeIds: Set<string> = new Set(),
): ProxyEntry | null {
  const alive = Array.from(pool.proxies.values()).filter(
    (p) => p.alive && !excludeIds.has(p.id),
  );
  if (alive.length === 0) return null;

  if (strategy === "random") {
    return alive[Math.floor(Math.random() * alive.length)];
  }

  const index = pool.roundRobinIndex % alive.length;
  pool.roundRobinIndex = (pool.roundRobinIndex + 1) % alive.length;
  return alive[index];
}

export function aliveProxyCount(): number {
  return Array.from(pool.proxies.values()).filter((p) => p.alive).length;
}

export function poolStats() {
  const all = Array.from(pool.proxies.values());
  const alive = all.filter((p) => p.alive);
  const dead = all.filter((p) => !p.alive);
  return {
    total: all.length,
    alive: alive.length,
    dead: dead.length,
  };
}
