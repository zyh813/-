export interface TrafficEntry {
  id: string;
  timestamp: string;
  source: "fetch-page" | "fetch-pages";
  method: "GET";
  targetUrl: string;
  finalUrl: string;
  statusCode: number | null;
  contentType: string | null;
  durationMs: number;
  responseSize: number;
  proxyUsed: string | null;
  fallbackToDirect: boolean;
  error: string | null;
  requestHeaders: Record<string, string>;
  responseBodyPreview: string | null;
}

const MAX_ENTRIES = 1000;
const entries: TrafficEntry[] = [];

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function recordTraffic(entry: Omit<TrafficEntry, "id" | "timestamp">): TrafficEntry {
  const full: TrafficEntry = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    ...entry,
  };
  entries.unshift(full);
  if (entries.length > MAX_ENTRIES) entries.splice(MAX_ENTRIES);
  return full;
}

export interface TrafficFilter {
  url?: string;
  status?: string;
  source?: string;
  limit?: number;
  offset?: number;
}

export function listTraffic(filter: TrafficFilter = {}): { total: number; entries: TrafficEntry[] } {
  let result = entries;

  if (filter.url) {
    const q = filter.url.toLowerCase();
    result = result.filter((e) => e.targetUrl.toLowerCase().includes(q));
  }
  if (filter.status) {
    const s = Number(filter.status);
    if (!isNaN(s)) result = result.filter((e) => e.statusCode === s);
    else if (filter.status === "error") result = result.filter((e) => e.error !== null);
    else if (filter.status === "2xx") result = result.filter((e) => e.statusCode != null && e.statusCode >= 200 && e.statusCode < 300);
    else if (filter.status === "3xx") result = result.filter((e) => e.statusCode != null && e.statusCode >= 300 && e.statusCode < 400);
    else if (filter.status === "4xx") result = result.filter((e) => e.statusCode != null && e.statusCode >= 400 && e.statusCode < 500);
    else if (filter.status === "5xx") result = result.filter((e) => e.statusCode != null && e.statusCode >= 500);
  }
  if (filter.source) {
    result = result.filter((e) => e.source === filter.source);
  }

  const total = result.length;
  const offset = filter.offset ?? 0;
  const limit = Math.min(filter.limit ?? 100, 200);
  return { total, entries: result.slice(offset, offset + limit) };
}

export function getTrafficEntry(id: string): TrafficEntry | undefined {
  return entries.find((e) => e.id === id);
}

export function clearTraffic(): void {
  entries.splice(0);
}

export function trafficStats(): { total: number; errors: number; avgDurationMs: number } {
  const total = entries.length;
  const errors = entries.filter((e) => e.error !== null).length;
  const avg = total > 0 ? Math.round(entries.reduce((s, e) => s + e.durationMs, 0) / total) : 0;
  return { total, errors, avgDurationMs: avg };
}
