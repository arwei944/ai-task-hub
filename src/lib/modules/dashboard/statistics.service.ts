// ============================================================
// AI Task Hub - Enhanced Statistics Service v2
// ============================================================
// Adds: project health, deployment stats, agent efficiency,
//       event metrics, module registry integration

import type { PrismaClient } from '@/generated/prisma/client';
import type { ILogger, IEventBus } from '@/lib/core/types';

// ---- Existing Types (kept for backward compat) ----

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

// ---- New Types ----

export type HealthLevel = 'healthy' | 'warning' | 'critical' | 'unknown';

export interface ProjectHealth {
  projectId: string;
  projectName: string;
  phase: string;
  status: string;
  healthLevel: HealthLevel;
  score: number; // 0-100
  taskStats: {
    total: number;
    completed: number;
    inProgress: number;
    overdue: number;
  };
  recentActivity: number; // activities in last 24h
  lastActivityAt: string | null;
  deploymentStatus: string | null; // latest deployment status
}

export interface DeploymentStats {
  total: number;
  byStatus: Record<string, number>;
  byEnvironment: Record<string, number>;
  byStrategy: Record<string, number>;
  successRate: number;
  avgDuration: number; // ms
  recentDeployments: Array<{
    id: string;
    environment: string;
    version: string;
    status: string;
    duration: number | null;
    createdAt: string;
  }>;
  environmentHealth: Array<{
    environmentId: string;
    environmentName: string;
    healthStatus: string;
    lastDeploymentAt: string | null;
  }>;
}

export interface AgentEfficiency {
  totalAgents: number;
  activeAgents: number;
  totalOperations: number;
  byAction: Record<string, number>;
  successRate: number;
  topAgents: Array<{
    id: string;
    name: string;
    clientType: string;
    operations: number;
    successRate: number;
    lastSeenAt: string | null;
  }>;
  byClientType: Record<string, number>;
}

export interface EventMetrics {
  totalEvents: number;
  byDomain: Record<string, number>;
  topEventTypes: Array<{ type: string; count: number }>;
  recentEvents: Array<{
    id: string;
    eventType: string;
    source: string | null;
    timestamp: string;
  }>;
  eventsPerHour: number; // average over last 24h
}

export interface ProjectDashboard {
  projectHealth: ProjectHealth[];
  taskStats: TaskStats;
  deploymentStats: DeploymentStats;
  agentEfficiency: AgentEfficiency;
  eventMetrics: EventMetrics;
  aiStats: AIStats;
  systemStats: SystemStats;
}

export class StatisticsService {
  private readonly bootTime: number = Date.now();
  private moduleRegistry: any = null;

  constructor(
    private prisma: PrismaClient,
    private logger?: ILogger,
    private eventBus?: IEventBus,
  ) {}

  setModuleRegistry(registry: any): void {
    this.moduleRegistry = registry;
  }

  // ==================== Existing Methods (unchanged) ====================

  async getTaskStats(): Promise<TaskStats> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);

    const [
      total, statusGroups, priorityGroups, typeGroups,
      overdue, createdToday, completedToday,
      createdThisWeek, completedThisWeek, avgProgress,
    ] = await Promise.all([
      this.prisma.task.count({ where: { status: { not: 'deleted' } } }),
      this.prisma.task.groupBy({ by: ['status'], where: { status: { not: 'deleted' } }, _count: true }),
      this.prisma.task.groupBy({ by: ['priority'], where: { status: { not: 'deleted' } }, _count: true }),
      this.prisma.task.groupBy({ by: ['type'], where: { status: { not: 'deleted' } }, _count: true }),
      this.prisma.task.count({ where: { status: { notIn: ['done', 'closed', 'deleted'] }, dueDate: { lt: now } } }),
      this.prisma.task.count({ where: { createdAt: { gte: todayStart } } }),
      this.prisma.task.count({ where: { status: 'done', updatedAt: { gte: todayStart } } }),
      this.prisma.task.count({ where: { createdAt: { gte: weekStart } } }),
      this.prisma.task.count({ where: { status: 'done', updatedAt: { gte: weekStart } } }),
      this.prisma.task.aggregate({ where: { status: { not: 'deleted' } }, _avg: { progress: true } }),
    ]);

    const byStatus: Record<string, number> = {};
    for (const g of statusGroups) byStatus[g.status] = g._count;

    const byPriority: Record<string, number> = {};
    for (const g of priorityGroups) byPriority[g.priority] = g._count;

    const byType: Record<string, number> = {};
    for (const g of typeGroups) byType[g.type] = g._count;

    const doneCount = byStatus['done'] ?? 0;
    const closedCount = byStatus['closed'] ?? 0;

    return {
      total, byStatus, byPriority, byType,
      completionRate: total > 0 ? (doneCount + closedCount) / total : 0,
      avgProgress: avgProgress._avg.progress ?? 0,
      overdueCount: overdue,
      createdToday, completedToday, createdThisWeek, completedThisWeek,
    };
  }

  async getDailyTrends(days: number = 30): Promise<DailyTrend[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const tasks = await this.prisma.task.findMany({
      where: { createdAt: { gte: startDate } },
      select: { createdAt: true, status: true },
      orderBy: { createdAt: 'asc' },
    });

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
        if (task.status === 'done') dailyMap[key].completed++;
      }
    }

    let runningTotal = 0;
    return Object.entries(dailyMap).map(([date, counts]) => {
      runningTotal += counts.created;
      return { date, created: counts.created, completed: counts.completed, total: runningTotal };
    });
  }

  async getAIStats(): Promise<AIStats> {
    try {
      const [total, successCount, totalTokens, avgDuration, processorGroups] = await Promise.all([
        this.prisma.aIAuditLog.count(),
        this.prisma.aIAuditLog.count({ where: { success: true } }),
        this.prisma.aIAuditLog.aggregate({ _sum: { tokensUsed: true } }),
        this.prisma.aIAuditLog.aggregate({ _avg: { duration: true } }),
        this.prisma.aIAuditLog.groupBy({
          by: ['processor'], _count: true, _avg: { duration: true }, _sum: { tokensUsed: true },
        }),
      ]);

      const byProcessor: Record<string, { calls: number; avgDuration: number; tokensUsed: number }> = {};
      for (const g of processorGroups) {
        byProcessor[g.processor] = { calls: g._count, avgDuration: g._avg.duration ?? 0, tokensUsed: g._sum.tokensUsed ?? 0 };
      }

      const recentCalls = await this.prisma.aIAuditLog.findMany({
        orderBy: { createdAt: 'desc' }, take: 10,
        select: { id: true, processor: true, success: true, duration: true, tokensUsed: true, createdAt: true },
      });

      return {
        totalCalls: total,
        successRate: total > 0 ? successCount / total : 0,
        totalTokens: totalTokens._sum.tokensUsed ?? 0,
        avgDuration: avgDuration._avg.duration ?? 0,
        byProcessor,
        recentCalls: recentCalls.map(c => ({ ...c, createdAt: c.createdAt.toISOString() })),
      };
    } catch (error: any) {
      this.logger?.warn(`AI stats unavailable: ${error.message}`);
      return { totalCalls: 0, successRate: 0, totalTokens: 0, avgDuration: 0, byProcessor: {}, recentCalls: [] };
    }
  }

  async getSystemStats(): Promise<SystemStats> {
    const [registeredAgents, activeIntegrations] = await Promise.all([
      this.prisma.agent.count({ where: { isActive: true } }),
      this.prisma.integration.count({ where: { isActive: true } }),
    ]);

    // Dynamic module count from registry if available
    let activeModules = 0;
    let totalModules = 0;
    if (this.moduleRegistry) {
      try {
        const modules = this.moduleRegistry.getAllModules?.() ?? [];
        totalModules = modules.length;
        activeModules = modules.filter((m: any) => m.enabled).length;
      } catch {
        // fallback
        activeModules = 12;
        totalModules = 13;
      }
    } else {
      activeModules = 12;
      totalModules = 13;
    }

    return {
      activeModules,
      totalModules,
      registeredAgents,
      activeIntegrations,
      sseClients: 0,
      uptime: Date.now() - this.bootTime,
    };
  }

  // ==================== New Methods ====================

  /**
   * Calculate health scores for all active projects
   */
  async getProjectHealth(): Promise<ProjectHealth[]> {
    const projects = await this.prisma.project.findMany({
      where: { status: 'active' },
      include: {
        tasks: { where: { status: { not: 'deleted' } } },
        activities: {
          where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
          take: 1,
        },
        _count: { select: { activities: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Get latest deployment per project
    const projectIds = projects.map(p => p.id);
    const latestDeployments = projectIds.length > 0
      ? await this.prisma.deployment.findMany({
          where: { projectId: { in: projectIds } },
          orderBy: { createdAt: 'desc' },
          distinct: ['projectId'],
        })
      : [];

    const deploymentMap = new Map(latestDeployments.map(d => [d.projectId, d]));

    return projects.map(project => {
      const tasks = project.tasks;
      const total = tasks.length;
      const completed = tasks.filter(t => t.status === 'done' || t.status === 'closed').length;
      const inProgress = tasks.filter(t => t.status === 'in_progress').length;
      const overdue = tasks.filter(t =>
        t.status !== 'done' && t.status !== 'closed' && t.status !== 'deleted' &&
        t.dueDate && t.dueDate < new Date(),
      ).length;

      const recentActivity = project.activities.length;
      const lastActivity = project._count.activities > 0
        ? project.activities[0]?.createdAt?.toISOString() ?? null
        : null;

      const deployment = deploymentMap.get(project.id);

      // Health score calculation (0-100)
      let score = 50; // base

      // Task completion factor (0-25)
      if (total > 0) {
        score += Math.round((completed / total) * 25);
      }

      // Overdue penalty (0-15)
      score -= Math.min(overdue * 5, 15);

      // Recent activity bonus (0-10)
      if (recentActivity > 0) score += Math.min(recentActivity * 2, 10);
      else score -= 5; // inactive penalty

      // Phase progress bonus (0-10)
      const phaseOrder = ['requirements', 'planning', 'architecture', 'implementation', 'testing', 'deployment', 'completed'];
      const phaseIndex = phaseOrder.indexOf(project.phase);
      if (phaseIndex >= 0) score += Math.round((phaseIndex / (phaseOrder.length - 1)) * 10);

      score = Math.max(0, Math.min(100, score));

      let healthLevel: HealthLevel = 'unknown';
      if (score >= 70) healthLevel = 'healthy';
      else if (score >= 40) healthLevel = 'warning';
      else healthLevel = 'critical';

      return {
        projectId: project.id,
        projectName: project.name,
        phase: project.phase,
        status: project.status,
        healthLevel,
        score,
        taskStats: { total, completed, inProgress, overdue },
        recentActivity,
        lastActivityAt: lastActivity,
        deploymentStatus: deployment?.status ?? null,
      };
    });
  }

  /**
   * Get deployment statistics across all environments
   */
  async getDeploymentStats(): Promise<DeploymentStats> {
    try {
      const [
        total, statusGroups, envGroups, strategyGroups,
        successCount, avgDurationResult,
        recentDeployments, environments,
      ] = await Promise.all([
        this.prisma.deployment.count(),
        this.prisma.deployment.groupBy({ by: ['status'], _count: true }),
        this.prisma.deployment.groupBy({ by: ['environmentId'], _count: true }),
        this.prisma.deployment.groupBy({ by: ['strategy'], _count: true }),
        this.prisma.deployment.count({ where: { status: 'running' } }),
        this.prisma.deployment.aggregate({
          where: { status: 'running', duration: { not: null } },
          _avg: { duration: true },
        }),
        this.prisma.deployment.findMany({
          orderBy: { createdAt: 'desc' }, take: 10,
          include: { environment: { select: { name: true } } },
        }),
        this.prisma.deploymentEnvironment.findMany({
          orderBy: { order: 'asc' },
        }),
      ]);

      const byStatus: Record<string, number> = {};
      for (const g of statusGroups) byStatus[g.status] = g._count;

      const byEnvironment: Record<string, number> = {};
      for (const g of envGroups) byEnvironment[g.environmentId] = g._count;

      const byStrategy: Record<string, number> = {};
      for (const g of strategyGroups) byStrategy[g.strategy] = g._count;

      return {
        total,
        byStatus,
        byEnvironment,
        byStrategy,
        successRate: total > 0 ? successCount / total : 0,
        avgDuration: avgDurationResult._avg.duration ?? 0,
        recentDeployments: recentDeployments.map(d => ({
          id: d.id,
          environment: d.environment.name,
          version: d.version,
          status: d.status,
          duration: d.duration,
          createdAt: d.createdAt.toISOString(),
        })),
        environmentHealth: environments.map(e => ({
          environmentId: e.id,
          environmentName: e.displayName || e.name,
          healthStatus: e.healthStatus,
          lastDeploymentAt: e.lastDeploymentAt?.toISOString() ?? null,
        })),
      };
    } catch (error: any) {
      this.logger?.warn(`Deployment stats unavailable: ${error.message}`);
      return {
        total: 0, byStatus: {}, byEnvironment: {}, byStrategy: {},
        successRate: 0, avgDuration: 0, recentDeployments: [], environmentHealth: [],
      };
    }
  }

  /**
   * Get agent efficiency metrics
   */
  async getAgentEfficiency(): Promise<AgentEfficiency> {
    const [totalAgents, activeAgents, totalOps, actionGroups, successOps, clientTypeGroups] = await Promise.all([
      this.prisma.agent.count(),
      this.prisma.agent.count({ where: { isActive: true } }),
      this.prisma.agentOperation.count(),
      this.prisma.agentOperation.groupBy({ by: ['action'], _count: true }),
      this.prisma.agentOperation.count({ where: { success: true } }),
      this.prisma.agent.groupBy({ by: ['clientType'], _count: true }),
    ]);

    const byAction: Record<string, number> = {};
    for (const g of actionGroups) byAction[g.action] = g._count;

    const byClientType: Record<string, number> = {};
    for (const g of clientTypeGroups) byClientType[g.clientType] = g._count;

    // Top agents by operation count
    const topAgentOps = await this.prisma.agentOperation.groupBy({
      by: ['agentId'],
      _count: { id: true },
      where: { success: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    const topAgentIds = topAgentOps.map(g => g.agentId);
    const topAgentsData = topAgentIds.length > 0
      ? await this.prisma.agent.findMany({
          where: { id: { in: topAgentIds } },
          include: {
            _count: { select: { operations: true } },
            operations: { where: { success: true }, select: { id: true }, take: 1 },
          },
        })
      : [];

    const agentOpMap = new Map(topAgentOps.map(g => [g.agentId, g._count.id]));
    const topAgents = topAgentsData.map(a => {
      const totalOpsForAgent = a._count.operations;
      const successOpsForAgent = agentOpMap.get(a.id) ?? 0;
      return {
        id: a.id,
        name: a.name,
        clientType: a.clientType,
        operations: totalOpsForAgent,
        successRate: totalOpsForAgent > 0 ? successOpsForAgent / totalOpsForAgent : 0,
        lastSeenAt: a.lastSeenAt?.toISOString() ?? null,
      };
    });

    return {
      totalAgents,
      activeAgents,
      totalOperations: totalOps,
      byAction,
      successRate: totalOps > 0 ? successOps / totalOps : 0,
      topAgents,
      byClientType,
    };
  }

  /**
   * Get event bus metrics
   */
  async getEventMetrics(): Promise<EventMetrics> {
    try {
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const [total, recentEvents, eventsLast24h] = await Promise.all([
        this.prisma.eventStore.count(),
        this.prisma.eventStore.findMany({
          orderBy: { timestamp: 'desc' }, take: 20,
          select: { id: true, eventType: true, source: true, timestamp: true },
        }),
        this.prisma.eventStore.count({ where: { timestamp: { gte: twentyFourHoursAgo } } }),
      ]);

      // Group by domain (first part of event type)
      const domainGroups = await this.prisma.eventStore.groupBy({
        by: ['eventType'],
        _count: true,
      });
      const byDomain: Record<string, number> = {};
      const typeCounts: Record<string, number> = {};
      for (const g of domainGroups) {
        typeCounts[g.eventType] = g._count;
        const domain = g.eventType.split('.')[0];
        byDomain[domain] = (byDomain[domain] || 0) + g._count;
      }

      const topEventTypes = Object.entries(typeCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([type, count]) => ({ type, count }));

      return {
        totalEvents: total,
        byDomain,
        topEventTypes,
        recentEvents: recentEvents.map(e => ({
          ...e,
          timestamp: e.timestamp.toISOString(),
        })),
        eventsPerHour: Math.round(eventsLast24h / 24),
      };
    } catch (error: any) {
      this.logger?.warn(`Event metrics unavailable: ${error.message}`);
      return {
        totalEvents: 0, byDomain: {}, topEventTypes: [],
        recentEvents: [], eventsPerHour: 0,
      };
    }
  }

  /**
   * Get full project-scoped dashboard
   */
  async getProjectDashboard(): Promise<ProjectDashboard> {
    const [projectHealth, taskStats, deploymentStats, agentEfficiency, eventMetrics, aiStats, systemStats] =
      await Promise.all([
        this.getProjectHealth(),
        this.getTaskStats(),
        this.getDeploymentStats(),
        this.getAgentEfficiency(),
        this.getEventMetrics(),
        this.getAIStats(),
        this.getSystemStats(),
      ]);

    return { projectHealth, taskStats, deploymentStats, agentEfficiency, eventMetrics, aiStats, systemStats };
  }
}
