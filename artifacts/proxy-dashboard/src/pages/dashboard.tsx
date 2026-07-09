import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListProxies,
  useAddProxies,
  useDeleteProxy,
  useClearProxies,
  useClearDeadProxies,
  useCheckAllProxies,
  useCheckProxy,
  useGetSchedulerStatus,
  useStartScheduler,
  useStopScheduler,
  useRunSchedulerNow,
  useListTraffic,
  useClearTraffic,
  getListTrafficQueryKey,
  getListProxiesQueryKey,
  getGetSchedulerStatusQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Activity,
  Plus,
  Trash2,
  RefreshCw,
  Play,
  Square,
  Zap,
  Wifi,
  WifiOff,
  Clock,
  Server,
  ChevronDown,
  ChevronUp,
  Globe,
  Search,
  CheckCircle,
  XCircle,
  Link,
  FileDown,
  Copy,
  Check,
  Upload,
  ArrowUpDown,
  Star,
  Tag,
  Radio,
  Filter,
} from "lucide-react";

function StatCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ProxyRow({ proxy, onDelete, onCheck, isPreferred, onSetPreferred }: {
  proxy: {
    id: string;
    url: string;
    protocol: string;
    label?: string | null;
    group?: string | null;
    alive: boolean;
    latencyMs?: number | null;
    successCount: number;
    failureCount: number;
    consecutiveFails: number;
    lastCheckedAt?: string | null;
  };
  onDelete: (id: string) => void;
  onCheck: (id: string) => void;
  isPreferred: boolean;
  onSetPreferred: (id: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`border rounded-lg mb-2 overflow-hidden ${isPreferred ? "border-yellow-400 ring-1 ring-yellow-300" : ""}`}>
      <div
        className="flex items-center gap-2 p-3 cursor-pointer hover:bg-muted/50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-shrink-0">
          {isPreferred ? (
            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
          ) : proxy.alive ? (
            <Wifi className="w-4 h-4 text-green-500" />
          ) : (
            <WifiOff className="w-4 h-4 text-red-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium truncate">{proxy.url}</p>
            {isPreferred && (
              <span className="text-xs text-yellow-600 font-medium flex-shrink-0">首选</span>
            )}
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {proxy.group && (
              <span className="inline-flex items-center gap-0.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded px-1.5 py-0 leading-5">
                <Tag className="w-2.5 h-2.5" />{proxy.group}
              </span>
            )}
            {proxy.label && (
              <span className="text-xs text-muted-foreground truncate">{proxy.label}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge variant={proxy.alive ? "default" : "destructive"} className="text-xs">
            {proxy.alive ? "存活" : "死亡"}
          </Badge>
          {proxy.latencyMs != null && (
            <span className="text-xs text-muted-foreground">{proxy.latencyMs}ms</span>
          )}
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>
      {expanded && (
        <div className="border-t px-3 pb-3 pt-2 bg-muted/20">
          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
            <div>
              <span className="text-muted-foreground">协议：</span>
              <span className="font-medium uppercase">{proxy.protocol}</span>
            </div>
            <div>
              <span className="text-muted-foreground">成功/失败：</span>
              <span className="font-medium text-green-600">{proxy.successCount}</span>
              <span className="text-muted-foreground"> / </span>
              <span className="font-medium text-red-500">{proxy.failureCount}</span>
            </div>
            <div>
              <span className="text-muted-foreground">连续失败：</span>
              <span className={`font-medium ${proxy.consecutiveFails > 0 ? "text-orange-500" : "text-green-600"}`}>
                {proxy.consecutiveFails}
              </span>
            </div>
            {proxy.lastCheckedAt && (
              <div>
                <span className="text-muted-foreground">最后检测：</span>
                <span className="font-medium">{new Date(proxy.lastCheckedAt).toLocaleTimeString()}</span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={isPreferred ? "default" : "outline"}
              className={`flex-1 h-8 text-xs ${isPreferred ? "bg-yellow-400 hover:bg-yellow-500 text-yellow-950 border-yellow-400" : ""}`}
              onClick={(e) => { e.stopPropagation(); onSetPreferred(isPreferred ? null : proxy.id); }}
            >
              <Star className={`w-3 h-3 mr-1 ${isPreferred ? "fill-yellow-950" : ""}`} />
              {isPreferred ? "取消首选" : "设为首选"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 text-xs"
              onClick={(e) => { e.stopPropagation(); onCheck(proxy.id); }}
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              检测
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 text-xs text-destructive hover:text-destructive"
              onClick={(e) => { e.stopPropagation(); onDelete(proxy.id); }}
            >
              <Trash2 className="w-3 h-3 mr-1" />
              删除
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

type FetchResult = {
  url: string;
  finalUrl: string;
  statusCode: number;
  contentType: string;
  proxyUsed: string | null;
  retriedProxies: string[];
  fallbackToDirect: boolean;
  preferredProxyUsed: boolean;
  parsed: {
    title: string | null;
    metaDescription: string | null;
    headings: { level: string; text: string }[];
    links: { text: string; href: string }[];
    bodyText: string;
  };
};

type HistoryItem = {
  id: string;
  timestamp: number;
  url: string;
  statusCode: number;
  durationMs: number;
  proxyUsed: string | null;
  title: string | null;
  ok: boolean;
  error?: string;
};

const HISTORY_KEY = "proxy-dashboard:fetch-history";
const MAX_HISTORY = 10;

function loadHistory(): HistoryItem[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveHistory(items: HistoryItem[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY)));
}

function pushHistory(item: HistoryItem) {
  const prev = loadHistory().filter((h) => h.id !== item.id);
  saveHistory([item, ...prev]);
}

function FetchResultView({ result, durationMs }: { result: FetchResult; durationMs: number }) {
  const [showBody, setShowBody] = useState(false);
  const [showLinks, setShowLinks] = useState(false);

  const isOk = result.statusCode >= 200 && result.statusCode < 300;

  return (
    <div className="space-y-3 mt-4">
      <div className={`rounded-lg border p-3 ${isOk ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
        <div className="flex items-center gap-2 mb-2">
          {isOk ? (
            <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          )}
          <span className={`font-semibold text-sm ${isOk ? "text-green-700" : "text-red-600"}`}>
            HTTP {result.statusCode}
          </span>
          <span className="text-xs text-muted-foreground flex items-center gap-0.5">
            <Clock className="w-3 h-3" />{durationMs}ms
          </span>
          <div className="ml-auto flex items-center gap-1">
            {result.preferredProxyUsed && (
              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400 flex-shrink-0" />
            )}
            {result.proxyUsed ? (
              <Badge variant="outline" className="text-xs truncate max-w-[120px]">
                {result.proxyUsed}
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">直连</Badge>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground truncate">{result.finalUrl}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{result.contentType}</p>
        {result.preferredProxyUsed && (
          <p className="text-xs text-yellow-600 mt-1 flex items-center gap-1">
            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />已使用首选代理
          </p>
        )}
        {result.fallbackToDirect && (
          <p className="text-xs text-orange-500 mt-1 flex items-center gap-1">
            <WifiOff className="w-3 h-3" />代理全部失败，已自动回退直连
          </p>
        )}
        {result.retriedProxies && result.retriedProxies.length > 0 && (
          <p className="text-xs text-muted-foreground mt-0.5">
            换用代理 {result.retriedProxies.length} 次
          </p>
        )}
      </div>

      {result.parsed.title && (
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground mb-1">页面标题</p>
          <p className="text-sm font-medium">{result.parsed.title}</p>
        </div>
      )}

      {result.parsed.metaDescription && (
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground mb-1">页面描述</p>
          <p className="text-sm text-muted-foreground leading-relaxed">{result.parsed.metaDescription}</p>
        </div>
      )}

      {result.parsed.headings.length > 0 && (
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground mb-2">标题结构（{result.parsed.headings.length} 个）</p>
          <div className="space-y-1">
            {result.parsed.headings.slice(0, 8).map((h, i) => (
              <div key={i} className="flex items-start gap-2">
                <Badge variant="outline" className="text-xs flex-shrink-0 font-mono uppercase">{h.level}</Badge>
                <p className="text-xs leading-5 line-clamp-1">{h.text}</p>
              </div>
            ))}
            {result.parsed.headings.length > 8 && (
              <p className="text-xs text-muted-foreground">…还有 {result.parsed.headings.length - 8} 个</p>
            )}
          </div>
        </div>
      )}

      {result.parsed.bodyText && (
        <div className="rounded-lg border overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/50 text-left"
            onClick={() => setShowBody(!showBody)}
          >
            <span className="text-xs text-muted-foreground">正文摘要</span>
            {showBody ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {showBody && (
            <div className="border-t px-3 py-2">
              <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
                {result.parsed.bodyText.slice(0, 800)}
                {result.parsed.bodyText.length > 800 && "…"}
              </p>
            </div>
          )}
        </div>
      )}

      {result.parsed.links.length > 0 && (
        <div className="rounded-lg border overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/50 text-left"
            onClick={() => setShowLinks(!showLinks)}
          >
            <span className="text-xs text-muted-foreground">
              <Link className="w-3 h-3 inline mr-1" />
              链接（{result.parsed.links.length} 个）
            </span>
            {showLinks ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {showLinks && (
            <div className="border-t divide-y max-h-52 overflow-y-auto">
              {result.parsed.links.slice(0, 30).map((link, i) => (
                <div key={i} className="px-3 py-1.5">
                  <p className="text-xs font-medium line-clamp-1">{link.text}</p>
                  <p className="text-xs text-muted-foreground truncate">{link.href}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [addMode, setAddMode] = useState<"single" | "batch">("single");
  const [singleUrl, setSingleUrl] = useState("");
  const [singleLabel, setSingleLabel] = useState("");
  const [batchText, setBatchText] = useState("");
  const [showExport, setShowExport] = useState(false);
  const [copyDone, setCopyDone] = useState(false);
  const [sortByLatency, setSortByLatency] = useState(false);
  const [preferredProxyId, setPreferredProxyId] = useState<string | null>(
    () => localStorage.getItem("preferredProxyId")
  );
  const [intervalMinutes, setIntervalMinutes] = useState("5");
  const [testUrl, setTestUrl] = useState("https://www.google.com");
  const [autoClearDead, setAutoClearDead] = useState(false);
  const [singleGroup, setSingleGroup] = useState("");
  const [batchGroup, setBatchGroup] = useState("");
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [trafficUrlFilter, setTrafficUrlFilter] = useState("");
  const [trafficStatusFilter, setTrafficStatusFilter] = useState("");
  const [selectedTrafficId, setSelectedTrafficId] = useState<string | null>(null);
  const [trafficPage, setTrafficPage] = useState(0);
  const [activeTab, setActiveTab] = useState("proxies");

  const handleSetPreferred = (id: string | null) => {
    setPreferredProxyId(id);
    if (id) localStorage.setItem("preferredProxyId", id);
    else localStorage.removeItem("preferredProxyId");
  };

  const [fetchUrl, setFetchUrl] = useState("");
  const [useProxy, setUseProxy] = useState(false);
  const [strategy, setStrategy] = useState<"roundrobin" | "random">("roundrobin");
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchResult, setFetchResult] = useState<FetchResult | null>(null);
  const [fetchDurationMs, setFetchDurationMs] = useState(0);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>(loadHistory);

  const { data: proxiesData, isLoading: proxiesLoading, refetch: refetchProxies } = useListProxies();
  const { data: schedulerData, refetch: refetchScheduler } = useGetSchedulerStatus();

  // 从服务端同步 autoClearDead 状态（仅首次加载时）
  const [autoClearDeadSynced, setAutoClearDeadSynced] = useState(false);
  if (schedulerData && !autoClearDeadSynced) {
    setAutoClearDead(schedulerData.autoClearDead ?? false);
    setAutoClearDeadSynced(true);
  }

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListProxiesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetSchedulerStatusQueryKey() });
  };

  const addProxiesMutation = useAddProxies({
    mutation: {
      onSuccess: () => {
        toast({ title: "添加成功", description: "代理已加入池中" });
        setSingleUrl("");
        setSingleLabel("");
        setBatchText("");
        invalidate();
      },
      onError: () => toast({ title: "添加失败", variant: "destructive" }),
    },
  });

  const clearDeadMutation = useClearDeadProxies({
    mutation: {
      onSuccess: (data) => {
        toast({ title: `已清除 ${data.removed} 个失效代理` });
        invalidate();
      },
      onError: () => toast({ title: "清除失败", variant: "destructive" }),
    },
  });

  const deleteProxyMutation = useDeleteProxy({
    mutation: {
      onSuccess: () => {
        toast({ title: "删除成功" });
        invalidate();
      },
      onError: () => toast({ title: "删除失败", variant: "destructive" }),
    },
  });

  const clearProxiesMutation = useClearProxies({
    mutation: {
      onSuccess: () => {
        toast({ title: "已清空全部代理" });
        invalidate();
      },
    },
  });

  const checkAllMutation = useCheckAllProxies({
    mutation: {
      onSuccess: (data) => {
        toast({
          title: "检测完成",
          description: `存活 ${data.stats.alive} / 共 ${data.total}`,
        });
        invalidate();
        if (data.stats.alive > 0) setSortByLatency(true);
      },
    },
  });

  const checkOneMutation = useCheckProxy({
    mutation: {
      onSuccess: (data) => {
        toast({
          title: data.alive ? "代理存活" : "代理失效",
          description: data.latencyMs != null ? `延迟 ${data.latencyMs}ms` : undefined,
          variant: data.alive ? "default" : "destructive",
        });
        invalidate();
      },
    },
  });

  const startSchedulerMutation = useStartScheduler({
    mutation: {
      onSuccess: () => {
        toast({ title: "定时任务已启动" });
        refetchScheduler();
      },
    },
  });

  const stopSchedulerMutation = useStopScheduler({
    mutation: {
      onSuccess: () => {
        toast({ title: "定时任务已停止" });
        refetchScheduler();
      },
    },
  });

  const runNowMutation = useRunSchedulerNow({
    mutation: {
      onSuccess: () => {
        toast({ title: "手动检测已触发" });
        setTimeout(invalidate, 2000);
      },
    },
  });

  const handleAddSingle = () => {
    if (!singleUrl.trim()) return;
    addProxiesMutation.mutate({ data: { url: singleUrl.trim(), label: singleLabel.trim() || undefined, group: singleGroup.trim() || undefined } });
  };

  const handleAddBatch = () => {
    const lines = batchText.trim().split("\n").filter(Boolean);
    const urls = lines.map((line) => {
      const parts = line.split(/\s+/);
      return { url: parts[0], label: parts[1] || undefined, group: batchGroup.trim() || undefined };
    });
    if (urls.length === 0) return;
    addProxiesMutation.mutate({ data: { urls } });
  };

  const handleFetch = async (overrideUrl?: string) => {
    const url = (overrideUrl ?? fetchUrl).trim();
    if (!url) return;
    setFetchLoading(true);
    setFetchResult(null);
    setFetchError(null);
    setFetchDurationMs(0);
    const t0 = performance.now();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    try {
      const params = new URLSearchParams({ url });
      if (useProxy) {
        params.set("proxy", "true");
        params.set("strategy", strategy);
        if (preferredProxyId) params.set("proxyId", preferredProxyId);
      }
      const res = await fetch(`/api/fetch-page?${params.toString()}`);
      const durationMs = Math.round(performance.now() - t0);
      const data = await res.json();
      if (!res.ok) {
        const errMsg = data.error ?? `请求失败 (${res.status})`;
        setFetchError(errMsg);
        const item: HistoryItem = {
          id, timestamp: Date.now(), url, statusCode: res.status,
          durationMs, proxyUsed: null, title: null, ok: false, error: errMsg,
        };
        pushHistory(item);
        setHistory(loadHistory());
      } else {
        const result = data as FetchResult;
        setFetchResult(result);
        setFetchDurationMs(durationMs);
        const item: HistoryItem = {
          id, timestamp: Date.now(), url,
          statusCode: result.statusCode, durationMs,
          proxyUsed: result.proxyUsed, title: result.parsed.title, ok: true,
        };
        pushHistory(item);
        setHistory(loadHistory());
      }
    } catch (e) {
      const durationMs = Math.round(performance.now() - t0);
      const errMsg = e instanceof Error ? e.message : "网络错误";
      setFetchError(errMsg);
      const item: HistoryItem = {
        id, timestamp: Date.now(), url, statusCode: 0,
        durationMs, proxyUsed: null, title: null, ok: false, error: errMsg,
      };
      pushHistory(item);
      setHistory(loadHistory());
    } finally {
      setFetchLoading(false);
    }
  };

  const trafficParams = { url: trafficUrlFilter || undefined, status: trafficStatusFilter || undefined, limit: 100, offset: trafficPage * 100 };
  const { data: trafficData, refetch: refetchTraffic } = useListTraffic(
    trafficParams,
    { query: { refetchInterval: 3000, queryKey: getListTrafficQueryKey(trafficParams) } }
  );

  const clearTrafficMutation = useClearTraffic({
    mutation: {
      onSuccess: () => { toast({ title: "流量记录已清空" }); refetchTraffic(); setSelectedTrafficId(null); },
    },
  });

  const proxies = proxiesData?.proxies ?? [];
  const stats = proxiesData?.stats;
  const scheduler = schedulerData;

  const allGroups = Array.from(new Set(proxies.map((p) => p.group).filter(Boolean) as string[]));
  const filteredProxies = groupFilter ? proxies.filter((p) => p.group === groupFilter) : proxies;

  const aliveRaw = proxies.filter((p) => p.alive);
  const aliveProxies = (() => {
    let list = sortByLatency
      ? [...filteredProxies.filter(p => p.alive)].sort((a, b) => {
          const la = a.latencyMs ?? Infinity;
          const lb = b.latencyMs ?? Infinity;
          return la - lb;
        })
      : [...filteredProxies.filter(p => p.alive)];
    // 首选代理始终置顶
    if (preferredProxyId) {
      const idx = list.findIndex((p) => p.id === preferredProxyId);
      if (idx > 0) {
        const [preferred] = list.splice(idx, 1);
        list.unshift(preferred);
      }
    }
    return list;
  })();
  const deadProxies = filteredProxies.filter((p) => !p.alive);

  const preferredProxy = preferredProxyId ? proxies.find((p) => p.id === preferredProxyId) : null;

  const exportText = proxies
    .map((p) => (p.label ? `${p.url} ${p.label}` : p.url))
    .join("\n");

  const handleCopyExport = async () => {
    try {
      await navigator.clipboard.writeText(exportText);
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 2000);
      toast({ title: `已复制 ${proxies.length} 个代理` });
    } catch {
      toast({ title: "复制失败，请手动选择文本", variant: "destructive" });
    }
  };

  const handleDownloadExport = () => {
    const blob = new Blob([exportText], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `proxies-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleImportFromExport = (text: string) => {
    setBatchText(text);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 pb-10">
        <div className="sticky top-0 bg-background pt-4 pb-3 z-10 border-b mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              <h1 className="text-lg font-bold">代理管理面板</h1>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { refetchProxies(); refetchScheduler(); }}
              className="h-8 w-8"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <StatCard title="总计" value={stats?.total ?? 0} icon={Server} color="bg-blue-500" />
          <StatCard title="存活" value={stats?.alive ?? 0} icon={Wifi} color="bg-green-500" />
          <StatCard title="失效" value={stats?.dead ?? 0} icon={WifiOff} color="bg-red-400" />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full mb-4 grid grid-cols-5">
            <TabsTrigger value="proxies" className="text-xs">代理池</TabsTrigger>
            <TabsTrigger value="add" className="text-xs">添加</TabsTrigger>
            <TabsTrigger value="fetch" className="text-xs">抓取</TabsTrigger>
            <TabsTrigger value="traffic" className="text-xs">抓包</TabsTrigger>
            <TabsTrigger value="scheduler" className="text-xs">定时</TabsTrigger>
          </TabsList>

          <TabsContent value="proxies" className="space-y-3">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-9"
                onClick={() => checkAllMutation.mutate({ data: { testUrl } })}
                disabled={checkAllMutation.isPending || proxies.length === 0}
              >
                <Activity className="w-4 h-4 mr-1" />
                {checkAllMutation.isPending ? "检测中…" : "检测全部"}
              </Button>
              <Button
                variant={sortByLatency ? "default" : "outline"}
                size="sm"
                className="h-9"
                disabled={aliveRaw.length === 0}
                onClick={() => setSortByLatency((v) => !v)}
                title={sortByLatency ? "取消延迟排序" : "按延迟从低到高排序"}
              >
                <ArrowUpDown className="w-4 h-4 mr-1" />
                延迟
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                disabled={proxies.length === 0}
                onClick={() => setShowExport((v) => !v)}
              >
                <FileDown className="w-4 h-4 mr-1" />
                导出
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 text-orange-500 hover:text-orange-600 border-orange-200 hover:border-orange-300"
                    disabled={deadProxies.length === 0 || clearDeadMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    清失效
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>清除所有失效代理？</AlertDialogTitle>
                    <AlertDialogDescription>
                      将删除 {deadProxies.length} 个失效代理，存活代理（{aliveRaw.length} 个）不受影响。此操作不可撤销。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction onClick={() => clearDeadMutation.mutate()}>确认清除</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 text-destructive hover:text-destructive" disabled={proxies.length === 0}>
                    <Trash2 className="w-4 h-4 mr-1" />
                    清空
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>确认清空？</AlertDialogTitle>
                    <AlertDialogDescription>将删除所有 {proxies.length} 个代理，此操作不可撤销。</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction onClick={() => clearProxiesMutation.mutate()}>确认清空</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {showExport && (
              <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">
                    导出列表（共 {proxies.length} 个代理）
                  </p>
                  <div className="flex gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={handleDownloadExport}
                    >
                      <FileDown className="w-3 h-3 mr-1" />
                      下载
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={handleCopyExport}
                    >
                      {copyDone ? (
                        <><Check className="w-3 h-3 mr-1 text-green-500" /><span className="text-green-500">已复制</span></>
                      ) : (
                        <><Copy className="w-3 h-3 mr-1" />复制全部</>
                      )}
                    </Button>
                  </div>
                </div>
                <textarea
                  readOnly
                  value={exportText}
                  className="w-full h-32 rounded-md border border-input bg-background px-3 py-2 text-xs font-mono resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                />
                <p className="text-xs text-muted-foreground">
                  格式：<code className="bg-muted px-1 rounded">url 备注</code>，可直接粘贴到「添加→批量添加」导入
                </p>
              </div>
            )}

            {allGroups.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <Filter className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <button
                  onClick={() => setGroupFilter(null)}
                  className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${groupFilter === null ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                >
                  全部
                </button>
                {allGroups.map((g) => (
                  <button
                    key={g}
                    onClick={() => setGroupFilter(groupFilter === g ? null : g)}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-colors flex items-center gap-0.5 ${groupFilter === g ? "bg-blue-600 text-white border-blue-600" : "border-border hover:bg-muted"}`}
                  >
                    <Tag className="w-2.5 h-2.5" />{g}
                  </button>
                ))}
              </div>
            )}

            {proxiesLoading ? (
              <div className="text-center py-10 text-muted-foreground text-sm">加载中…</div>
            ) : proxies.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Server className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">暂无代理，请先添加</p>
              </div>
            ) : (
              <div>
                {aliveProxies.length > 0 && (
                  <div className="mb-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      <p className="text-xs font-medium text-green-600">存活 ({aliveProxies.length})</p>
                      {sortByLatency && (
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                          <ArrowUpDown className="w-3 h-3" />按延迟排序
                        </span>
                      )}
                    </div>
                    {aliveProxies.map((p) => (
                      <ProxyRow
                        key={p.id}
                        proxy={p}
                        onDelete={(id) => deleteProxyMutation.mutate({ id })}
                        onCheck={(id) => checkOneMutation.mutate({ id, data: { testUrl } })}
                        isPreferred={p.id === preferredProxyId}
                        onSetPreferred={handleSetPreferred}
                      />
                    ))}
                  </div>
                )}
                {deadProxies.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-red-500 mb-1">失效 ({deadProxies.length})</p>
                    {deadProxies.map((p) => (
                      <ProxyRow
                        key={p.id}
                        proxy={p}
                        onDelete={(id) => deleteProxyMutation.mutate({ id })}
                        onCheck={(id) => checkOneMutation.mutate({ id, data: { testUrl } })}
                        isPreferred={p.id === preferredProxyId}
                        onSetPreferred={handleSetPreferred}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="add" className="space-y-4">
            <div className="mb-2">
              <label className="text-xs text-muted-foreground mb-1 block">健康检测目标 URL</label>
              <Input
                value={testUrl}
                onChange={(e) => setTestUrl(e.target.value)}
                placeholder="https://www.google.com"
                className="h-9 text-sm"
              />
            </div>

            <div className="flex rounded-lg border overflow-hidden">
              <button
                className={`flex-1 py-2 text-sm font-medium transition-colors ${addMode === "single" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                onClick={() => setAddMode("single")}
              >
                单个添加
              </button>
              <button
                className={`flex-1 py-2 text-sm font-medium transition-colors ${addMode === "batch" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                onClick={() => setAddMode("batch")}
              >
                批量添加
              </button>
            </div>

            {addMode === "single" ? (
              <div className="space-y-2">
                <Input
                  value={singleUrl}
                  onChange={(e) => setSingleUrl(e.target.value)}
                  placeholder="http://host:port 或 socks5://host:port"
                  className="h-9 text-sm"
                />
                <Input
                  value={singleLabel}
                  onChange={(e) => setSingleLabel(e.target.value)}
                  placeholder="备注（可选）"
                  className="h-9 text-sm"
                />
                <Input
                  value={singleGroup}
                  onChange={(e) => setSingleGroup(e.target.value)}
                  placeholder="分组（可选，如：机场A、国内）"
                  className="h-9 text-sm"
                />
                <Button
                  className="w-full h-9"
                  onClick={handleAddSingle}
                  disabled={!singleUrl.trim() || addProxiesMutation.isPending}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  {addProxiesMutation.isPending ? "添加中…" : "添加代理"}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">每行一个代理：<code className="bg-muted px-1 rounded">url 备注</code></p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={async () => {
                      try {
                        const text = await navigator.clipboard.readText();
                        if (text.trim()) {
                          handleImportFromExport(text.trim());
                          toast({ title: "已从剪贴板导入" });
                        }
                      } catch {
                        toast({ title: "无法读取剪贴板，请手动粘贴", variant: "destructive" });
                      }
                    }}
                  >
                    <Upload className="w-3 h-3 mr-1" />
                    从剪贴板导入
                  </Button>
                </div>
                <textarea
                  value={batchText}
                  onChange={(e) => setBatchText(e.target.value)}
                  placeholder={"http://host:port 节点A\nsocks5://host:port 节点B\nhttp://host:port"}
                  className="w-full h-40 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    共 {batchText.trim().split("\n").filter(Boolean).length} 行
                  </p>
                  {batchText.trim() && (
                    <button
                      className="text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => setBatchText("")}
                    >
                      清空
                    </button>
                  )}
                </div>
                <Input
                  value={batchGroup}
                  onChange={(e) => setBatchGroup(e.target.value)}
                  placeholder="批量分组（可选，统一设置分组）"
                  className="h-9 text-sm"
                />
                <Button
                  className="w-full h-9"
                  onClick={handleAddBatch}
                  disabled={!batchText.trim() || addProxiesMutation.isPending}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  {addProxiesMutation.isPending ? "添加中…" : "批量添加"}
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="fetch" className="space-y-3">
            <div className="space-y-2">
              <Input
                value={fetchUrl}
                onChange={(e) => setFetchUrl(e.target.value)}
                placeholder="https://example.com"
                className="h-9 text-sm"
                onKeyDown={(e) => e.key === "Enter" && handleFetch()}
              />

              <div className="flex items-center gap-3 rounded-lg border p-3">
                <div className="flex items-center gap-2 flex-1">
                  <button
                    onClick={() => setUseProxy(!useProxy)}
                    className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${useProxy ? "bg-primary" : "bg-muted-foreground/30"}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${useProxy ? "left-4" : "left-0.5"}`} />
                  </button>
                  <span className="text-sm">启用代理</span>
                </div>
                {useProxy && (
                  <div className="flex rounded-md border overflow-hidden text-xs">
                    <button
                      className={`px-2 py-1 ${strategy === "roundrobin" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                      onClick={() => setStrategy("roundrobin")}
                    >
                      轮询
                    </button>
                    <button
                      className={`px-2 py-1 ${strategy === "random" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                      onClick={() => setStrategy("random")}
                    >
                      随机
                    </button>
                  </div>
                )}
              </div>

              {useProxy && aliveProxies.length === 0 && (
                <p className="text-xs text-orange-500 flex items-center gap-1">
                  <XCircle className="w-3 h-3" />
                  当前无存活代理，请先添加并检测
                </p>
              )}

              {useProxy && preferredProxy && (
                <div className="flex items-center gap-2 rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2">
                  <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-yellow-800">将优先使用首选代理</p>
                    <p className="text-xs text-yellow-600 truncate">{preferredProxy.url}</p>
                  </div>
                  <button
                    className="text-xs text-yellow-600 hover:text-yellow-800 flex-shrink-0"
                    onClick={() => handleSetPreferred(null)}
                  >
                    取消
                  </button>
                </div>
              )}

              <Button
                className="w-full h-9"
                onClick={() => handleFetch()}
                disabled={!fetchUrl.trim() || fetchLoading || (useProxy && aliveProxies.length === 0)}
              >
                <Search className="w-4 h-4 mr-1" />
                {fetchLoading ? "抓取中…" : "开始抓取"}
              </Button>
            </div>

            {fetchLoading && (
              <div className="text-center py-8 text-muted-foreground">
                <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin" />
                <p className="text-sm">正在抓取页面…</p>
              </div>
            )}

            {fetchError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-start gap-2">
                <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-700">抓取失败</p>
                  <p className="text-xs text-red-600 mt-0.5">{fetchError}</p>
                </div>
              </div>
            )}

            {fetchResult && <FetchResultView result={fetchResult} durationMs={fetchDurationMs} />}

            {history.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground">历史记录（最近 {history.length} 条）</p>
                  <button
                    className="text-xs text-muted-foreground hover:text-destructive"
                    onClick={() => { saveHistory([]); setHistory([]); }}
                  >
                    清除
                  </button>
                </div>
                <div className="space-y-1.5">
                  {history.map((h) => (
                    <button
                      key={h.id}
                      className="w-full text-left rounded-lg border px-3 py-2 hover:bg-muted/50 transition-colors"
                      onClick={() => setFetchUrl(h.url)}
                    >
                      <div className="flex items-center gap-2">
                        {h.ok ? (
                          <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
                        ) : (
                          <XCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
                        )}
                        <span className={`text-xs font-mono font-medium ${h.ok ? "text-green-700" : "text-red-500"}`}>
                          {h.statusCode || "ERR"}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />{h.durationMs}ms
                        </span>
                        {h.proxyUsed && (
                          <Badge variant="outline" className="text-xs py-0 h-4">代理</Badge>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">
                          {new Date(h.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {h.title ?? h.url}
                      </p>
                      {h.error && (
                        <p className="text-xs text-red-400 truncate mt-0.5">{h.error}</p>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="traffic" className="space-y-3">
            {/* 顶部统计栏 */}
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Radio className="w-3.5 h-3.5 text-blue-500" />共 {trafficData?.total ?? 0} 条</span>
                {(trafficData?.stats?.errors ?? 0) > 0 && (
                  <span className="text-red-500">错误 {trafficData?.stats?.errors}</span>
                )}
                {(trafficData?.stats?.avgDurationMs ?? 0) > 0 && (
                  <span>均 {Math.round(trafficData!.stats!.avgDurationMs!)}ms</span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => refetchTraffic()}
              >
                <RefreshCw className="w-3 h-3 mr-1" />刷新
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2 text-muted-foreground"
                onClick={() => {
                  const entries = trafficData?.entries ?? [];
                  if (entries.length === 0) return;
                  const har = {
                    log: {
                      version: "1.2",
                      creator: { name: "ProxyDashboard", version: "1.0" },
                      entries: entries.map((e) => ({
                        startedDateTime: e.timestamp,
                        time: e.durationMs ?? 0,
                        request: { method: e.method ?? "GET", url: e.targetUrl, headers: [], queryString: [], cookies: [], headersSize: -1, bodySize: -1 },
                        response: { status: e.statusCode ?? 0, statusText: "", headers: [], cookies: [], content: { size: e.responseSize ?? -1, mimeType: e.contentType ?? "text/html" }, redirectURL: "", headersSize: -1, bodySize: e.responseSize ?? -1 },
                        cache: {},
                        timings: { send: 0, wait: e.durationMs ?? 0, receive: 0 },
                      })),
                    },
                  };
                  const blob = new Blob([JSON.stringify(har, null, 2)], { type: "application/json" });
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = `traffic-${Date.now()}.har`;
                  a.click();
                }}
              >
                <FileDown className="w-3 h-3 mr-1" />HAR
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 text-xs px-2 text-destructive">
                    <Trash2 className="w-3 h-3 mr-1" />清空
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>确认清空流量记录？</AlertDialogTitle>
                    <AlertDialogDescription>此操作不可撤销，将删除所有抓包记录。</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction onClick={() => clearTrafficMutation.mutate()}>确认清空</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {/* 过滤栏 */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={trafficUrlFilter}
                  onChange={(e) => { setTrafficUrlFilter(e.target.value); setTrafficPage(0); }}
                  placeholder="过滤 URL…"
                  className="h-8 text-xs pl-7"
                />
              </div>
              <select
                value={trafficStatusFilter}
                onChange={(e) => { setTrafficStatusFilter(e.target.value); setTrafficPage(0); }}
                className="h-8 text-xs border rounded-md px-2 bg-background"
              >
                <option value="">全部</option>
                <option value="2xx">2xx</option>
                <option value="3xx">3xx</option>
                <option value="4xx">4xx</option>
                <option value="5xx">5xx</option>
                <option value="error">错误</option>
              </select>
            </div>

            {/* 流量列表 */}
            {(trafficData?.entries ?? []).length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Radio className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">暂无流量记录</p>
                <p className="text-xs mt-1">在「抓取」标签发起请求后将自动记录</p>
              </div>
            ) : (
              <div className="space-y-1">
                {(trafficData?.entries ?? []).map((entry) => {
                  const isSelected = selectedTrafficId === entry.id;
                  const statusCode = entry.statusCode ?? 0;
                  const isError = !!entry.error && !entry.statusCode;
                  const statusColor =
                    isError ? "bg-red-100 text-red-700 border-red-200" :
                    statusCode >= 500 ? "bg-orange-100 text-orange-700 border-orange-200" :
                    statusCode >= 400 ? "bg-yellow-100 text-yellow-700 border-yellow-200" :
                    statusCode >= 300 ? "bg-blue-100 text-blue-700 border-blue-200" :
                    "bg-green-100 text-green-700 border-green-200";
                  const methodColor =
                    (entry.method ?? "GET") === "POST" ? "bg-purple-500" :
                    (entry.method ?? "GET") === "GET" ? "bg-blue-500" : "bg-gray-500";

                  return (
                    <div key={entry.id}>
                      <button
                        className={`w-full text-left rounded-lg border px-3 py-2 transition-colors text-xs ${isSelected ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                        onClick={() => setSelectedTrafficId(isSelected ? null : entry.id)}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`flex-shrink-0 text-white text-[10px] font-bold px-1.5 py-0.5 rounded ${methodColor}`}>
                            {entry.method ?? "GET"}
                          </span>
                          <span className="flex-1 truncate font-mono">{entry.targetUrl}</span>
                          <span className={`flex-shrink-0 text-[10px] font-semibold border px-1.5 py-0.5 rounded ${statusColor}`}>
                            {isError ? "ERR" : statusCode}
                          </span>
                          {entry.durationMs != null && (
                            <span className="flex-shrink-0 text-muted-foreground">{entry.durationMs}ms</span>
                          )}
                          {isSelected ? <ChevronUp className="w-3 h-3 flex-shrink-0" /> : <ChevronDown className="w-3 h-3 flex-shrink-0" />}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-muted-foreground">
                          <span>{new Date(entry.timestamp ?? "").toLocaleTimeString()}</span>
                          {entry.proxyUsed && <span className="flex items-center gap-0.5"><Wifi className="w-2.5 h-2.5" />{entry.proxyUsed}</span>}
                          {entry.contentType && <span className="truncate">{entry.contentType.split(";")[0]}</span>}
                        </div>
                      </button>

                      {isSelected && (
                        <div className="border border-t-0 rounded-b-lg bg-muted/20 px-3 py-2 space-y-1.5 text-xs">
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                            <div><span className="text-muted-foreground">来源：</span>{entry.source ?? "-"}</div>
                            <div><span className="text-muted-foreground">代理：</span>{entry.proxyUsed ?? "直连"}</div>
                            <div><span className="text-muted-foreground">状态：</span>{statusCode || "-"}</div>
                            <div><span className="text-muted-foreground">耗时：</span>{entry.durationMs != null ? `${entry.durationMs}ms` : "-"}</div>
                            <div><span className="text-muted-foreground">大小：</span>{entry.responseSize != null ? `${entry.responseSize}B` : "-"}</div>
                            <div><span className="text-muted-foreground">类型：</span>{entry.contentType?.split(";")[0] ?? "-"}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">URL：</span>
                            <span className="font-mono break-all">{entry.targetUrl}</span>
                          </div>
                          {entry.finalUrl && entry.finalUrl !== entry.targetUrl && (
                            <div>
                              <span className="text-muted-foreground">跳转至：</span>
                              <span className="font-mono break-all text-blue-600">{entry.finalUrl}</span>
                            </div>
                          )}
                          {entry.error && (
                            <div className="text-red-600 font-mono break-all">{entry.error}</div>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs mt-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFetchUrl(entry.targetUrl);
                              setActiveTab("fetch");
                              handleFetch(entry.targetUrl);
                            }}
                          >
                            <RefreshCw className="w-3 h-3 mr-1" />重放请求
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* 分页 */}
            {(trafficData?.total ?? 0) > 100 && (
              <div className="flex items-center justify-between text-xs">
                <Button variant="outline" size="sm" className="h-7" disabled={trafficPage === 0} onClick={() => setTrafficPage(p => p - 1)}>
                  上一页
                </Button>
                <span className="text-muted-foreground">第 {trafficPage + 1} 页 / 共 {Math.ceil((trafficData?.total ?? 0) / 100)} 页</span>
                <Button variant="outline" size="sm" className="h-7" disabled={(trafficPage + 1) * 100 >= (trafficData?.total ?? 0)} onClick={() => setTrafficPage(p => p + 1)}>
                  下一页
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="scheduler" className="space-y-4">
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  定时健康检测
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                {scheduler ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">状态</span>
                      <Badge variant={scheduler.enabled ? "default" : "secondary"}>
                        {scheduler.enabled ? "运行中" : "已停止"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">间隔</span>
                      <span className="font-medium">{scheduler.intervalMinutes} 分钟</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">已运行</span>
                      <span className="font-medium">{scheduler.runCount} 次</span>
                    </div>
                    {scheduler.lastRunAt && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">上次运行</span>
                        <span className="font-medium text-xs">
                          {new Date(scheduler.lastRunAt).toLocaleString()}
                        </span>
                      </div>
                    )}
                    {scheduler.nextRunAt && scheduler.enabled && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">下次运行</span>
                        <span className="font-medium text-xs">
                          {new Date(scheduler.nextRunAt).toLocaleString()}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">自动清除失效</span>
                      <Badge variant={scheduler.autoClearDead ? "default" : "secondary"} className="text-xs">
                        {scheduler.autoClearDead ? "已开启" : "已关闭"}
                      </Badge>
                    </div>
                    {scheduler.autoClearDead && scheduler.lastAutoClearedCount != null && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">上次清除数量</span>
                        <span className="font-medium">{scheduler.lastAutoClearedCount} 个</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">加载中…</p>
                )}
              </CardContent>
            </Card>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">检测间隔（分钟）</label>
              <Input
                type="number"
                min="1"
                value={intervalMinutes}
                onChange={(e) => setIntervalMinutes(e.target.value)}
                className="h-9 text-sm"
              />
            </div>

            <div
              className="flex items-center justify-between rounded-lg border px-3 py-2.5 cursor-pointer select-none"
              onClick={() => setAutoClearDead((v) => !v)}
            >
              <div>
                <p className="text-sm font-medium">检测后自动清除失效代理</p>
                <p className="text-xs text-muted-foreground mt-0.5">每次定时检测结束后自动移除死亡节点</p>
              </div>
              <div
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${autoClearDead ? "bg-primary" : "bg-muted-foreground/30"}`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${autoClearDead ? "translate-x-4" : "translate-x-0.5"}`}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Button
                size="sm"
                className="h-9 col-span-1"
                onClick={() =>
                  startSchedulerMutation.mutate({
                    data: { intervalMinutes: Number(intervalMinutes), testUrl, autoClearDead },
                  })
                }
                disabled={startSchedulerMutation.isPending}
              >
                <Play className="w-3 h-3 mr-1" />
                启动
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-9 col-span-1"
                onClick={() => stopSchedulerMutation.mutate()}
                disabled={stopSchedulerMutation.isPending || !scheduler?.enabled}
              >
                <Square className="w-3 h-3 mr-1" />
                停止
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-9 col-span-1"
                onClick={() => runNowMutation.mutate()}
                disabled={runNowMutation.isPending || proxies.length === 0}
              >
                <Zap className="w-3 h-3 mr-1" />
                立即
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
