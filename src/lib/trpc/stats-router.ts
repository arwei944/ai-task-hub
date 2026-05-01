import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, adminProcedure } from './server';

async function getStatsService() {
  const { getPrisma } = await import('@/lib/db');
  const { StatisticsService } = await import('@/lib/modules/dashboard/statistics.service');
  const { Logger } = await import('@/lib/core/logger');
  const prisma = getPrisma();
  const logger = new Logger('stats');
  return new StatisticsService(prisma, logger);
}

export const statsRouter = createTRPCRouter({
  // Task statistics overview
  taskStats: protectedProcedure.query(async () => {
    const service = await getStatsService();
    return service.getTaskStats();
  }),

  // Daily task trends
  dailyTrends: protectedProcedure
    .input(z.object({ days: z.number().min(7).max(90).optional() }).optional())
    .query(async ({ input }) => {
      const service = await getStatsService();
      return service.getDailyTrends(input?.days ?? 30);
    }),

  // AI engine statistics
  aiStats: protectedProcedure.query(async () => {
    const service = await getStatsService();
    return service.getAIStats();
  }),

  // System overview
  systemStats: adminProcedure.query(async () => {
    const service = await getStatsService();
    return service.getSystemStats();
  }),

  // Combined dashboard data (legacy)
  dashboard: protectedProcedure.query(async () => {
    const service = await getStatsService();
    const [taskStats, dailyTrends, aiStats, systemStats] = await Promise.all([
      service.getTaskStats(),
      service.getDailyTrends(14),
      service.getAIStats(),
      service.getSystemStats(),
    ]);
    return { taskStats, dailyTrends, aiStats, systemStats };
  }),

  // ---- NEW: Project health scores ----
  projectHealth: protectedProcedure.query(async () => {
    const service = await getStatsService();
    return service.getProjectHealth();
  }),

  // ---- NEW: Deployment statistics ----
  deploymentStats: protectedProcedure.query(async () => {
    const service = await getStatsService();
    return service.getDeploymentStats();
  }),

  // ---- NEW: Agent efficiency metrics ----
  agentEfficiency: protectedProcedure.query(async () => {
    const service = await getStatsService();
    return service.getAgentEfficiency();
  }),

  // ---- NEW: Event bus metrics ----
  eventMetrics: protectedProcedure.query(async () => {
    const service = await getStatsService();
    return service.getEventMetrics();
  }),

  // ---- NEW: Full project dashboard (all metrics) ----
  projectDashboard: protectedProcedure.query(async () => {
    const service = await getStatsService();
    return service.getProjectDashboard();
  }),
});
