import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListProxies,
  useAddProxies,
  useDeleteProxy,
  useClearProxies,
  useCheckAllProxies,
  useCheckProxy,
  useGetSchedulerStatus,
  useStartScheduler,
  useStopScheduler,
  useRunSchedulerNow,
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

function ProxyRow({ proxy, onDelete, onCheck }: {
  proxy: {
    id: string;
    url: string;
    protocol: string;
    label?: string | null;
    alive: boolean;
    latencyMs?: number | null;
    successCount: number;
    failureCount: number;
    consecutiveFails: number;
    lastCheckedAt?: string | null;
  };
  onDelete: (id: string) => void;
  onCheck: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border rounded-lg mb-2 overflow-hidden">
      <div
        className="flex items-center gap-2 p-3 cursor-pointer hover:bg-muted/50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-shrink-0">
          {proxy.alive ? (
            <Wifi className="w-4 h-4 text-green-500" />
          ) : (
            <WifiOff className="w-4 h-4 text-red-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{proxy.url}</p>
          {proxy.label && (
            <p className="text-xs text-muted-foreground truncate">{proxy.label}</p>
          )}
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
          {result.proxyUsed ? (
            <Badge variant="outline" className="text-xs ml-auto truncate max-w-[120px]">
              {result.proxyUsed}
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs ml-auto">直连</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{result.finalUrl}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{result.contentType}</p>
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
  const [intervalMinutes, setIntervalMinutes] = useState("5");
  const [testUrl, setTestUrl] = useState("https://www.google.com");

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
    addProxiesMutation.mutate({ body: { url: singleUrl.trim(), label: singleLabel.trim() || undefined } });
  };

  const handleAddBatch = () => {
    const lines = batchText.trim().split("\n").filter(Boolean);
    const urls = lines.map((line) => {
      const parts = line.split(/\s+/);
      return { url: parts[0], label: parts[1] || undefined };
    });
    if (urls.length === 0) return;
    addProxiesMutation.mutate({ body: { urls } });
  };

  const handleFetch = async () => {
    const url = fetchUrl.trim();
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

  const proxies = proxiesData?.proxies ?? [];
  const stats = proxiesData?.stats;
  const scheduler = schedulerData;

  const aliveProxies = proxies.filter((p) => p.alive);
  const deadProxies = proxies.filter((p) => !p.alive);

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

        <Tabs defaultValue="proxies">
          <TabsList className="w-full mb-4 grid grid-cols-4">
            <TabsTrigger value="proxies" className="text-xs">代理池</TabsTrigger>
            <TabsTrigger value="add" className="text-xs">添加</TabsTrigger>
            <TabsTrigger value="fetch" className="text-xs">抓取测试</TabsTrigger>
            <TabsTrigger value="scheduler" className="text-xs">定时任务</TabsTrigger>
          </TabsList>

          <TabsContent value="proxies" className="space-y-3">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-9"
                onClick={() => checkAllMutation.mutate({ body: { testUrl } })}
                disabled={checkAllMutation.isPending || proxies.length === 0}
              >
                <Activity className="w-4 h-4 mr-1" />
                {checkAllMutation.isPending ? "检测中…" : "检测全部"}
              </Button>
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
                    <p className="text-xs font-medium text-green-600 mb-1">存活 ({aliveProxies.length})</p>
                    {aliveProxies.map((p) => (
                      <ProxyRow
                        key={p.id}
                        proxy={p}
                        onDelete={(id) => deleteProxyMutation.mutate({ id })}
                        onCheck={(id) => checkOneMutation.mutate({ id, body: { testUrl } })}
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
                        onCheck={(id) => checkOneMutation.mutate({ id, body: { testUrl } })}
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
                <textarea
                  value={batchText}
                  onChange={(e) => setBatchText(e.target.value)}
                  placeholder={"每行一个代理，格式：\nhttp://host:port 备注\nsocks5://host:port\n..."}
                  className="w-full h-40 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <p className="text-xs text-muted-foreground">
                  共 {batchText.trim().split("\n").filter(Boolean).length} 行
                </p>
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

              <Button
                className="w-full h-9"
                onClick={handleFetch}
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

            <div className="grid grid-cols-3 gap-2">
              <Button
                size="sm"
                className="h-9 col-span-1"
                onClick={() =>
                  startSchedulerMutation.mutate({
                    body: { intervalMinutes: Number(intervalMinutes), testUrl },
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
