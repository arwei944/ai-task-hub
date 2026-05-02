// ============================================================
// Ops Workflows View - /ops/workflows
// ============================================================
//
// Workflow execution monitoring with status, steps, and retry.
// ============================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/lib/trpc/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  GitBranch,
  RefreshCw,
  Play,
  Pause,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

// ---- Types ----

interface WorkflowStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
  error?: string;
}

interface WorkflowRun {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  trigger: string;
  startedAt: number;
  completedAt?: number;
  steps: WorkflowStep[];
}

// ---- Component ----

export default function OpsWorkflowsPage() {
  const [workflows, setWorkflows] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [runningCount, setRunningCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [runsData, countData] = await Promise.all([
        trpc.workflows.getRecentRunsWithSteps.query({ limit: 10 }),
        trpc.workflows.getRunningCount.query(),
      ]);
      setWorkflows(runsData.items ?? []);
      setRunningCount(countData.running);
      setCompletedCount(countData.completed);
      setFailedCount(countData.failed);
    } catch (err: any) {
      console.error('Failed to fetch workflow data:', err);
      setError(err.message || '加载工作流数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function refresh() {
    fetchData();
  }

  function StatusIcon({ status }: { status: string }) {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'running': return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'paused': return <Pause className="w-4 h-4 text-amber-500" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  }

  function StatusBadge({ status }: { status: string }) {
    switch (status) {
      case 'completed': return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">完成</Badge>;
      case 'failed': return <Badge variant="destructive">失败</Badge>;
      case 'running': return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">运行中</Badge>;
      case 'paused': return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">已暂停</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  }

  function StepStatusDot({ status }: { status: string }) {
    switch (status) {
      case 'completed': return <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />;
      case 'failed': return <div className="w-2.5 h-2.5 rounded-full bg-red-500" />;
      case 'running': return <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />;
      case 'skipped': return <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />;
      default: return <div className="w-2.5 h-2.5 rounded-full border-2 border-gray-300" />;
    }
  }

  function formatTime(ts?: number): string {
    if (!ts) return '-';
    return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">工作流监控</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            工作流执行状态与步骤追踪
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={refresh} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card size="sm">
          <CardContent className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{runningCount}</p>
              <p className="text-xs text-gray-500">运行中</p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{completedCount}</p>
              <p className="text-xs text-gray-500">已完成</p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex items-center gap-3">
            <XCircle className="w-5 h-5 text-red-500" />
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{failedCount}</p>
              <p className="text-xs text-gray-500">失败</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Workflow list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-orange-500" />
            工作流列表
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
              <XCircle className="w-5 h-5 mb-2 text-red-400" />
              <p className="text-sm">{error}</p>
            </div>
          ) : workflows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
              <GitBranch className="w-5 h-5 mb-2" />
              <p className="text-sm">暂无工作流执行记录</p>
            </div>
          ) : (
            <div className="space-y-2">
              {workflows.map(wf => (
                <div key={wf.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  {/* Workflow header */}
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    onClick={() => setExpandedId(expandedId === wf.id ? null : wf.id)}
                  >
                    {expandedId === wf.id
                      ? <ChevronDown className="w-4 h-4 text-gray-400" />
                      : <ChevronRight className="w-4 h-4 text-gray-400" />
                    }
                    <StatusIcon status={wf.status} />
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{wf.name}</span>
                    <StatusBadge status={wf.status} />
                    <Badge variant="outline" className="text-[10px]">{wf.trigger}</Badge>
                    <span className="ml-auto text-xs text-gray-400">{formatTime(wf.startedAt)}</span>
                  </div>

                  {/* Expanded steps */}
                  {expandedId === wf.id && (
                    <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 px-4 py-3">
                      <div className="space-y-2">
                        {wf.steps.map((step, i) => (
                          <div key={step.id} className="flex items-center gap-3">
                            <StepStatusDot status={step.status} />
                            {i < wf.steps.length - 1 && (
                              <div className={`w-0.5 h-4 ml-[4px] -my-1 ${step.status === 'completed' ? 'bg-emerald-300' : 'bg-gray-200'}`} />
                            )}
                            <span className={`text-sm ${step.status === 'skipped' ? 'text-gray-400 line-through' : 'text-gray-700 dark:text-gray-300'}`}>
                              {step.name}
                            </span>
                            {step.error && (
                              <span className="text-xs text-red-500 truncate max-w-[200px]">{step.error}</span>
                            )}
                            <span className="ml-auto text-xs text-gray-400">{formatTime(step.completedAt ?? step.startedAt)}</span>
                            {step.status === 'failed' && (
                              <Button size="sm" variant="ghost" className="text-xs h-6 px-2">
                                <Play className="w-3 h-3 mr-1" />重试
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
