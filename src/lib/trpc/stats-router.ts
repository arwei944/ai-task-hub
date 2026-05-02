import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, adminProcedure } from './server';

export const statsRouter = createTRPCRouter({
  // Task statistics overview
  taskStats: protectedProcedure.query(async ({ ctx }) => {
    const service = ctx.services.statisticsService;
    return service.getTaskStats();
  }),

  // Daily task trends
  dailyTrends: protectedProcedure
    .input(z.object({ days: z.number().min(7).max(90).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const service = ctx.services.statisticsService;
      return service.getDailyTrends(input?.days ?? 30);
    }),

  // AI engine statistics
  aiStats: protectedProcedure.query(async ({ ctx }) => {
    const service = ctx.services.statisticsService;
    return service.getAIStats();
  }),

  // System overview
  systemStats: adminProcedure.query(async ({ ctx }) => {
    const service = ctx.services.statisticsService;
    return service.getSystemStats();
  }),

  // Combined dashboard data (legacy)
  dashboard: protectedProcedure.query(async ({ ctx }) => {
    const service = ctx.services.statisticsService;
    const [taskStats, dailyTrends, aiStats, systemStats] = await Promise.all([
      service.getTaskStats(),
      service.getDailyTrends(14),
      service.getAIStats(),
      service.getSystemStats(),
    ]);
    return { taskStats, dailyTrends, aiStats, systemStats };
  }),

  // ---- NEW: Project health scores ----
  projectHealth: protectedProcedure.query(async ({ ctx }) => {
    const service = ctx.services.statisticsService;
    return service.getProjectHealth();
  }),

  // ---- NEW: Deployment statistics ----
  deploymentStats: protectedProcedure.query(async ({ ctx }) => {
    const service = ctx.services.statisticsService;
    return service.getDeploymentStats();
  }),

  // ---- NEW: Agent efficiency metrics ----
  agentEfficiency: protectedProcedure.query(async ({ ctx }) => {
    const service = ctx.services.statisticsService;
    return service.getAgentEfficiency();
  }),

  // ---- NEW: Event bus metrics ----
  eventMetrics: protectedProcedure.query(async ({ ctx }) => {
    const service = ctx.services.statisticsService;
    return service.getEventMetrics();
  }),

  // ---- NEW: Full project dashboard (all metrics) ----
  projectDashboard: protectedProcedure.query(async ({ ctx }) => {
    const service = ctx.services.statisticsService;
    return service.getProjectDashboard();
  }),
});
