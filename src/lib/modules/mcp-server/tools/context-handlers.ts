// ============================================================
// Context Aggregation MCP Tool Handlers
// ============================================================
//
// Handlers that aggregate project/task state into comprehensive
// context objects for AI agents.
//

import type { ILogger, IEventBus } from '@/lib/core/types';
import { getPrisma } from '@/lib/db';
import type { PrismaClient } from '@/generated/prisma/client';

const PHASE_ORDER = [
  'requirements', 'planning', 'architecture',
  'implementation', 'testing', 'deployment', 'completed',
];

/**
 * Create handlers for context aggregation tools
 */
export function createContextToolHandlers(
  logger: ILogger,
  _eventBus?: IEventBus,
  prismaFn?: () => PrismaClient,
) {
  const getDb = prismaFn ?? getPrisma;

  return {
    get_project_context: async (args: Record<string, unknown>) => {
      const {
        projectId,
        includeTasks = false,
        includeRequirements = false,
        includeRecentActivity = true,
      } = args as {
        projectId: string;
        includeTasks?: boolean;
        includeRequirements?: boolean;
        includeRecentActivity?: boolean;
      };

      const prisma = getDb();
      try {
        // Fetch project basic info
        const project = await prisma.project.findUnique({
          where: { id: projectId },
        });

        if (!project) {
          throw new Error(`Project not found: ${projectId}`);
        }

        // Fetch task statistics
        const tasks = await prisma.task.findMany({
          where: { projectId },
          include: includeTasks ? {
            tags: { include: { tag: true } },
            _count: { select: { subTasks: true } },
          } : undefined,
        });

        const taskStats = {
          total: tasks.length,
          todo: tasks.filter((t: any) => t.status === 'todo').length,
          inProgress: tasks.filter((t: any) => t.status === 'in_progress').length,
          done: tasks.filter((t: any) => t.status === 'done').length,
          closed: tasks.filter((t: any) => t.status === 'closed').length,
          blocked: tasks.filter((t: any) => {
            const dueDate = t.dueDate;
            return dueDate && new Date(dueDate) < new Date() && t.status !== 'done' && t.status !== 'closed';
          }).length,
          byPriority: {
            urgent: tasks.filter((t: any) => t.priority === 'urgent').length,
            high: tasks.filter((t: any) => t.priority === 'high').length,
            medium: tasks.filter((t: any) => t.priority === 'medium').length,
            low: tasks.filter((t: any) => t.priority === 'low').length,
          },
        };

        // Fetch requirement statistics
        const requirements = await prisma.requirement.findMany({
          where: { projectId },
          include: includeRequirements ? {
            tags: true,
            children: true,
          } : undefined,
        });

        const reqStats = {
          total: requirements.length,
          draft: requirements.filter((r: any) => r.status === 'draft').length,
          reviewing: requirements.filter((r: any) => r.status === 'reviewing').length,
          approved: requirements.filter((r: any) => r.status === 'approved').length,
          implemented: requirements.filter((r: any) => r.status === 'implemented').length,
          verified: requirements.filter((r: any) => r.status === 'verified').length,
          rejected: requirements.filter((r: any) => r.status === 'rejected').length,
          byType: {
            feature: requirements.filter((r: any) => r.type === 'feature').length,
            bug: requirements.filter((r: any) => r.type === 'bug').length,
            improvement: requirements.filter((r: any) => r.type === 'improvement').length,
            epic: requirements.filter((r: any) => r.type === 'epic').length,
          },
        };

        // Fetch test statistics
        const testCases = await prisma.testCase.findMany({
          where: { projectId },
          include: {
            _count: { select: { executions: true } },
          },
        });

        const testStats = {
          total: testCases.length,
          byStatus: {
            draft: testCases.filter((t: any) => t.status === 'draft').length,
            ready: testCases.filter((t: any) => t.status === 'ready').length,
            passed: testCases.filter((t: any) => t.status === 'passed').length,
            failed: testCases.filter((t: any) => t.status === 'failed').length,
            skipped: testCases.filter((t: any) => t.status === 'skipped').length,
            blocked: testCases.filter((t: any) => t.status === 'blocked').length,
          },
          passRate: testCases.length > 0
            ? Math.round((testCases.filter((t: any) => t.status === 'passed').length / testCases.length) * 100)
            : 0,
        };

        // Fetch recent activities
        let recentActivities: any[] = [];
        if (includeRecentActivity) {
          recentActivities = await prisma.activityLog.findMany({
            where: { projectId },
            orderBy: { createdAt: 'desc' },
            take: 10,
            include: {
              agent: { select: { id: true, name: true, clientType: true } },
            },
          });
        }

        // Compute available transitions for current phase
        const currentPhaseIndex = PHASE_ORDER.indexOf(project.phase);
        const availableTransitions: string[] = [];
        if (currentPhaseIndex >= 0 && currentPhaseIndex < PHASE_ORDER.length - 1) {
          availableTransitions.push(PHASE_ORDER[currentPhaseIndex + 1]);
        }
        // Allow going back to previous phase
        if (currentPhaseIndex > 0) {
          availableTransitions.push(PHASE_ORDER[currentPhaseIndex - 1]);
        }

        // Compute risk alerts
        const risks: string[] = [];
        const blockedTasks = tasks.filter((t: any) => t.status === 'in_progress' && t.dueDate && new Date(t.dueDate) < new Date());
        if (blockedTasks.length > 0) {
          risks.push(`${blockedTasks.length} 个进行中的任务已过期`);
        }
        const highPriorityTodo = tasks.filter((t: any) => t.priority === 'urgent' && t.status === 'todo');
        if (highPriorityTodo.length > 0) {
          risks.push(`${highPriorityTodo.length} 个紧急任务待处理`);
        }
        const failedTests = testCases.filter((t: any) => t.status === 'failed');
        if (failedTests.length > 0) {
          risks.push(`${failedTests.length} 个测试用例失败`);
        }
        const reviewingReqs = requirements.filter((r: any) => r.status === 'reviewing');
        if (reviewingReqs.length > 0) {
          risks.push(`${reviewingReqs.length} 个需求等待审核`);
        }

        // Overall progress
        const overallProgress = currentPhaseIndex >= 0
          ? Math.round((currentPhaseIndex / (PHASE_ORDER.length - 1)) * 100)
          : 0;

        return {
          basicInfo: {
            id: project.id,
            name: project.name,
            description: project.description,
            phase: project.phase,
            status: project.status,
            priority: project.priority,
            techStack: project.techStack ? JSON.parse(project.techStack) : null,
            createdAt: project.createdAt,
            startedAt: project.startedAt,
            completedAt: project.completedAt,
          },
          overallProgress,
          taskStats,
          ...(includeTasks && { tasks: tasks.map((t: any) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            priority: t.priority,
            phase: t.phase,
            progress: t.progress,
            dueDate: t.dueDate,
            assignee: t.assignee,
            tags: (t as any).tags?.map((tt: any) => tt.tag.name) ?? [],
            subTaskCount: (t as any)._count?.subTasks ?? 0,
          })) }),
          reqStats,
          ...(includeRequirements && { requirements: requirements.map((r: any) => ({
            id: r.id,
            title: r.title,
            type: r.type,
            status: r.status,
            priority: r.priority,
            complexity: r.complexity,
            childCount: (r as any).children?.length ?? 0,
          })) }),
          testStats,
          ...(includeRecentActivity && { recentActivities }),
          availableTransitions,
          risks,
        };
      } finally {
        await prisma.$disconnect();
      }
    },

    get_task_context: async (args: Record<string, unknown>) => {
      const { taskId } = args as { taskId: string };

      const prisma = getDb();
      try {
        // Fetch task with basic relations
        const task = await prisma.task.findUnique({
          where: { id: taskId },
          include: {
            tags: { include: { tag: true } },
            project: {
              select: { id: true, name: true, phase: true },
            },
          },
        });

        if (!task) {
          throw new Error(`Task not found: ${taskId}`);
        }

        // Fetch sub-tasks
        const subTasks = await prisma.task.findMany({
          where: { parentTaskId: taskId },
          orderBy: { createdAt: 'desc' },
        });

        // Fetch dependencies (tasks this task depends on)
        const dependencies = await prisma.taskDependency.findMany({
          where: { taskId },
          include: {
            dependsOn: {
              select: { id: true, title: true, status: true, priority: true },
            },
          },
        });

        // Fetch dependents (tasks that depend on this task)
        const dependents = await prisma.taskDependency.findMany({
          where: { dependsOnId: taskId },
          include: {
            task: {
              select: { id: true, title: true, status: true, priority: true },
            },
          },
        });

        // Fetch execution history (recent 5 status changes)
        const history = await prisma.taskHistory.findMany({
          where: { taskId },
          orderBy: { createdAt: 'desc' },
          take: 5,
        });

        // Fetch related test cases
        const relatedTests = await prisma.testCase.findMany({
          where: { taskId },
          include: {
            _count: { select: { executions: true } },
          },
        });

        // Check if task was created from a requirement
        let relatedRequirement = null;
        if (task.projectId) {
          // Try to find a requirement mapped to this task via activity log or metadata
          const activity = await prisma.activityLog.findFirst({
            where: {
              taskId: task.id,
              action: 'task_created',
            },
            orderBy: { createdAt: 'desc' },
          });

          if (activity?.details) {
            try {
              const details = JSON.parse(activity.details);
              if (details.requirementId) {
                relatedRequirement = await prisma.requirement.findUnique({
                  where: { id: details.requirementId },
                  select: { id: true, title: true, status: true, type: true },
                });
              }
            } catch {
              // details may not be valid JSON
            }
          }
        }

        // Compute risk indicators
        const risks: string[] = [];
        if (task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done' && task.status !== 'closed') {
          risks.push('任务已过期');
        }
        if (dependencies.some((d: any) => d.dependsOn.status !== 'done' && d.dependsOn.status !== 'closed')) {
          const pendingDeps = dependencies.filter((d: any) => d.dependsOn.status !== 'done' && d.dependsOn.status !== 'closed');
          risks.push(`${pendingDeps.length} 个前置任务未完成`);
        }
        if (dependents.length > 0 && task.status !== 'done') {
          risks.push(`${dependents.length} 个后续任务被阻塞`);
        }

        return {
          basicInfo: {
            id: task.id,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            type: task.type,
            phase: task.phase,
            progress: task.progress,
            source: task.source,
            assignee: task.assignee,
            creator: task.creator,
            dueDate: task.dueDate,
            startedAt: task.startedAt,
            completedAt: task.completedAt,
            createdAt: task.createdAt,
            updatedAt: task.updatedAt,
            tags: task.tags.map((tt: any) => tt.tag.name),
            project: task.project ? {
              id: task.project.id,
              name: task.project.name,
              phase: task.project.phase,
            } : null,
          },
          relatedRequirement,
          subTasks: subTasks.map((st: any) => ({
            id: st.id,
            title: st.title,
            status: st.status,
            priority: st.priority,
            progress: st.progress,
          })),
          dependencies: {
            dependsOn: dependencies.map((d: any) => ({
              id: d.dependsOn.id,
              title: d.dependsOn.title,
              status: d.dependsOn.status,
              priority: d.dependsOn.priority,
            })),
            dependedBy: dependents.map((d: any) => ({
              id: d.task.id,
              title: d.task.title,
              status: d.task.status,
              priority: d.task.priority,
            })),
          },
          history: history.map((h: any) => ({
            field: h.field,
            oldValue: h.oldValue,
            newValue: h.newValue,
            actor: h.actor,
            createdAt: h.createdAt,
          })),
          relatedTests: relatedTests.map((tc: any) => ({
            id: tc.id,
            title: tc.title,
            status: tc.status,
            type: tc.type,
            executionCount: tc._count.executions,
          })),
          risks,
        };
      } finally {
        await prisma.$disconnect();
      }
    },
  };
}
