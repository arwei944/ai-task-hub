// ============================================================
// Ops Overview Dashboard - /ops
// ============================================================
//
// Real-time health overview of all 7 capabilities,
// circuit breaker status, DLQ stats, and recent events.
// ============================================================

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useHealthSSE, type HealthSSEEvent } from '@/lib/hooks/use-health-sse';
import { trpc } from '@/lib/trpc/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Activity,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Zap,
  Inbox,
  Radio,
  GitBranch,
  Link2,
  Bell,
} from 'lucide-react';

// ---- Types ----

interface HealthReport {
  status: string;
  details?: string;
  metrics?: Record<string, unknown>;
  checkedAt: number;
  latencyMs?: number;
}

interface CircuitStatus {
  state: string;
  failures: number;
}

interface DLQStats {
  total: number;
  pending: number;
  exhausted: number;
  oldestEntryAge: number;
}

interface HealthOverview {
  health: Record<string, HealthReport>;
  circuits: Record<string, CircuitStatus>;
  dlq: DLQStats;
  timestamp: number;
}

// ---- Capability display names ----

const CAPABILITY_LABELS: Record<string, { label: string; icon: string }> = {
  'task': { label: '任务引擎', icon: '📋' },
  'notification': { label: '通知系统', icon: '🔔' },
  'workflow': { label: '工作流', icon: '🔄' },
  'ai': { label: 'AI 服务', icon: '🤖' },
  'integration': { label: '集成适配', icon: '🔌' },
  'agent': { label: '智能体', icon: '🤝' },
  'observability': { label: '可观测性', icon: '📊' },
};

// ---- Status helpers ----

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'healthy':
      return <Badge variant="default" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><CheckCircle2 className="w-3 h-3 mr-1" />正常</Badge>;
    case 'degraded':
      return <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"><AlertTriangle className="w-3 h-3 mr-1" />降级</Badge>;
    case 'failed':
      return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />故障</Badge>;
    default:
      return <Badge variant="outline">未知</Badge>;
  }
}

function CircuitStateBadge({ state }: { state: string }) {
  switch (state) {
    case 'closed':
      return <Badge variant="default" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">关闭</Badge>;
    case 'open':
      return <Badge variant="destructive">断开</Badge>;
    case 'half-open':
      return <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">半开</Badge>;
    default:
      return <Badge variant="outline">{state}</Badge>;
  }
}

function formatAge(ms: number): string {
  if (ms === 0) return '-';
  if (ms < 60000) return `${Math.floor(ms / 1000)}秒`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}分钟`;
  return `${Math.floor(ms / 3600000)}小时`;
}

function formatTime(ts: number): string {
  if (!ts) return '-';
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ---- Component ----

export default function OpsOverviewPage() {
  const [overview, setOverview] = useState<HealthOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [recentEvents, setRecentEvents] = useState<HealthSSEEvent[]>([]);
  const [quickStats, setQuickStats] = useState({
    runningWorkflows: 0,
    activeTraces: 0,
    sent24h: 0,
    failed24h: 0,
  });

  // SSE for real-time updates
  const handleEvent = useCallback((event: HealthSSEEvent) => {
    if (event.type === 'health.initial' && event.data.health) {
      setOverview({
        health: event.data.health as unknown as Record<string, HealthReport>,
        circuits: (event.data.circuits as unknown as Record<string, CircuitStatus>) ?? {},
        dlq: (event.data.dlq as unknown as DLQStats) ?? { total: 0, pending: 0, exhausted: 0, oldestEntryAge: 0 },
        timestamp: event.timestamp,
      });
      setLoading(false);
    }

    if (event.type === 'health.check' && event.data.report) {
      setOverview(prev => {
        if (!prev) return prev;
        const capId = event.data.capabilityId ?? '';
        return {
          ...prev,
          health: {
            ...prev.health,
            [capId]: event.data.report as unknown as HealthReport,
          },
          timestamp: event.timestamp,
        };
      });
    }

    if (event.type === 'health.degraded' || event.type === 'health.recovered' || event.type === 'circuit.state_change') {
      setRecentEvents(prev => [event, ...prev].slice(0, 20));
    }
  }, []);

  const { isConnected } = useHealthSSE({
    enabled: true,
    onEvent: handleEvent,
  });

  // Fallback: fetch via tRPC-like REST if SSE doesn't get initial data
  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) {
        // SSE may not be available (no auth), try direct fetch
        fetchOverview();
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [loading]);

  // Fetch quick stats from tRPC
  const fetchQuickStats = useCallback(async () => {
    try {
      const [wfCount, linkageStats, notifStats] = await Promise.allSettled([
        trpc.workflows.getRunningCount.query(),
        trpc.linkage.getStats.query(),
        trpc.notificationHistory.getDeliveryStats.query(),
      ]);

      setQuickStats({
        runningWorkflows: wfCount.status === 'fulfilled' ? (wfCount.value as { running?: number }).running ?? 0 : 0,
        activeTraces: linkageStats.status === 'fulfilled' ? (linkageStats.value as { activeTraces?: number }).activeTraces ?? 0 : 0,
        sent24h: notifStats.status === 'fulfilled' ? (notifStats.value as { sent24h?: number }).sent24h ?? 0 : 0,
        failed24h: notifStats.status === 'fulfilled' ? (notifStats.value as { failed24h?: number }).failed24h ?? 0 : 0,
      });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchQuickStats();
    // Refresh quick stats every 30s
    const interval = setInterval(fetchQuickStats, 30000);
    return () => clearInterval(interval);
  }, [fetchQuickStats]);

  async function fetchOverview() {
    try {
      const data = await trpc.selfHealing.healthOverview.query();
      if (data) {
        setOverview(data as unknown as HealthOverview);
        setLoading(false);
      }
    } catch {
      // Silently fail - SSE should be the primary source
    }
  }

  async function triggerHealthCheck() {
    setTriggering(true);
    try {
      const result = await trpc.selfHealing.triggerHealthCheck.mutate();
      if (result?.reports) {
        setOverview(prev => prev ? {
          ...prev,
          health: result.reports,
          timestamp: Date.now(),
        } : prev);
      }
    } catch {
      // ignore
    } finally {
      setTriggering(false);
    }
  }

  // Computed stats
  const healthEntries = overview ? Object.entries(overview.health ?? {}) : [];
  const healthyCount = healthEntries.filter(([, r]) => r.status === 'healthy').length;
  const degradedCount = healthEntries.filter(([, r]) => r.status === 'degraded').length;
  const failedCount = healthEntries.filter(([, r]) => r.status === 'failed').length;
  const circuitEntries = overview ? Object.entries(overview.circuits ?? {}) : [];
  const openCircuits = circuitEntries.filter(([, c]) => c.state === 'open').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">运维总览</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            实时监控 7 大能力模块的健康状态
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-gray-300'}`} />
            <span className="text-xs text-gray-500">{isConnected ? 'SSE 已连接' : 'SSE 未连接'}</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={triggerHealthCheck}
            disabled={triggering}
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${triggering ? 'animate-spin' : ''}`} />
            手动检查
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-400">加载中...</span>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card size="sm">
              <CardContent className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{healthyCount}</p>
                  <p className="text-xs text-gray-500">正常模块</p>
                </div>
              </CardContent>
            </Card>

            <Card size="sm">
              <CardContent className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-950 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{degradedCount}</p>
                  <p className="text-xs text-gray-500">降级模块</p>
                </div>
              </CardContent>
            </Card>

            <Card size="sm">
              <CardContent className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-950 flex items-center justify-center">
                  <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{openCircuits}</p>
                  <p className="text-xs text-gray-500">熔断器断开</p>
                </div>
              </CardContent>
            </Card>

            <Card size="sm">
              <CardContent className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
                  <Inbox className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{overview?.dlq.total ?? 0}</p>
                  <p className="text-xs text-gray-500">死信队列</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick stats from tRPC */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card size="sm">
              <CardContent className="flex items-center gap-3">
                <GitBranch className="w-5 h-5 text-violet-500" />
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{quickStats.runningWorkflows}</p>
                  <p className="text-xs text-gray-500">运行中工作流</p>
                </div>
              </CardContent>
            </Card>
            <Card size="sm">
              <CardContent className="flex items-center gap-3">
                <Link2 className="w-5 h-5 text-orange-500" />
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{quickStats.activeTraces}</p>
                  <p className="text-xs text-gray-500">活跃联动链路</p>
                </div>
              </CardContent>
            </Card>
            <Card size="sm">
              <CardContent className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-emerald-500" />
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{quickStats.sent24h}</p>
                  <p className="text-xs text-gray-500">24h 通知发送</p>
                </div>
              </CardContent>
            </Card>
            <Card size="sm">
              <CardContent className="flex items-center gap-3">
                <XCircle className="w-5 h-5 text-red-500" />
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{quickStats.failed24h}</p>
                  <p className="text-xs text-gray-500">24h 通知失败</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Capability health grid */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-orange-500" />
                能力模块状态
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {healthEntries.map(([id, report]) => {
                  const meta = CAPABILITY_LABELS[id] ?? { label: id, icon: '📦' };
                  return (
                    <div
                      key={id}
                      className={`p-3 rounded-lg border transition-colors ${
                        report.status === 'healthy'
                          ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30'
                          : report.status === 'degraded'
                            ? 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30'
                            : report.status === 'failed'
                              ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/30'
                              : 'border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{meta.icon}</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{meta.label}</span>
                        </div>
                        <StatusBadge status={report.status} />
                      </div>
                      {report.details && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 truncate">{report.details}</p>
                      )}
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>延迟: {report.latencyMs != null ? `${report.latencyMs}ms` : '-'}</span>
                        <span>{formatTime(report.checkedAt)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Circuit breakers + DLQ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Circuit Breakers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-orange-500" />
                  熔断器状态
                </CardTitle>
              </CardHeader>
              <CardContent>
                {circuitEntries.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">暂无熔断器注册</p>
                ) : (
                  <div className="space-y-2">
                    {circuitEntries.map(([id, status]) => (
                      <div key={id} className="flex items-center justify-between py-1.5 px-2 rounded-md bg-gray-50 dark:bg-gray-800/50">
                        <span className="text-sm font-mono text-gray-700 dark:text-gray-300">{id}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400">{status.failures} failures</span>
                          <CircuitStateBadge state={status.state} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* DLQ Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Inbox className="w-4 h-4 text-orange-500" />
                  死信队列
                </CardTitle>
              </CardHeader>
              <CardContent>
                {overview && overview.dlq && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 text-center">
                      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{overview.dlq.total ?? 0}</p>
                      <p className="text-xs text-gray-500">总条目</p>
                    </div>
                    <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 text-center">
                      <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{overview.dlq.pending ?? 0}</p>
                      <p className="text-xs text-gray-500">待处理</p>
                    </div>
                    <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 text-center">
                      <p className="text-2xl font-bold text-red-600 dark:text-red-400">{overview.dlq.exhausted ?? 0}</p>
                      <p className="text-xs text-gray-500">已耗尽</p>
                    </div>
                    <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 text-center">
                      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatAge(overview.dlq.oldestEntryAge ?? 0)}</p>
                      <p className="text-xs text-gray-500">最老条目</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent events */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-blue-500" />
                最近事件
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentEvents.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">暂无最近事件</p>
              ) : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {recentEvents.map((evt, idx) => (
                    <div key={idx} className="flex items-center gap-2 py-1 px-2 rounded-md bg-gray-50 dark:bg-gray-800/50 text-xs">
                      <span className="text-gray-400 shrink-0">{formatTime(evt.timestamp)}</span>
                      <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">{evt.type}</Badge>
                      <span className="text-gray-600 dark:text-gray-300 truncate">{JSON.stringify(evt.data).slice(0, 80)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
