'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Activity,
  Flag,
  Bot,
  Clock,
  FileText,
  UserPlus,
  RefreshCw,
} from 'lucide-react';

// ---- Types ----

interface TimelineItem {
  id: string;
  type: 'milestone_created' | 'milestone_completed' | 'work_logged' | 'doc_updated' | 'agent_assigned';
  date: string;
  description: string;
  agentName?: string;
  meta?: Record<string, unknown>;
}

// ---- Helpers ----

function ActivityIcon({ type }: { type: TimelineItem['type'] }) {
  switch (type) {
    case 'milestone_created':
    case 'milestone_completed':
      return <Flag className="w-4 h-4 text-violet-500" />;
    case 'work_logged':
      return <Clock className="w-4 h-4 text-amber-500" />;
    case 'doc_updated':
      return <FileText className="w-4 h-4 text-blue-500" />;
    case 'agent_assigned':
      return <UserPlus className="w-4 h-4 text-emerald-500" />;
    default:
      return <Activity className="w-4 h-4 text-gray-400" />;
  }
}

function ActivityTypeBadge({ type }: { type: TimelineItem['type'] }) {
  switch (type) {
    case 'milestone_created':
      return <Badge variant="outline" className="text-xs">里程碑创建</Badge>;
    case 'milestone_completed':
      return <Badge variant="default" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-xs">里程碑完成</Badge>;
    case 'work_logged':
      return <Badge variant="outline" className="text-xs">工作日志</Badge>;
    case 'doc_updated':
      return <Badge variant="outline" className="text-xs">文档更新</Badge>;
    case 'agent_assigned':
      return <Badge variant="outline" className="text-xs">智能体分配</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">{type}</Badge>;
  }
}

function formatDate(date: string): string {
  const d = new Date(date);
  return d.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function groupByDate(items: TimelineItem[]): Record<string, TimelineItem[]> {
  const groups: Record<string, TimelineItem[]> = {};
  for (const item of items) {
    const dateKey = new Date(item.date).toISOString().split('T')[0];
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(item);
  }
  return groups;
}

// ---- Component ----

export default function ProjectActivityPage() {
  const params = useParams();
  const projectId = params?.id as string;
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivity = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [workLogsData, milestonesData] = await Promise.all([
        trpc.projectHub.workLogs.list.query({ projectId, pageSize: 50 }),
        trpc.projectHub.milestones.list.query({ projectId }),
      ]);

      const items: TimelineItem[] = [];

      // Work logs -> work_logged
      if (workLogsData?.items) {
        for (const log of workLogsData.items) {
          items.push({
            id: log.id,
            type: 'work_logged',
            date: log.createdAt || log.date,
            description: log.description || `记录了 ${log.hours}h 工时`,
            agentName: log.agentName,
            meta: { hours: log.hours, taskId: log.taskId },
          });
        }
      }

      // Milestones -> milestone_created / milestone_completed
      if (milestonesData) {
        for (const ms of milestonesData) {
          if (ms.status === 'completed') {
            items.push({
              id: ms.id + '_completed',
              type: 'milestone_completed',
              date: ms.updatedAt || ms.dueDate || ms.createdAt,
              description: `完成里程碑: ${ms.title}`,
              meta: { milestoneId: ms.id },
            });
          }
          items.push({
            id: ms.id + '_created',
            type: 'milestone_created',
            date: ms.createdAt,
            description: `创建里程碑: ${ms.title}`,
            meta: { milestoneId: ms.id },
          });
        }
      }

      // Sort by date descending
      items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setTimeline(items);
    } catch (err: any) {
      console.error('Activity fetch error:', err);
      setError(err?.message ?? '加载活动失败');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  const grouped = groupByDate(timeline);
  const sortedDates = Object.keys(grouped).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="animate-pulse w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          <div className="animate-pulse space-y-1">
            <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link
          href={`/project-hub/${projectId}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回项目详情
        </Link>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-red-500 mb-2">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchActivity}>
              重试
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/project-hub/${projectId}`}
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-500" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">项目活动</h1>
        </div>
        <div className="ml-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={fetchActivity}
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            刷新
          </Button>
        </div>
      </div>

      {/* Activity Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-500" />
            活动时间线
            <Badge variant="secondary" className="ml-2">{timeline.length} 条记录</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {timeline.length === 0 ? (
            <div className="flex flex-col items-center py-12 gap-3">
              <Activity className="w-12 h-12 text-gray-300 dark:text-gray-600" />
              <p className="text-sm text-gray-400">暂无活动记录</p>
            </div>
          ) : (
            <div className="space-y-6">
              {sortedDates.map((dateKey) => (
                <div key={dateKey}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {new Date(dateKey).toLocaleDateString('zh-CN', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        weekday: 'long',
                      })}
                    </span>
                    <div className="flex-1 border-t border-gray-100 dark:border-gray-800" />
                  </div>
                  <div className="space-y-2">
                    {grouped[dateKey].map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start gap-3 py-2.5 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                      >
                        <div className="mt-0.5 shrink-0">
                          <ActivityIcon type={item.type} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 dark:text-gray-100">{item.description}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <ActivityTypeBadge type={item.type} />
                            {item.agentName && (
                              <span className="text-xs text-gray-400 flex items-center gap-1">
                                <Bot className="w-3 h-3" />
                                {item.agentName}
                              </span>
                            )}
                            {item.meta?.hours != null && (
                              <span className="text-xs text-gray-400">
                                {item.meta.hours as number}h
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-gray-400 shrink-0">
                          {formatDate(item.date)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
