// ============================================================
// Timeline Page - /project-hub/timeline
// ============================================================
//
// Simple project timeline view showing all projects and their
// milestones. Full gantt chart with @xyflow/react can be added later.
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

// ---- Component ----

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
        {milestones.length === 0 ? (
          <p className="text-sm text-gray-400 py-2 text-center">暂无里程碑</p>
        ) : (
          <div className="relative space-y-3">
            {/* Timeline line */}
            <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-gray-200 dark:bg-gray-700" />
            {milestones.map((milestone) => (
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

export default function TimelinePage() {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await trpc.projectHub.projects.list.query({});
      setProjects((data as any)?.items ?? []);
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">项目时间线</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            查看所有项目的里程碑时间线
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchProjects()}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            刷新
          </Button>
        </div>
      </div>

      {/* Note about future gantt chart */}
      <Card className="border-dashed border-blue-300 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
        <CardContent className="py-3 flex items-center gap-3">
          <GanttChart className="w-5 h-5 text-blue-500 shrink-0" />
          <p className="text-xs text-blue-600 dark:text-blue-400">
            当前为简化时间线视图。完整的甘特图功能（基于 @xyflow/react）将在后续版本中提供。
          </p>
        </CardContent>
      </Card>

      {/* Project timelines */}
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
      ) : projects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <GanttChart className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p className="text-sm text-gray-400">暂无项目</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {projects.map((project) => (
            <ProjectTimeline key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
