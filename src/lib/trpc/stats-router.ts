import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from './server';
import { StatisticsService } from '@/lib/modules/dashboard/statistics.service';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { Logger } from '@/lib/core/logger';

function getStatsService(): StatisticsService {
  const dbPath = process.env.DATABASE_URL?.replace(/^file:/, '') ?? './prisma/dev.db';
  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  const prisma = new PrismaClient({ adapter });
  const logger = new Logger('stats');
  return new StatisticsService(prisma, logger);
}

export const statsRouter = createTRPCRouter({
  // Task statistics overview
  taskStats: publicProcedure.query(async () => {
    const service = getStatsService();
    return service.getTaskStats();
  }),

  // Daily task trends
  dailyTrends: publicProcedure
    .input(z.object({ days: z.number().min(7).max(90).optional() }).optional())
    .query(async ({ input }) => {
      const service = getStatsService();
      return service.getDailyTrends(input?.days ?? 30);
    }),

  // AI engine statistics
  aiStats: publicProcedure.query(async () => {
    const service = getStatsService();
    return service.getAIStats();
  }),

  // System overview
  systemStats: publicProcedure.query(async () => {
    const service = getStatsService();
    return service.getSystemStats();
  }),

  // Combined dashboard data
  dashboard: publicProcedure.query(async () => {
    const service = getStatsService();
    const [taskStats, dailyTrends, aiStats, systemStats] = await Promise.all([
      service.getTaskStats(),
      service.getDailyTrends(14),
      service.getAIStats(),
      service.getSystemStats(),
    ]);

    return { taskStats, dailyTrends, aiStats, systemStats };
  }),
});
