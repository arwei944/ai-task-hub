// ============================================================
// Statistics Service
// ============================================================
//
// Aggregates task, AI, and system statistics for the dashboard.
//

import type { PrismaClient } from '@/generated/prisma/client';
import type { ILogger } from '@/lib/core/types';

export interface TaskStats {
  total: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  byType: Record<string, number>;
  completionRate: number;
  avgProgress: number;
  overdueCount: number;
  createdToday: number;
  completedToday: number;
  createdThisWeek: number;
  completedThisWeek: number;
}

export interface DailyTrend {
  date: string;
  created: number;
  completed: number;
  total: number;
}

export interface AIStats {
  totalCalls: number;
  successRate: number;
  totalTokens: number;
  avgDuration: number;
  byProcessor: Record<string, { calls: number; avgDuration: number; tokensUsed: number }>;
  recentCalls: Array<{
    id: string;
    processor: string;
    success: boolean;
    duration: number;
    tokensUsed: number;
    createdAt: string;
  }>;
}

export interface SystemStats {
  activeModules: number;
  totalModules: number;
  registeredAgents: number;
  activeIntegrations: number;
  sseClients: number;
  uptime: number;
}

export class StatisticsService {
  constructor(
    private prisma: PrismaClient,
    private logger?: ILogger,
  ) {}

  /**
   * Get comprehensive task statistics
   */
  async getTaskStats(): Promise<TaskStats> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday

    // Parallel queries
    const [
      total,
      statusGroups,
      priorityGroups,
      typeGroups,
      overdue,
      createdToday,
      completedToday,
      createdThisWeek,
      completedThisWeek,
      avgProgress,
    ] = await Promise.all([
      this.prisma.task.count({ where: { status: { not: 'deleted' } } }),

      this.prisma.task.groupBy({
        by: ['status'],
        where: { status: { not: 'deleted' } },
        _count: true,
      }),

      this.prisma.task.groupBy({
        by: ['priority'],
        where: { status: { not: 'deleted' } },
        _count: true,
      }),

      this.prisma.task.groupBy({
        by: ['type'],
        where: { status: { not: 'deleted' } },
        _count: true,
      }),

      this.prisma.task.count({
        where: {
          status: { notIn: ['done', 'closed', 'deleted'] },
          dueDate: { lt: now },
        },
      }),

      this.prisma.task.count({
        where: { createdAt: { gte: todayStart } },
      }),

      this.prisma.task.count({
        where: { status: 'done', updatedAt: { gte: todayStart } },
      }),

      this.prisma.task.count({
        where: { createdAt: { gte: weekStart } },
      }),

      this.prisma.task.count({
        where: { status: 'done', updatedAt: { gte: weekStart } },
      }),

      this.prisma.task.aggregate({
        where: { status: { not: 'deleted' } },
        _avg: { progress: true },
      }),
    ]);

    const byStatus: Record<string, number> = {};
    for (const g of statusGroups) {
      byStatus[g.status] = g._count;
    }

    const byPriority: Record<string, number> = {};
    for (const g of priorityGroups) {
      byPriority[g.priority] = g._count;
    }

    const byType: Record<string, number> = {};
    for (const g of typeGroups) {
      byType[g.type] = g._count;
    }

    const doneCount = byStatus['done'] ?? 0;
    const closedCount = byStatus['closed'] ?? 0;

    return {
      total,
      byStatus,
      byPriority,
      byType,
      completionRate: total > 0 ? (doneCount + closedCount) / total : 0,
      avgProgress: avgProgress._avg.progress ?? 0,
      overdueCount: overdue,
      createdToday,
      completedToday,
      createdThisWeek,
      completedThisWeek,
    };
  }

  /**
   * Get daily task trends for the past N days
   */
  async getDailyTrends(days: number = 30): Promise<DailyTrend[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const tasks = await this.prisma.task.findMany({
      where: {
        createdAt: { gte: startDate },
      },
      select: {
        createdAt: true,
        status: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Build daily map
    const dailyMap: Record<string, { created: number; completed: number }> = {};

    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split('T')[0];
      dailyMap[key] = { created: 0, completed: 0 };
    }

    for (const task of tasks) {
      const key = task.createdAt.toISOString().split('T')[0];
      if (dailyMap[key]) {
        dailyMap[key].created++;
        if (task.status === 'done') {
          dailyMap[key].completed++;
        }
      }
    }

    // Convert to array with running total
    let runningTotal = 0;
    return Object.entries(dailyMap).map(([date, counts]) => {
      runningTotal += counts.created;
      return {
        date,
        created: counts.created,
        completed: counts.completed,
        total: runningTotal,
      };
    });
  }

  /**
   * Get AI engine statistics
   */
  async getAIStats(): Promise<AIStats> {
    try {
      const [total, successCount, totalTokens, avgDuration, processorGroups] = await Promise.all([
        this.prisma.aIAuditLog.count(),
        this.prisma.aIAuditLog.count({ where: { success: true } }),
        this.prisma.aIAuditLog.aggregate({ _sum: { tokensUsed: true } }),
        this.prisma.aIAuditLog.aggregate({ _avg: { duration: true } }),
        this.prisma.aIAuditLog.groupBy({
          by: ['processor'],
          _count: true,
          _avg: { duration: true },
          _sum: { tokensUsed: true },
        }),
      ]);

      const byProcessor: Record<string, { calls: number; avgDuration: number; tokensUsed: number }> = {};
      for (const g of processorGroups) {
        byProcessor[g.processor] = {
          calls: g._count,
          avgDuration: g._avg.duration ?? 0,
          tokensUsed: g._sum.tokensUsed ?? 0,
        };
      }

      const recentCalls = await this.prisma.aIAuditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          processor: true,
          success: true,
          duration: true,
          tokensUsed: true,
          createdAt: true,
        },
      });

      return {
        totalCalls: total,
        successRate: total > 0 ? successCount / total : 0,
        totalTokens: totalTokens._sum.tokensUsed ?? 0,
        avgDuration: avgDuration._avg.duration ?? 0,
        byProcessor,
        recentCalls: recentCalls.map(c => ({
          ...c,
          createdAt: c.createdAt.toISOString(),
        })),
      };
    } catch (error: any) {
      this.logger?.warn(`AI stats unavailable: ${error.message}`);
      return {
        totalCalls: 0,
        successRate: 0,
        totalTokens: 0,
        avgDuration: 0,
        byProcessor: {},
        recentCalls: [],
      };
    }
  }

  /**
   * Get system overview statistics
   */
  async getSystemStats(): Promise<SystemStats> {
    const startTime = Date.now();

    const [registeredAgents] = await Promise.all([
      this.prisma.agent.count(),
    ]);

    return {
      activeModules: 0,
      totalModules: 0,
      registeredAgents,
      activeIntegrations: registeredAgents,
      sseClients: 0,
      uptime: Date.now() - startTime,
    };
  }
}
