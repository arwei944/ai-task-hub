// ============================================================
// Project Hub Dashboard - /project-hub
// ============================================================
//
// Project management center overview with stat cards,
// health matrix, upcoming deadlines, and recent activity.
// ============================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  FolderKanban,
  PlayCircle,
  CheckCircle2,
  PauseCircle,
  HeartPulse,
  Plus,
  Clock,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

// ---- Types ----

interface DashboardOverview {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  pausedProjects: number;
  healthScore: number;
  recentActivity: ActivityItem[];
  upcomingDeadlines: DeadlineItem[];
  healthMatrix: HealthMatrixItem[];
}

interface ActivityItem {
  id: string;
  projectId: string;
  projectName: string;
  action: string;
  timestamp: Date;
}

interface DeadlineItem {
  id: string;
  projectId: string;
  projectName: string;
  milestone: string;
  dueDate: Date;
  status: string;
}

interface HealthMatrixItem {
  projectId: string;
  projectName: string;
  progress: number;
  riskLevel: string;
  healthStatus: string;
  lastUpdated: Date;
}

// ---- Status helpers ----

function RiskBadge({ level }: { level: string }) {
  switch (level) {
    case 'low':
      return <Badge variant="default" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">低风险</Badge>;
    case 'medium':
      return <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">中风险</Badge>;
    case 'high':
      return <Badge variant="destructive">高风险</Badge>;
    default:
      return <Badge variant="outline">{level}</Badge>;
  }
}

function HealthBadge({ status }: { status: string }) {
  switch (status) {
    case 'healthy':
      return <Badge variant="default" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">健康</Badge>;
    case 'warning':
      return <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">警告</Badge>;
    case 'critical':
      return <Badge variant="destructive">严重</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}小时前`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}天前`;
}

// ---- Component ----

export default function ProjectHubDashboardPage() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await trpc.projectHub.dashboard.overview.query();
      setOverview(data as unknown as DashboardOverview);
    } catch (err: any) {
      console.error('Project Hub dashboard fetch error:', err);
      setError(err?.message ?? '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">项目管理中心</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            管理和追踪所有项目的进度与状态
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={fetchOverview}
            disabled={loading}
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button size="sm">
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            新建项目
          </Button>
        </div>
      </div>

      {loading ? (
        /* Loading skeleton */
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="animate-pulse space-y-2">
                    <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                    <div className="h-8 w-12 bg-gray-200 dark:bg-gray-700 rounded" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-3">
                <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-10 w-full bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-10 w-full bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-10 w-full bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            </CardContent>
          </Card>
        </div>
      ) : error ? (
        /* Error state */
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-red-500 mb-2">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchOverview}>
              重试
            </Button>
          </CardContent>
        </Card>
      ) : !overview || (overview.totalProjects === 0 && overview.recentActivity.length === 0) ? (
        /* Empty state */
        <Card>
          <CardContent className="py-16 text-center">
            <FolderKanban className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">暂无项目数据</p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">点击"新建项目"开始创建你的第一个项目</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
                  <FolderKanban className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{overview.totalProjects}</p>
                  <p className="text-xs text-gray-500">总项目</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center">
                  <PlayCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{overview.activeProjects}</p>
                  <p className="text-xs text-gray-500">进行中</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-950 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{overview.completedProjects}</p>
                  <p className="text-xs text-gray-500">已完成</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-950 flex items-center justify-center">
                  <PauseCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{overview.pausedProjects}</p>
                  <p className="text-xs text-gray-500">暂停</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="w-10 h-10 rounded-lg bg-rose-100 dark:bg-rose-950 flex items-center justify-center">
                  <HeartPulse className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{overview.healthScore}%</p>
                  <p className="text-xs text-gray-500">健康度</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Health Matrix Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-blue-500" />
                项目健康矩阵
              </CardTitle>
            </CardHeader>
            <CardContent>
              {overview.healthMatrix.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">暂无项目数据</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>项目名称</TableHead>
                      <TableHead>进度</TableHead>
                      <TableHead>风险等级</TableHead>
                      <TableHead>健康状态</TableHead>
                      <TableHead>最后更新</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overview.healthMatrix.map((item) => (
                      <TableRow key={item.projectId}>
                        <TableCell>
                          <Link
                            href={`/project-hub/${item.projectId}`}
                            className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {item.projectName}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-blue-500 dark:bg-blue-400 transition-all"
                                style={{ width: `${item.progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500">{item.progress}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <RiskBadge level={item.riskLevel} />
                        </TableCell>
                        <TableCell>
                          <HealthBadge status={item.healthStatus} />
                        </TableCell>
                        <TableCell className="text-xs text-gray-400">
                          {formatRelativeTime(item.lastUpdated)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Bottom row: Deadlines + Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Upcoming Deadlines */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-500" />
                  即将到期
                </CardTitle>
              </CardHeader>
              <CardContent>
                {overview.upcomingDeadlines.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">暂无即将到期的里程碑</p>
                ) : (
                  <div className="space-y-3">
                    {overview.upcomingDeadlines.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {item.milestone}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            <Link
                              href={`/project-hub/${item.projectId}`}
                              className="hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                            >
                              {item.projectName}
                            </Link>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          <span className="text-xs text-gray-500">{formatDate(item.dueDate)}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-gray-300" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-blue-500" />
                  最近动态
                </CardTitle>
              </CardHeader>
              <CardContent>
                {overview.recentActivity.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">暂无动态</p>
                ) : (
                  <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                    {overview.recentActivity.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 py-2 px-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-gray-700 dark:text-gray-300 truncate">
                            <Link
                              href={`/project-hub/${item.projectId}`}
                              className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              {item.projectName}
                            </Link>
                            {' - '}
                            {item.action}
                          </div>
                        </div>
                        <span className="text-xs text-gray-400 shrink-0">
                          {formatRelativeTime(item.timestamp)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
