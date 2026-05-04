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
        const recentLogs = await workLogService.list({
          projectId: project.id,
          pageSize: 1,
        });

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
          latestActivity: recentLogs.items?.[0] ?? null,
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

      const [detail, milestones, workLogs] = await Promise.all([
        projectHubService.getProjectDetail(input.projectId),
        milestoneService.list({ projectId: input.projectId }),
        workLogService.list({ projectId: input.projectId, pageSize: 20 }),
      ]);

      if (!detail) {
        return null;
      }

      return {
        project: detail,
        milestones,
        recentWorkLogs: workLogs.items ?? [],
      };
    }),

  // ========== Event Stream ==========
  eventStream: protectedProcedure
    .input(z.object({
      projectId: z.string().optional(),
      limit: z.number().default(50),
    }))
    .query(async ({ ctx, input }) => {
      const { workLogService } = ctx.services;

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

      // Without projectId, return empty for now (can be extended later)
      return {
        events: [],
        total: 0,
      };
    }),
});
