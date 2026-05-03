// ============================================================
// Project Detail Page - /project-hub/[id]
// ============================================================
//
// Detailed view of a single project with tab navigation:
// Overview, Milestones, Agents, Dependencies
// ============================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Target,
  ListTodo,
  Flag,
  Bot,
  GitBranch,
  RefreshCw,
  CheckCircle2,
  Clock,
  Circle,
  AlertTriangle,
  FileText,
  ClipboardList,
  Rocket,
  Bell,
  ChevronRight,
  Plus,
  FileBarChart,
  Activity,
  UserPlus,
} from 'lucide-react';

// ---- Types ----

interface ProjectDetail {
  id: string;
  name: string;
  description: string;
  status: string;
  progress: number;
  totalTasks: number;
  completedTasks: number;
  totalMilestones: number;
  completedMilestones: number;
  totalAgents: number;
  milestones: MilestoneItem[];
  agents: AgentItem[];
  dependencies: DependencyItem[];
  taskProgress: TaskProgressItem[];
}

interface MilestoneItem {
  id: string;
  name: string;
  status: string;
  dueDate: Date;
  description: string;
}

interface AgentItem {
  id: string;
  name: string;
  role: string;
  status: string;
  lastActive: Date;
}

interface DependencyItem {
  id: string;
  name: string;
  type: string;
  status: string;
  targetProject: string;
}

interface TaskProgressItem {
  id: string;
  name: string;
  status: string;
  assignee: string;
  progress: number;
}

// ---- Status helpers ----

function MilestoneStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <Badge variant="default" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><CheckCircle2 className="w-3 h-3 mr-1" />已完成</Badge>;
    case 'in_progress':
      return <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"><Clock className="w-3 h-3 mr-1" />进行中</Badge>;
    case 'pending':
      return <Badge variant="outline"><Circle className="w-3 h-3 mr-1" />待开始</Badge>;
    case 'overdue':
      return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />已逾期</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function TaskStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'done':
      return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    case 'in_progress':
      return <Clock className="w-4 h-4 text-blue-500" />;
    default:
      return <Circle className="w-4 h-4 text-gray-300 dark:text-gray-600" />;
  }
}

function DependencyStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'satisfied':
      return <Badge variant="default" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">已满足</Badge>;
    case 'pending':
      return <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">等待中</Badge>;
    case 'blocked':
      return <Badge variant="destructive">阻塞</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

// ---- Component ----

export default function ProjectDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportContent, setReportContent] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const fetchProject = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await trpc.projectHub.projects.get.query({ id });
      setProject(data as unknown as ProjectDetail);
    } catch (err: any) {
      console.error('Project detail fetch error:', err);
      setError(err?.message ?? '加载失败');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const generateReport = async () => {
    try {
      setReportLoading(true);
      const result = await trpc.projectHub.reports.projectReport.query({ projectId: id });
      setReportContent(result.content);
    } catch (err: any) {
      console.error('Report generation error:', err);
    } finally {
      setReportLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center gap-3">
          <div className="animate-pulse w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          <div className="animate-pulse space-y-1">
            <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
        {/* Stat cards skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
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
        {/* Content skeleton */}
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-3">
              <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-10 w-full bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-10 w-full bg-gray-200 dark:bg-gray-700 rounded" />
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
          href="/project-hub"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回项目列表
        </Link>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-red-500 mb-2">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchProject}>
              重试
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="space-y-4">
        <Link
          href="/project-hub"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回项目列表
        </Link>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-400">项目不存在或已被删除</p>
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
          href="/project-hub"
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{project.name}</h1>
          {project.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{project.description}</p>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={generateReport}
            disabled={reportLoading}
          >
            <FileBarChart className="w-3.5 h-3.5 mr-1.5" />
            {reportLoading ? '生成中...' : '生成报告'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchProject}
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            刷新
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList variant="line">
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="milestones">里程碑</TabsTrigger>
          <TabsTrigger value="agents">工作台</TabsTrigger>
          <TabsTrigger value="dependencies">依赖</TabsTrigger>
          <TabsTrigger value="worklogs">工作日志</TabsTrigger>
          <TabsTrigger value="docs">文档</TabsTrigger>
          <TabsTrigger value="activity">活动</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
                  <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{project.progress}%</p>
                  <p className="text-xs text-gray-500">进度</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center">
                  <ListTodo className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{project.completedTasks}/{project.totalTasks}</p>
                  <p className="text-xs text-gray-500">任务</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto"
                  onClick={() => { window.location.href = `/tasks?projectId=${id}`; }}
                >
                  <Plus className="w-3 h-3 mr-1" /> 创建任务
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-950 flex items-center justify-center">
                  <Flag className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{project.completedMilestones}/{project.totalMilestones}</p>
                  <p className="text-xs text-gray-500">里程碑</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-950 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{project.totalAgents}</p>
                  <p className="text-xs text-gray-500">智能体</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Progress bar */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">总体进度</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500 dark:bg-blue-400 transition-all duration-500"
                  style={{ width: `${project.progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-2">{project.progress}% 已完成</p>
            </CardContent>
          </Card>

          {/* Milestone Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flag className="w-4 h-4 text-blue-500" />
                里程碑时间线
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(project.milestones?.length ?? 0) === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">暂无里程碑</p>
              ) : (
                <div className="relative space-y-4">
                  {/* Timeline line */}
                  <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-gray-200 dark:bg-gray-700" />
                  {(project.milestones ?? []).map((milestone) => (
                    <div key={milestone.id} className="relative flex items-start gap-4 pl-1">
                      <div className={`w-[7px] h-[7px] rounded-full mt-1.5 shrink-0 z-10 ${
                        milestone.status === 'completed'
                          ? 'bg-emerald-500'
                          : milestone.status === 'in_progress'
                            ? 'bg-blue-500'
                            : milestone.status === 'overdue'
                              ? 'bg-red-500'
                              : 'bg-gray-300 dark:bg-gray-600'
                      }`} />
                      <div className="flex-1 flex items-center justify-between py-1.5">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{milestone.name}</p>
                          {milestone.description && (
                            <p className="text-xs text-gray-400 mt-0.5">{milestone.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          <span className="text-xs text-gray-400">{formatDate(milestone.dueDate)}</span>
                          <MilestoneStatusBadge status={milestone.status} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Task Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListTodo className="w-4 h-4 text-blue-500" />
                任务进度
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(project.taskProgress?.length ?? 0) === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">暂无任务</p>
              ) : (
                <div className="space-y-2">
                  {(project.taskProgress ?? []).map((task) => (
                    <div key={task.id} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                      <TaskStatusIcon status={task.status} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{task.name}</p>
                        <p className="text-xs text-gray-400">{task.assignee}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue-500 dark:bg-blue-400"
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 w-8 text-right">{task.progress}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Report Preview */}
          {reportContent && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileBarChart className="w-4 h-4 text-blue-500" />
                    项目报告
                  </CardTitle>
                  <Button size="sm" variant="ghost" onClick={() => setReportContent(null)}>
                    关闭
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 overflow-auto max-h-[500px]">
                  {reportContent}
                </div>
              </CardContent>
            </Card>
          )}

          {/* System Management */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">系统管理</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Link href={`/project-hub/${id}/workflows`}>
                  <div className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center shrink-0">
                      <GitBranch className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">工作流</p>
                      <p className="text-xs text-gray-400">自动化工作流管理</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0" />
                  </div>
                </Link>

                <Link href={`/project-hub/${id}/deployments`}>
                  <div className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer">
                    <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-950 flex items-center justify-center shrink-0">
                      <Rocket className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">部署</p>
                      <p className="text-xs text-gray-400">部署和发布管理</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0" />
                  </div>
                </Link>

                <Link href={`/project-hub/${id}/notifications`}>
                  <div className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer">
                    <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-950 flex items-center justify-center shrink-0">
                      <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">通知</p>
                      <p className="text-xs text-gray-400">通知和提醒管理</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0" />
                  </div>
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Milestones Tab */}
        <TabsContent value="milestones" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flag className="w-4 h-4 text-blue-500" />
                所有里程碑
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(project.milestones?.length ?? 0) === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">暂无里程碑</p>
              ) : (
                <div className="space-y-3">
                  {(project.milestones ?? []).map((milestone) => (
                    <div
                      key={milestone.id}
                      className="flex items-center justify-between py-3 px-4 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{milestone.name}</p>
                        {milestone.description && (
                          <p className="text-xs text-gray-400 mt-0.5">{milestone.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-gray-400">{formatDate(milestone.dueDate)}</span>
                        <MilestoneStatusBadge status={milestone.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Agents Tab */}
        <TabsContent value="agents" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-blue-500" />
                项目智能体
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(project.agents?.length ?? 0) === 0 ? (
                <div className="text-center py-8">
                  <Bot className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-400 dark:text-gray-500">暂未分配智能体</p>
                  <Link href={`/project-hub/${id}/team`}>
                    <Button size="sm" className="mt-3">
                      <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                      前往工作台分配
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {(project.agents ?? []).slice(0, 1).map((agent) => (
                    <div
                      key={agent.id}
                      className="flex items-center justify-between py-3 px-4 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
                          <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{agent.name}</p>
                          <p className="text-xs text-gray-400">{agent.role}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <Badge
                          variant={agent.status === 'active' ? 'default' : 'outline'}
                          className={agent.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : ''}
                        >
                          {agent.status === 'active' ? '活跃' : '离线'}
                        </Badge>
                        <Link href={`/project-hub/${id}/team`}>
                          <Button variant="outline" size="sm">查看工作台</Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Dependencies Tab */}
        <TabsContent value="dependencies" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-blue-500" />
                项目依赖
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(project.dependencies?.length ?? 0) === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">暂无依赖关系</p>
              ) : (
                <div className="space-y-3">
                  {(project.dependencies ?? []).map((dep) => (
                    <div
                      key={dep.id}
                      className="flex items-center justify-between py-3 px-4 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{dep.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {dep.type === 'internal' ? '内部依赖' : '外部依赖'} - {dep.targetProject}
                        </p>
                      </div>
                      <DependencyStatusBadge status={dep.status} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Work Logs Tab */}
        <TabsContent value="worklogs" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-amber-500" />
                工作日志
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-400 py-4 text-center">
                前往<Link href={`/project-hub/${id}/team`} className="text-blue-500 hover:underline mx-1">智能体工作台</Link>查看完整的工作负载和工作日志
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Docs Tab */}
        <TabsContent value="docs" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-500" />
                项目文档
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center py-8 gap-3">
                <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600" />
                <p className="text-sm text-gray-400">前往文档管理页面查看和管理项目文档</p>
                <Link href={`/project-hub/${id}/docs`}>
                  <Button size="sm">
                    <FileText className="w-3.5 h-3.5 mr-1.5" />
                    打开文档管理
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-500" />
                项目活动
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center py-8 gap-3">
                <Activity className="w-12 h-12 text-gray-300 dark:text-gray-600" />
                <p className="text-sm text-gray-400">前往活动页面查看完整的项目活动时间线</p>
                <Link href={`/project-hub/${id}/activity`}>
                  <Button size="sm">
                    <Activity className="w-3.5 h-3.5 mr-1.5" />
                    查看活动
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
