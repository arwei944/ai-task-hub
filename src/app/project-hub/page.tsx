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
  Archive,
  RotateCcw,
  Eye,
  EyeOff,
  X,
  Bot,
  Loader2,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  Zap,
  Code,
  Brain,
  Wrench,
  MessageSquare,
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

// ---- Create Dialog Constants ----

const AGENT_TYPES = [
  { value: 'claude', label: 'Claude' },
  { value: 'trae', label: 'Trae' },
  { value: 'cursor', label: 'Cursor' },
  { value: 'chatgpt', label: 'ChatGPT' },
  { value: 'api', label: 'API' },
];

const AGENT_ROLES = [
  { value: '全栈开发', label: '全栈开发' },
  { value: 'UI设计', label: 'UI设计' },
  { value: '后端开发', label: '后端开发' },
  { value: '数据分析', label: '数据分析' },
  { value: '项目管理', label: '项目管理' },
];

const CAPABILITY_OPTIONS = [
  { value: 'React', label: 'React', icon: Code },
  { value: 'TypeScript', label: 'TypeScript', icon: Code },
  { value: 'Python', label: 'Python', icon: Brain },
  { value: 'Node.js', label: 'Node.js', icon: Code },
  { value: 'UI设计', label: 'UI设计', icon: Wrench },
  { value: 'API开发', label: 'API开发', icon: Code },
  { value: '数据库', label: '数据库', icon: Wrench },
  { value: 'DevOps', label: 'DevOps', icon: Wrench },
];

// ---- Component ----

export default function ProjectHubDashboardPage() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedProjects, setArchivedProjects] = useState<any[]>([]);

  // Create dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2>(1);
  const [agentForm, setAgentForm] = useState({
    name: '',
    clientType: 'claude',
    role: '全栈开发',
    capabilities: [] as string[],
  });
  const [projectForm, setProjectForm] = useState({
    name: '',
    description: '',
    priority: 'high',
    techStack: '',
  });
  const [creating, setCreating] = useState(false);

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

  const fetchArchivedProjects = useCallback(async () => {
    try {
      const data = await trpc.projectHub.projects.list.query({ status: 'archived' });
      setArchivedProjects((data as any)?.items ?? []);
    } catch (err) {
      console.error('Failed to fetch archived projects:', err);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    if (showArchived) {
      fetchArchivedProjects();
    }
  }, [showArchived, fetchArchivedProjects]);

  const handleArchive = async (projectId: string) => {
    try {
      setArchivingId(projectId);
      await trpc.projectHub.projects.archive.mutate({ id: projectId });
      await fetchOverview();
    } catch (err) {
      console.error('Failed to archive project:', err);
    } finally {
      setArchivingId(null);
    }
  };

  const handleRestore = async (projectId: string) => {
    try {
      setArchivingId(projectId);
      await trpc.projectHub.projects.update.mutate({ id: projectId, status: 'active' });
      await fetchOverview();
      await fetchArchivedProjects();
    } catch (err) {
      console.error('Failed to restore project:', err);
    } finally {
      setArchivingId(null);
    }
  };

  const resetCreateDialog = () => {
    setCreateStep(1);
    setAgentForm({ name: '', clientType: 'claude', role: '全栈开发', capabilities: [] });
    setProjectForm({ name: '', description: '', priority: 'high', techStack: '' });
    setCreating(false);
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      // Create project with agent in one call
      await trpc.projectHub.projects.createWithAgent.mutate({
        name: projectForm.name,
        description: projectForm.description || undefined,
        priority: projectForm.priority as 'high' | 'medium' | 'low',
        techStack: projectForm.techStack ? projectForm.techStack.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        agentName: agentForm.name,
        agentClientType: agentForm.clientType,
        agentRole: agentForm.role,
        agentCapabilities: agentForm.capabilities.length > 0 ? agentForm.capabilities : undefined,
      });
      setShowCreateDialog(false);
      resetCreateDialog();
      await fetchOverview();
    } catch (err) {
      console.error('Create failed:', err);
    } finally {
      setCreating(false);
    }
  };

  const toggleCapability = (cap: string) => {
    setAgentForm(prev => ({
      ...prev,
      capabilities: prev.capabilities.includes(cap)
        ? prev.capabilities.filter(c => c !== cap)
        : [...prev.capabilities, cap],
    }));
  };

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
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
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
      ) : !overview || (overview.totalProjects === 0 && (overview.recentActivity?.length ?? 0) === 0) ? (
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
              {(overview.healthMatrix?.length ?? 0) === 0 ? (
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
                      <TableHead className="w-[80px]">操作</TableHead>
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
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-gray-400 hover:text-amber-600 dark:hover:text-amber-400"
                            onClick={() => handleArchive(item.projectId)}
                            disabled={archivingId === item.projectId}
                            title="归档项目"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </Button>
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
                {(overview.upcomingDeadlines?.length ?? 0) === 0 ? (
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
                {(overview.recentActivity?.length ?? 0) === 0 ? (
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

          {/* Archived Projects Section */}
          <Card className="border-dashed">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Archive className="w-4 h-4 text-gray-400" />
                  已归档项目
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setShowArchived(!showArchived)}
                >
                  {showArchived ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5 mr-1" />
                      隐藏
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5 mr-1" />
                      显示
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            {showArchived && (
              <CardContent>
                {archivedProjects.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">暂无已归档项目</p>
                ) : (
                  <div className="space-y-2">
                    {archivedProjects.map((project: any) => (
                      <div
                        key={project.id}
                        className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                      >
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/project-hub/${project.id}`}
                            className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400"
                          >
                            {project.name}
                          </Link>
                          {project.description && (
                            <p className="text-xs text-gray-400 mt-0.5 truncate">
                              {project.description}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 shrink-0 ml-3"
                          onClick={() => handleRestore(project.id)}
                          disabled={archivingId === project.id}
                          title="恢复项目"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        </>
      )}

      {renderCreateDialog()}
    </div>
  );

  // ---- Create Project with Agent Dialog ----
  function renderCreateDialog() {
    if (!showCreateDialog) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={() => { setShowCreateDialog(false); resetCreateDialog(); }}
        />
        {/* Dialog */}
        <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 w-full max-w-lg mx-4 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">新建项目</h2>
            <button
              onClick={() => { setShowCreateDialog(false); resetCreateDialog(); }}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Step Indicator */}
          <div className="px-6 pt-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCreateStep(1)}
                className="flex items-center gap-2 text-sm"
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                  createStep >= 1
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                }`}>
                  {createStep > 1 ? <CheckCircle2 className="w-3.5 h-3.5" /> : '1'}
                </span>
                <span className={createStep >= 1 ? 'text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-400'}>
                  注册智能体身份
                </span>
              </button>
              <div className={`flex-1 h-px ${createStep >= 2 ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
              <button
                onClick={() => { if (agentForm.name.trim()) setCreateStep(2); }}
                className="flex items-center gap-2 text-sm"
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                  createStep >= 2
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                }`}>
                  2
                </span>
                <span className={createStep >= 2 ? 'text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-400'}>
                  项目信息
                </span>
              </button>
            </div>
          </div>

          {/* Step Content */}
          <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
            {createStep === 1 ? (
              /* Step 1: Register Agent Identity */
              <>
                <div className="flex items-center gap-2 mb-2">
                  <Bot className="w-5 h-5 text-blue-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">注册智能体身份</span>
                </div>
                <p className="text-xs text-gray-400 mb-4">为项目创建一个专属智能体，它将负责项目的开发工作</p>

                {/* Agent Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    智能体名称 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={agentForm.name}
                    onChange={(e) => setAgentForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="例如: Claude-3.5-Sonnet"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                  />
                </div>

                {/* Agent Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    智能体类型 <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {AGENT_TYPES.map((type) => (
                      <button
                        key={type.value}
                        onClick={() => setAgentForm(prev => ({ ...prev, clientType: type.value }))}
                        className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                          agentForm.clientType === type.value
                            ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-500'
                            : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Agent Role */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    智能体角色 <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {AGENT_ROLES.map((role) => (
                      <button
                        key={role.value}
                        onClick={() => setAgentForm(prev => ({ ...prev, role: role.value }))}
                        className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                          agentForm.role === role.value
                            ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-500'
                            : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                      >
                        {role.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Capabilities */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    能力标签
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {CAPABILITY_OPTIONS.map((cap) => {
                      const isSelected = agentForm.capabilities.includes(cap.value);
                      const Icon = cap.icon;
                      return (
                        <button
                          key={cap.value}
                          onClick={() => toggleCapability(cap.value)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                            isSelected
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-500'
                              : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                          }`}
                        >
                          <Icon className="w-3 h-3" />
                          {cap.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              /* Step 2: Project Info */
              <>
                <div className="flex items-center gap-2 mb-2">
                  <FolderKanban className="w-5 h-5 text-blue-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">项目信息</span>
                </div>
                <p className="text-xs text-gray-400 mb-4">填写项目基本信息，智能体 {agentForm.name} 将自动分配到此项目</p>

                {/* Project Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    项目名称 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={projectForm.name}
                    onChange={(e) => setProjectForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="例如: AI Task Hub v6"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    项目描述
                  </label>
                  <textarea
                    value={projectForm.description}
                    onChange={(e) => setProjectForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="简要描述项目目标和范围..."
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow resize-none"
                  />
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    优先级
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'high', label: '高', color: 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 dark:border-red-500' },
                      { value: 'medium', label: '中', color: 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-500' },
                      { value: 'low', label: '低', color: 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-500' },
                    ].map((p) => (
                      <button
                        key={p.value}
                        onClick={() => setProjectForm(prev => ({ ...prev, priority: p.value }))}
                        className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                          projectForm.priority === p.value
                            ? p.color
                            : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tech Stack */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    技术栈
                  </label>
                  <input
                    type="text"
                    value={projectForm.techStack}
                    onChange={(e) => setProjectForm(prev => ({ ...prev, techStack: e.target.value }))}
                    placeholder="逗号分隔，例如: React, TypeScript, Prisma"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                  />
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
            <div>
              {createStep === 2 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCreateStep(1)}
                  disabled={creating}
                >
                  <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                  上一步
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setShowCreateDialog(false); resetCreateDialog(); }}
                disabled={creating}
              >
                取消
              </Button>
              {createStep === 1 ? (
                <Button
                  size="sm"
                  onClick={() => setCreateStep(2)}
                  disabled={!agentForm.name.trim()}
                >
                  下一步
                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleCreate}
                  disabled={!projectForm.name.trim() || creating}
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      创建中...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                      创建项目
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
}
