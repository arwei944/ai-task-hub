import { createTRPCRouter, protectedProcedure } from './server';
import { z } from 'zod';

export const commandCenterRouter = createTRPCRouter({
  // ========== Overview ==========
  overview: protectedProcedure.query(async ({ ctx }) => {
    const { projectHubService, milestoneService, workLogService } = ctx.services;

    // 1. Get all non-archived projects
    const projects = await projectHubService.listProjects({ pageSize: 100 });

    // 2. Enrich each project with agent info, task stats, milestones, recent activity
    const enrichedProjects = await Promise.all(
      projects.items.map(async (project: any) => {
        const [detail, milestones] = await Promise.all([
          projectHubService.getProjectDetail(project.id),
          milestoneService.list({ projectId: project.id }),
        ]);

        const taskStats = detail?.taskStats ?? { total: 0, done: 0, inProgress: 0, todo: 0 };
        const progress = detail?.progress ?? 0;
        const agents = detail?.agents ?? [];

        // Get the latest activity for this project
        let latestActivity = null;
        try {
          const recentLogs = await workLogService.list({
            projectId: project.id,
            pageSize: 1,
          });
          latestActivity = recentLogs.items?.[0] ?? null;
        } catch (logErr: any) {
          // workLogService.list may fail if Prisma relations are out of sync
          ctx.services.logger?.warn(`[CommandCenter] Failed to fetch work logs for ${project.id}: ${logErr.message}`);
        }

        return {
          ...project,
          taskStats,
          progress,
          agents,
          milestones: milestones.map((m: any) => ({
            id: m.id,
            title: m.title,
            status: m.status,
            dueDate: m.dueDate,
            completedAt: m.completedAt,
          })),
          latestActivity,
        };
      }),
    );

    return {
      projects: enrichedProjects,
      total: projects.total,
    };
  }),

  // ========== Project Focus ==========
  projectFocus: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { projectHubService, milestoneService, workLogService } = ctx.services;

      const [detail, milestones, workLogsResult] = await Promise.all([
        projectHubService.getProjectDetail(input.projectId),
        milestoneService.list({ projectId: input.projectId }),
        workLogService.list({ projectId: input.projectId, pageSize: 20 }).catch(() => ({ items: [], total: 0 })),
      ]);

      if (!detail) {
        return null;
      }

      // Get full work log timeline
      const fullWorkLogs = await workLogService.list({
        projectId: input.projectId,
        pageSize: 50,
      }).catch(() => ({ items: [], total: 0 }));

      // Workload summary
      const allLogs = fullWorkLogs.items ?? [];
      const workloadSummary = {
        totalHours: allLogs.reduce((sum: number, log: any) => sum + (log.hours || 0), 0),
        totalEntries: allLogs.length,
        byTask: allLogs.reduce((acc: any, log: any) => {
          if (log.taskId) {
            acc[log.taskId] = (acc[log.taskId] || 0) + (log.hours || 0);
          }
          return acc;
        }, {}),
      };

      // Agent info
      const agentPA = detail?.agents?.[0] ?? null;
      const agentInfo = agentPA ? {
        id: agentPA.id,
        name: (agentPA as any).agent?.name ?? (agentPA as any).name ?? 'Unknown',
        clientType: (agentPA as any).agent?.clientType ?? (agentPA as any).clientType ?? null,
        role: agentPA.role,
        capabilities: agentPA.capabilities,
        isActive: agentPA.isActive,
        apiKey: (agentPA as any).agent?.apiKey ?? null,
      } : null;

      return {
        project: detail,
        milestones,
        recentWorkLogs: workLogsResult.items ?? [],
        fullWorkLogs: fullWorkLogs.items ?? [],
        workloadSummary,
        agentInfo,
      };
    }),

  // ========== Event Stream ==========
  eventStream: protectedProcedure
    .input(z.object({
      projectId: z.string().optional(),
      limit: z.number().default(50),
    }))
    .query(async ({ ctx, input }) => {
      const { workLogService, projectHubService } = ctx.services;

      if (input.projectId) {
        const result = await workLogService.list({
          projectId: input.projectId,
          pageSize: input.limit,
        });
        return {
          events: result.items ?? [],
          total: result.total ?? 0,
        };
      }

      // Without projectId, get recent logs across all projects
      const allProjects = await projectHubService.listProjects({ pageSize: 20 });
      const recentLogsByProject = await Promise.all(
        allProjects.items.slice(0, 10).map(async (p: any) => {
          try {
            const logs = await workLogService.list({ projectId: p.id, pageSize: 3 });
            return (logs.items ?? []).map((log: any) => ({ ...log, projectName: p.name, projectId: p.id }));
          } catch { return []; }
        })
      );
      const allRecentLogs = recentLogsByProject.flat().sort((a, b) =>
        new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime()
      ).slice(0, input.limit);

      return {
        events: allRecentLogs,
        total: allRecentLogs.length,
      };
    }),
});
