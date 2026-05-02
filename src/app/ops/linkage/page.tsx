// ============================================================
// Ops Linkage Trace View - /ops/linkage
// ============================================================
//
// Displays EventBus linkage traces between capabilities.
// Shows event flow, latency, and allows manual retry.
// ============================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useHealthSSE, type HealthSSEEvent } from '@/lib/hooks/use-health-sse';
import { trpc } from '@/lib/trpc/client';
import {
  Link2,
  RefreshCw,
  ArrowRight,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Filter,
  Inbox,
} from 'lucide-react';

// ---- Types ----

interface LinkageTrace {
  id: string;
  traceId: string;
  eventType: string;
  source: string;
  target: string;
  status: 'success' | 'failed' | 'pending';
  latencyMs: number;
  timestamp: number;
  error?: string;
  metadata?: Record<string, unknown>;
  spanCount?: number;
  completedAt?: number;
}

interface LinkageStats {
  activeTraces: number;
  successRate: number;
  avgDuration: number;
  errorCount: number;
  throughput: number;
}

// ---- Component ----

export default function OpsLinkagePage() {
  const [traces, setTraces] = useState<LinkageTrace[]>([]);
  const [stats, setStats] = useState<LinkageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'success' | 'failed' | 'pending'>('all');
  const [selectedTrace, setSelectedTrace] = useState<LinkageTrace | null>(null);

  // SSE for real-time updates
  const handleEvent = useCallback((event: HealthSSEEvent) => {
    if (event.type === 'health.degraded' || event.type === 'health.recovered') {
      refreshTraces();
    }
  }, []);

  const { isConnected } = useHealthSSE({ enabled: true, onEvent: handleEvent });

  const fetchTraces = useCallback(async () => {
    try {
      const [activeTraces, completedTraces] = await Promise.all([
        trpc.linkage.getActiveTraces.query(),
        trpc.linkage.getCompletedTraces.query({ limit: 50 }),
      ]);

      // Combine active + completed traces, sort by timestamp descending
      const combined = [...activeTraces, ...completedTraces]
        .sort((a, b) => b.timestamp - a.timestamp);

      setTraces(combined);
    } catch (err: any) {
      console.error('Failed to fetch traces:', err);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const statsData = await trpc.linkage.getStats.query();
      setStats(statsData);
    } catch (err: any) {
      console.error('Failed to fetch linkage stats:', err);
    }
  }, []);

  const refreshTraces = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchTraces(), fetchStats()]);
    setLoading(false);
  }, [fetchTraces, fetchStats]);

  useEffect(() => {
    refreshTraces();
  }, [refreshTraces]);

  const filteredTraces = filter === 'all' ? traces : traces.filter(t => t.status === filter);

  // Stats — prefer server stats when available, fall back to client-side calculation
  const successCount = traces.filter(t => t.status === 'success').length;
  const failedCount = traces.filter(t => t.status === 'failed').length;
  const pendingCount = traces.filter(t => t.status === 'pending').length;
  const avgLatency = traces.filter(t => t.latencyMs > 0).reduce((sum, t) => sum + t.latencyMs, 0) / Math.max(traces.filter(t => t.latencyMs > 0).length, 1);

  function formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">联动追踪</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            EventBus 事件联动链路追踪与诊断
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-gray-300'}`} />
            <span className="text-xs text-gray-500">{isConnected ? '实时' : '离线'}</span>
          </div>
          <Button size="sm" variant="outline" onClick={refreshTraces} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card size="sm">
          <CardContent className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{successCount}</p>
              <p className="text-xs text-gray-500">成功</p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-950 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{failedCount}</p>
              <p className="text-xs text-gray-500">失败</p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-950 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{pendingCount}</p>
              <p className="text-xs text-gray-500">待处理</p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{Math.round(avgLatency)}ms</p>
              <p className="text-xs text-gray-500">平均延迟</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-gray-400" />
        {(['all', 'success', 'failed', 'pending'] as const).map(f => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? 'default' : 'outline'}
            onClick={() => setFilter(f)}
            className="text-xs"
          >
            {f === 'all' ? '全部' : f === 'success' ? '成功' : f === 'failed' ? '失败' : '待处理'}
          </Button>
        ))}
      </div>

      {/* Trace list */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-orange-500" />
                联动链路
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading && traces.length === 0 ? (
                <div className="space-y-4 animate-pulse">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 rounded-lg" />
                    ))}
                  </div>
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded-lg" />
                    ))}
                  </div>
                </div>
              ) : filteredTraces.length === 0 ? (
                <div className="text-center py-10">
                  <Inbox className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-400">暂无联动链路记录</p>
                  <p className="text-xs text-gray-300 mt-1">事件触发联动后将在此显示</p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
                  {filteredTraces.map(trace => (
                    <div
                      key={trace.id}
                      onClick={() => setSelectedTrace(trace)}
                      className={`flex items-center gap-3 py-2 px-3 rounded-lg cursor-pointer transition-colors ${
                        selectedTrace?.id === trace.id
                          ? 'bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                      }`}
                    >
                      <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                        {trace.eventType}
                      </Badge>
                      <div className="flex items-center gap-1.5 text-sm">
                        <span className="font-mono text-gray-700 dark:text-gray-300">{trace.source}</span>
                        <ArrowRight className="w-3 h-3 text-gray-400" />
                        <span className="font-mono text-gray-700 dark:text-gray-300">{trace.target}</span>
                      </div>
                      <div className="ml-auto flex items-center gap-2">
                        <span className="text-xs text-gray-400">{trace.latencyMs}ms</span>
                        {trace.status === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                        {trace.status === 'failed' && <XCircle className="w-3.5 h-3.5 text-red-500" />}
                        {trace.status === 'pending' && <Clock className="w-3.5 h-3.5 text-amber-500" />}
                        <span className="text-xs text-gray-400">{formatTime(trace.timestamp)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Detail panel */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">链路详情</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedTrace ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Trace ID</p>
                    <p className="text-sm font-mono text-gray-900 dark:text-gray-100">{selectedTrace.traceId}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">事件类型</p>
                    <Badge variant="outline">{selectedTrace.eventType}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">链路</p>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-mono px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">{selectedTrace.source}</span>
                      <ArrowRight className="w-3 h-3 text-gray-400" />
                      <span className="font-mono px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">{selectedTrace.target}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">状态</p>
                    {selectedTrace.status === 'success' && <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">成功</Badge>}
                    {selectedTrace.status === 'failed' && <Badge variant="destructive">失败</Badge>}
                    {selectedTrace.status === 'pending' && <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">待处理</Badge>}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">延迟</p>
                    <p className="text-sm text-gray-900 dark:text-gray-100">{selectedTrace.latencyMs}ms</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">时间</p>
                    <p className="text-sm text-gray-900 dark:text-gray-100">
                      {new Date(selectedTrace.timestamp).toLocaleString('zh-CN')}
                    </p>
                  </div>
                  {selectedTrace.error && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">错误信息</p>
                      <div className="p-2 bg-red-50 dark:bg-red-950/30 rounded-md border border-red-200 dark:border-red-800">
                        <p className="text-xs text-red-700 dark:text-red-300">{selectedTrace.error}</p>
                      </div>
                    </div>
                  )}
                  {selectedTrace.status === 'failed' && (
                    <Button size="sm" variant="outline" className="w-full">
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                      重试联动
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-8">点击链路查看详情</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
