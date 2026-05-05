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

export default function Dashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [addMode, setAddMode] = useState<"single" | "batch">("single");
  const [singleUrl, setSingleUrl] = useState("");
  const [singleLabel, setSingleLabel] = useState("");
  const [batchText, setBatchText] = useState("");
  const [intervalMinutes, setIntervalMinutes] = useState("5");
  const [testUrl, setTestUrl] = useState("https://www.google.com");

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
          <TabsList className="w-full mb-4">
            <TabsTrigger value="proxies" className="flex-1">代理池</TabsTrigger>
            <TabsTrigger value="add" className="flex-1">添加代理</TabsTrigger>
            <TabsTrigger value="scheduler" className="flex-1">定时任务</TabsTrigger>
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
              <label className="text-xs text-muted-foreground mb-1 block">检测目标 URL</label>
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
