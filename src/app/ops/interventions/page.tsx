// ============================================================
// Ops Intervention View - /ops/interventions
// ============================================================
//
// Manual intervention tools:
// - DLQ management (retry, remove, purge, clear)
// - Circuit breaker control (view, reset)
// - Health check trigger
// - Diagnostics export
// ============================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useHealthSSE, type HealthSSEEvent } from '@/lib/hooks/use-health-sse';
import {
  Wrench,
  RefreshCw,
  Trash2,
  AlertTriangle,
  ShieldAlert,
  Download,
  Activity,
  CheckCircle2,
  XCircle,
  Inbox,
  Zap,
} from 'lucide-react';

// ---- Types ----

interface DLQEntry {
  id: string;
  event: string;
  payload: unknown;
  error: string;
  retries: number;
  maxRetries: number;
  firstFailedAt: number;
  lastRetryAt: number;
  nextRetryAt: number;
}

interface CircuitInfo {
  id: string;
  state: string;
  failures: number;
}

interface InterventionResult {
  success: boolean;
  message: string;
  timestamp: number;
}

// ---- Component ----

export default function OpsInterventionsPage() {
  const [dlqEntries, setDlqEntries] = useState<DLQEntry[]>([]);
  const [dlqStats, setDlqStats] = useState({ total: 0, pending: 0, exhausted: 0, oldestEntryAge: 0 });
  const [circuits, setCircuits] = useState<CircuitInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLog, setActionLog] = useState<InterventionResult[]>([]);

  const handleEvent = useCallback((event: HealthSSEEvent) => {
    if (event.type === 'health.initial' && event.data.health) {
      // Refresh data on health events
      fetchAllData();
    }
  }, []);

  const { isConnected } = useHealthSSE({ enabled: true, onEvent: handleEvent });

  useEffect(() => {
    fetchAllData();
  }, []);

  async function fetchAllData() {
    setLoading(true);
    try {
      // Fetch DLQ
      const dlqRes = await fetch('/api/trpc/selfHealing.dlqList');
      if (dlqRes.ok) {
        const dlqJson = await dlqRes.json();
        if (dlqJson?.result?.data) {
          setDlqEntries(dlqJson.result.data.entries ?? []);
          setDlqStats(dlqJson.result.data.stats ?? { total: 0, pending: 0, exhausted: 0, oldestEntryAge: 0 });
        }
      }

      // Fetch circuits
      const circRes = await fetch('/api/trpc/selfHealing.circuitStatus');
      if (circRes.ok) {
        const circJson = await circRes.json();
        if (circJson?.result?.data) {
          setCircuits(Object.entries(circJson.result.data).map(([id, info]: [string, unknown]) => ({
            id,
            ...(info as { state: string; failures: number }),
          })));
        }
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }

  function logAction(success: boolean, message: string) {
    setActionLog(prev => [{ success, message, timestamp: Date.now() }, ...prev].slice(0, 20));
  }

  async function triggerHealthCheck() {
    try {
      const res = await fetch('/api/trpc/selfHealing.triggerHealthCheck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        logAction(true, '手动健康检查已触发');
      } else {
        logAction(false, '健康检查触发失败');
      }
    } catch {
      logAction(false, '健康检查请求异常');
    }
  }

  async function resetCircuit(breakerId: string) {
    try {
      const res = await fetch('/api/trpc/selfHealing.circuitReset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ breakerId }),
      });
      if (res.ok) {
        const json = await res.json();
        logAction(true, json?.result?.data?.message ?? `熔断器 ${breakerId} 已重置`);
        fetchAllData();
      } else {
        logAction(false, `熔断器 ${breakerId} 重置失败`);
      }
    } catch {
      logAction(false, `熔断器 ${breakerId} 请求异常`);
    }
  }

  async function removeDLQEntry(entryId: string) {
    try {
      const res = await fetch('/api/trpc/selfHealing.dlqRemove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId }),
      });
      if (res.ok) {
        logAction(true, `DLQ 条目 ${entryId.slice(0, 8)} 已删除`);
        fetchAllData();
      } else {
        logAction(false, `DLQ 删除失败`);
      }
    } catch {
      logAction(false, 'DLQ 删除请求异常');
    }
  }

  async function purgeExhausted() {
    try {
      const res = await fetch('/api/trpc/selfHealing.dlqPurgeExhausted', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const json = await res.json();
        logAction(true, json?.result?.data?.message ?? '已清理耗尽条目');
        fetchAllData();
      } else {
        logAction(false, '清理失败');
      }
    } catch {
      logAction(false, '清理请求异常');
    }
  }

  async function clearDLQ() {
    if (!confirm('确定要清空所有死信队列条目吗？此操作不可撤销。')) return;
    try {
      const res = await fetch('/api/trpc/selfHealing.dlqClear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const json = await res.json();
        logAction(true, json?.result?.data?.message ?? '已清空死信队列');
        fetchAllData();
      } else {
        logAction(false, '清空失败');
      }
    } catch {
      logAction(false, '清空请求异常');
    }
  }

  function exportDiagnostics() {
    const diagnostics = {
      exportedAt: new Date().toISOString(),
      dlq: { entries: dlqEntries, stats: dlqStats },
      circuits,
      actionLog,
    };
    const blob = new Blob([JSON.stringify(diagnostics, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diagnostics-${new Date().toISOString().slice(0, 19)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    logAction(true, '诊断数据已导出');
  }

  function formatTime(ts: number): string {
    if (!ts) return '-';
    return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function formatAge(ms: number): string {
    if (ms === 0) return '-';
    if (ms < 60000) return `${Math.floor(ms / 1000)}秒`;
    if (ms < 3600000) return `${Math.floor(ms / 60000)}分钟`;
    return `${Math.floor(ms / 3600000)}小时`;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">手动干预</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            DLQ 管理、熔断器控制与诊断导出
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={triggerHealthCheck}>
            <Activity className="w-3.5 h-3.5 mr-1.5" />
            触发健康检查
          </Button>
          <Button size="sm" variant="outline" onClick={exportDiagnostics}>
            <Download className="w-3.5 h-3.5 mr-1.5" />
            导出诊断
          </Button>
          <Button size="sm" variant="outline" onClick={fetchAllData} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>
      </div>

      {/* Action log */}
      {actionLog.length > 0 && (
        <Card size="sm">
          <CardContent>
            <div className="space-y-1 max-h-[100px] overflow-y-auto">
              {actionLog.map((log, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  {log.success
                    ? <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                    : <XCircle className="w-3 h-3 text-red-500 shrink-0" />
                  }
                  <span className="text-gray-700 dark:text-gray-300">{log.message}</span>
                  <span className="ml-auto text-gray-400">{formatTime(log.timestamp)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* DLQ Management */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Inbox className="w-4 h-4 text-orange-500" />
                死信队列
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={purgeExhausted} disabled={dlqStats.exhausted === 0}>
                  <Trash2 className="w-3 h-3 mr-1" />
                  清理耗尽 ({dlqStats.exhausted})
                </Button>
                <Button size="sm" variant="destructive" onClick={clearDLQ} disabled={dlqStats.total === 0}>
                  清空全部
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* DLQ Stats */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="p-2 rounded-md bg-gray-50 dark:bg-gray-800/50 text-center">
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{dlqStats.total}</p>
                <p className="text-[10px] text-gray-500">总条目</p>
              </div>
              <div className="p-2 rounded-md bg-gray-50 dark:bg-gray-800/50 text-center">
                <p className="text-lg font-bold text-amber-600">{dlqStats.pending}</p>
                <p className="text-[10px] text-gray-500">待重试</p>
              </div>
              <div className="p-2 rounded-md bg-gray-50 dark:bg-gray-800/50 text-center">
                <p className="text-lg font-bold text-red-600">{dlqStats.exhausted}</p>
                <p className="text-[10px] text-gray-500">已耗尽</p>
              </div>
            </div>

            {/* DLQ Entries */}
            <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
              {dlqEntries.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">死信队列为空</p>
              ) : (
                dlqEntries.map(entry => (
                  <div key={entry.id} className="flex items-center gap-3 py-2 px-2 rounded-md border border-gray-100 dark:border-gray-800">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] font-mono">{entry.event}</Badge>
                        <span className="text-xs text-gray-400">{entry.retries}/{entry.maxRetries} 重试</span>
                      </div>
                      <p className="text-xs text-red-500 truncate mt-0.5">{entry.error}</p>
                      <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                        <span>首次失败: {formatAge(Date.now() - entry.firstFailedAt)}前</span>
                        {entry.retries < entry.maxRetries && (
                          <span>下次重试: {formatAge(entry.nextRetryAt - Date.now())}后</span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-7 px-2 shrink-0"
                      onClick={() => removeDLQEntry(entry.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Circuit Breaker Control */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-orange-500" />
              熔断器控制
            </CardTitle>
          </CardHeader>
          <CardContent>
            {circuits.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">暂无熔断器注册</p>
            ) : (
              <div className="space-y-2">
                {circuits.map(circuit => (
                  <div
                    key={circuit.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      circuit.state === 'open'
                        ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20'
                        : circuit.state === 'half-open'
                          ? 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20'
                          : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${
                        circuit.state === 'closed' ? 'bg-emerald-500' :
                        circuit.state === 'open' ? 'bg-red-500' : 'bg-amber-500'
                      }`} />
                      <div>
                        <p className="text-sm font-mono font-medium text-gray-900 dark:text-gray-100">{circuit.id}</p>
                        <p className="text-xs text-gray-400">{circuit.failures} failures</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={
                          circuit.state === 'closed'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            : circuit.state === 'open'
                              ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                        }
                      >
                        {circuit.state === 'closed' ? '关闭' : circuit.state === 'open' ? '断开' : '半开'}
                      </Badge>
                      {circuit.state !== 'closed' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7"
                          onClick={() => resetCircuit(circuit.id)}
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />
                          重置
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Info */}
            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-xs text-gray-500 space-y-1">
                  <p><strong>关闭 (Closed)</strong>: 正常状态，请求正常通过</p>
                  <p><strong>断开 (Open)</strong>: 熔断状态，请求被拒绝，等待恢复</p>
                  <p><strong>半开 (Half-Open)</strong>: 探测状态，允许少量请求通过以测试恢复</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
