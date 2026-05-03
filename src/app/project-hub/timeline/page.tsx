// ============================================================
// Timeline Page - /project-hub/timeline
// ============================================================
//
// Project timeline view with two tabs:
//   - 时间线视图 (default): Traditional milestone timeline
//   - 甘特图视图: CSS-based gantt chart with milestones
// ============================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/lib/trpc/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  GanttChart,
  Flag,
  CheckCircle2,
  Clock,
  Circle,
  AlertTriangle,
  RefreshCw,
  List,
  LayoutGrid,
} from 'lucide-react';

// ---- Types ----

interface ProjectItem {
  id: string;
  name: string;
  description: string;
  status: string;
  phase: string;
  progress: number;
  startDate: string;
  endDate: string;
  milestones?: MilestoneItem[];
}

interface MilestoneItem {
  id: string;
  title: string;
  status: string;
  dueDate: string;
  description: string;
}

// ---- Status helpers ----

function MilestoneStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    case 'in_progress':
      return <Clock className="w-4 h-4 text-blue-500" />;
    case 'overdue':
      return <AlertTriangle className="w-4 h-4 text-red-500" />;
    default:
      return <Circle className="w-4 h-4 text-gray-300 dark:text-gray-600" />;
  }
}

function ProjectPhaseBadge({ phase }: { phase: string }) {
  const phaseColors: Record<string, string> = {
    planning: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    development: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
    testing: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    deployment: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    completed: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  };
  const phaseLabels: Record<string, string> = {
    planning: '规划中',
    development: '开发中',
    testing: '测试中',
    deployment: '部署中',
    completed: '已完成',
  };
  return (
    <Badge variant="outline" className={phaseColors[phase] || ''}>
      {phaseLabels[phase] || phase}
    </Badge>
  );
}

function formatDate(date: string): string {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

// ---- Timeline View Component (original) ----

function ProjectTimeline({ project }: { project: ProjectItem }) {
  const [milestones, setMilestones] = useState<MilestoneItem[]>([]);

  const fetchMilestones = useCallback(async () => {
    try {
      const data = await trpc.projectHub.milestones.list.query({
        projectId: project.id,
      });
      setMilestones(data as unknown as MilestoneItem[]);
    } catch (err) {
      console.error('Failed to fetch milestones:', err);
    }
  }, [project.id]);

  useEffect(() => {
    fetchMilestones();
  }, [fetchMilestones]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
              <GanttChart className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-base">{project.name}</CardTitle>
              <p className="text-xs text-gray-400 mt-0.5">{project.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ProjectPhaseBadge phase={project.phase} />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{project.progress}%</span>
          </div>
        </div>
        {/* Progress bar */}
        <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden mt-2">
          <div
            className="h-full rounded-full bg-blue-500 dark:bg-blue-400 transition-all duration-500"
            style={{ width: `${project.progress}%` }}
          />
        </div>
      </CardHeader>
      <CardContent>
        {(milestones?.length ?? 0) === 0 ? (
          <p className="text-sm text-gray-400 py-2 text-center">暂无里程碑</p>
        ) : (
          <div className="relative space-y-3">
            {/* Timeline line */}
            <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-gray-200 dark:bg-gray-700" />
            {(milestones ?? []).map((milestone) => (
              <div key={milestone.id} className="relative flex items-start gap-3 pl-1">
                <div className="shrink-0 z-10 mt-0.5">
                  <MilestoneStatusIcon status={milestone.status} />
                </div>
                <div className="flex-1 flex items-center justify-between py-1">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{milestone.title}</p>
                    {milestone.description && (
                      <p className="text-xs text-gray-400 mt-0.5">{milestone.description}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 shrink-0 ml-3">{formatDate(milestone.dueDate)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---- Gantt Chart View Component (CSS-based) ----

function GanttChartView({ projects }: { projects: ProjectItem[] }) {
  // Calculate date range from all milestones
  const allDates = projects.flatMap(
    (p) => (p.milestones || []).map((m) => new Date(m.dueDate)),
  );
  const minDate =
    allDates.length > 0
      ? new Date(Math.min(...allDates.map((d) => d.getTime())))
      : new Date();
  const maxDate =
    allDates.length > 0
      ? new Date(Math.max(...allDates.map((d) => d.getTime())))
      : new Date();

  // Add padding: 3 days before, 7 days after
  const startDate = new Date(minDate);
  startDate.setDate(startDate.getDate() - 3);
  const endDate = new Date(maxDate);
  endDate.setDate(endDate.getDate() + 7);

  const totalDays = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / 86400000,
  );
  const dayWidth = 40; // px per day

  // Status color map for milestone dots
  const milestoneColors: Record<string, string> = {
    completed: 'bg-emerald-500',
    in_progress: 'bg-blue-500',
    overdue: 'bg-red-500',
    pending: 'bg-gray-300 dark:bg-gray-600',
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto" style={{ maxHeight: '600px' }}>
        <div
          className="min-w-full"
          style={{ width: `${totalDays * dayWidth + 200}px` }}
        >
          {/* Header with date columns */}
          <div className="flex border-b bg-gray-50 dark:bg-gray-800/50 sticky top-0 z-10">
            <div className="w-[200px] shrink-0 p-2 text-xs font-medium text-gray-500 border-r dark:border-gray-700">
              项目
            </div>
            <div className="flex-1 relative h-[32px]">
              {Array.from({ length: totalDays }).map((_, i) => {
                const date = new Date(startDate);
                date.setDate(date.getDate() + i);
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                const isMonday = date.getDay() === 1;
                return (
                  <div
                    key={i}
                    className={`absolute top-0 bottom-0 border-l ${
                      isWeekend
                        ? 'bg-gray-100 dark:bg-gray-900'
                        : ''
                    } ${
                      isMonday
                        ? 'border-gray-300 dark:border-gray-600'
                        : 'border-gray-100 dark:border-gray-800'
                    }`}
                    style={{
                      left: `${i * dayWidth}px`,
                      width: `${dayWidth}px`,
                    }}
                  >
                    {isMonday && (
                      <span className="text-[10px] text-gray-400 ml-1">
                        {date.getMonth() + 1}/{date.getDate()}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Project rows */}
          {projects.map((project) => (
            <div
              key={project.id}
              className="flex border-b hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
            >
              {/* Project name column */}
              <div className="w-[200px] shrink-0 p-2 border-r dark:border-gray-800">
                <p className="text-sm font-medium truncate text-gray-900 dark:text-gray-100">
                  {project.name}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-500 dark:bg-blue-400"
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 shrink-0">
                    {project.progress}%
                  </span>
                </div>
              </div>

              {/* Timeline area */}
              <div className="flex-1 relative h-[48px]">
                {/* Progress bar */}
                {project.startDate && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 h-4 bg-blue-200 dark:bg-blue-900 rounded opacity-60"
                    style={{
                      left: `${Math.max(
                        0,
                        (new Date(project.startDate).getTime() -
                          startDate.getTime()) /
                          86400000,
                      ) * dayWidth}px`,
                      width: `${Math.max(
                        20,
                        ((new Date(
                          project.endDate || project.startDate,
                        ).getTime() -
                          new Date(project.startDate).getTime()) /
                          86400000) *
                          dayWidth,
                      )}px`,
                    }}
                  />
                )}

                {/* Milestone dots */}
                {(project.milestones || []).map((ms) => {
                  const msDate = new Date(ms.dueDate);
                  const dayOffset =
                    (msDate.getTime() - startDate.getTime()) / 86400000;
                  return (
                    <div
                      key={ms.id}
                      className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full ${
                        milestoneColors[ms.status] ||
                        milestoneColors.pending
                      } cursor-pointer group z-[5]`}
                      style={{ left: `${dayOffset * dayWidth}px` }}
                      title={`${ms.title} (${ms.status})`}
                    >
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-900 text-white text-[10px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                        {ms.title}
                        <span className="ml-1 text-gray-400">
                          ({formatDate(ms.dueDate)})
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Empty state */}
          {projects.length === 0 && (
            <div className="py-12 text-center text-gray-400 text-sm">
              暂无项目数据
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-t bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500">
        <span className="font-medium">里程碑状态:</span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          已完成
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          进行中
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
          已逾期
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-gray-600" />
          待处理
        </span>
        <span className="flex items-center gap-1 ml-2">
          <span className="w-6 h-2 rounded bg-blue-200 dark:bg-blue-900 opacity-60" />
          项目周期
        </span>
      </div>
    </div>
  );
}

// ---- Main Page Component ----

type ViewMode = 'timeline' | 'gantt';

export default function TimelinePage() {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');

  const fetchProjects = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await trpc.projectHub.projects.list.query({});
      const items = (data as any)?.items ?? [];

      // Fetch milestones for each project for gantt view
      const projectsWithMilestones = await Promise.all(
        items.map(async (project: ProjectItem) => {
          try {
            const milestones = await trpc.projectHub.milestones.list.query({
              projectId: project.id,
            });
            return { ...project, milestones: milestones as unknown as MilestoneItem[] };
          } catch {
            return { ...project, milestones: [] };
          }
        }),
      );

      setProjects(projectsWithMilestones);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            项目时间线
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            查看所有项目的里程碑时间线与甘特图
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View mode tabs */}
          <div className="flex items-center border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('timeline')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'timeline'
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                  : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              时间线视图
            </button>
            <button
              onClick={() => setViewMode('gantt')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors border-l ${
                viewMode === 'gantt'
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                  : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              甘特图视图
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={() => fetchProjects()}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            刷新
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                    <div className="space-y-1">
                      <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded" />
                      <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                    </div>
                  </div>
                  <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="space-y-2 mt-3">
                    <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded" />
                    <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (projects?.length ?? 0) === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <GanttChart className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p className="text-sm text-gray-400">暂无项目</p>
          </CardContent>
        </Card>
      ) : viewMode === 'timeline' ? (
        /* Timeline view */
        <div className="space-y-6">
          {(projects ?? []).map((project) => (
            <ProjectTimeline key={project.id} project={project} />
          ))}
        </div>
      ) : (
        /* Gantt chart view */
        <GanttChartView projects={projects} />
      )}
    </div>
  );
}
