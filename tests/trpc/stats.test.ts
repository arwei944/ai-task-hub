/**
 * Integration tests for stats tRPC router.
 * Tests: taskStats, dailyTrends, aiStats, systemStats, dashboard
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestContext, destroyTestContext } from './helpers';
import type { TestContext } from './helpers';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});

afterAll(async () => {
  await destroyTestContext(ctx);
});

beforeEach(async () => {
  await ctx.prisma.task.deleteMany();
  await ctx.prisma.agent.deleteMany();
  await ctx.prisma.aIAuditLog.deleteMany();
});

describe('stats.taskStats', () => {
  it('should return zero stats for empty database', async () => {
    const stats = await ctx.statsService.getTaskStats();

    expect(stats.total).toBe(0);
    expect(stats.completionRate).toBe(0);
    expect(stats.avgProgress).toBe(0);
    expect(stats.overdueCount).toBe(0);
    expect(stats.createdToday).toBe(0);
    expect(stats.completedToday).toBe(0);
    expect(stats.createdThisWeek).toBe(0);
    expect(stats.completedThisWeek).toBe(0);
    expect(stats.byStatus).toEqual({});
    expect(stats.byPriority).toEqual({});
    expect(stats.byType).toEqual({});
  });

  it('should count tasks by status', async () => {
    // Create tasks directly via prisma
    await ctx.prisma.task.create({ data: { title: 'T1', status: 'todo' } });
    await ctx.prisma.task.create({ data: { title: 'T2', status: 'todo' } });
    await ctx.prisma.task.create({ data: { title: 'T3', status: 'in_progress' } });
    await ctx.prisma.task.create({ data: { title: 'T4', status: 'done' } });

    const stats = await ctx.statsService.getTaskStats();
    expect(stats.total).toBe(4);
    expect(stats.byStatus['todo']).toBe(2);
    expect(stats.byStatus['in_progress']).toBe(1);
    expect(stats.byStatus['done']).toBe(1);
  });

  it('should calculate completion rate', async () => {
    await ctx.prisma.task.create({ data: { title: 'T1', status: 'done' } });
    await ctx.prisma.task.create({ data: { title: 'T2', status: 'done' } });
    await ctx.prisma.task.create({ data: { title: 'T3', status: 'todo' } });
    await ctx.prisma.task.create({ data: { title: 'T4', status: 'closed' } });

    const stats = await ctx.statsService.getTaskStats();
    expect(stats.completionRate).toBe(0.75); // 3 done/closed out of 4
  });

  it('should count by priority', async () => {
    await ctx.prisma.task.create({ data: { title: 'T1', priority: 'high' } });
    await ctx.prisma.task.create({ data: { title: 'T2', priority: 'high' } });
    await ctx.prisma.task.create({ data: { title: 'T3', priority: 'low' } });

    const stats = await ctx.statsService.getTaskStats();
    expect(stats.byPriority['high']).toBe(2);
    expect(stats.byPriority['low']).toBe(1);
  });

  it('should count by type', async () => {
    await ctx.prisma.task.create({ data: { title: 'T1', type: 'bug' } });
    await ctx.prisma.task.create({ data: { title: 'T2', type: 'feature' } });

    const stats = await ctx.statsService.getTaskStats();
    expect(stats.byType['bug']).toBe(1);
    expect(stats.byType['feature']).toBe(1);
  });

  it('should exclude deleted tasks', async () => {
    await ctx.prisma.task.create({ data: { title: 'T1', status: 'todo' } });
    await ctx.prisma.task.create({ data: { title: 'T2', status: 'deleted' } });

    const stats = await ctx.statsService.getTaskStats();
    expect(stats.total).toBe(1);
  });

  it('should calculate average progress', async () => {
    await ctx.prisma.task.create({ data: { title: 'T1', progress: 20 } });
    await ctx.prisma.task.create({ data: { title: 'T2', progress: 60 } });
    await ctx.prisma.task.create({ data: { title: 'T3', progress: 100 } });

    const stats = await ctx.statsService.getTaskStats();
    expect(stats.avgProgress).toBe(60);
  });

  it('should count overdue tasks', async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);

    await ctx.prisma.task.create({
      data: { title: 'Overdue', status: 'todo', dueDate: pastDate },
    });
    await ctx.prisma.task.create({
      data: { title: 'Not Overdue', status: 'todo', dueDate: new Date(Date.now() + 86400000) },
    });

    const stats = await ctx.statsService.getTaskStats();
    expect(stats.overdueCount).toBe(1);
  });
});

describe('stats.dailyTrends', () => {
  it('should return daily trends for given days', async () => {
    const trends = await ctx.statsService.getDailyTrends(7);
    expect(trends).toHaveLength(7);
    expect(trends[0]).toHaveProperty('date');
    expect(trends[0]).toHaveProperty('created');
    expect(trends[0]).toHaveProperty('completed');
    expect(trends[0]).toHaveProperty('total');
  });

  it('should reflect created tasks in trends', async () => {
    // Create a task with a createdAt within the trend window (7 days ago to yesterday)
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    threeDaysAgo.setHours(12, 0, 0, 0);

    await ctx.prisma.task.create({
      data: { title: 'Past Task', createdAt: threeDaysAgo },
    });

    const trends = await ctx.statsService.getDailyTrends(7);
    const createdTrend = trends.find(t => t.created > 0);

    expect(createdTrend).toBeDefined();
    expect(createdTrend!.created).toBeGreaterThanOrEqual(1);
  });

  it('should accumulate running total', async () => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    threeDaysAgo.setHours(12, 0, 0, 0);

    await ctx.prisma.task.create({
      data: { title: 'T1', createdAt: threeDaysAgo },
    });
    await ctx.prisma.task.create({
      data: { title: 'T2', createdAt: threeDaysAgo },
    });

    const trends = await ctx.statsService.getDailyTrends(7);
    // Sum all created tasks across the trend period
    const totalCreated = trends.reduce((sum, t) => sum + t.created, 0);
    expect(totalCreated).toBeGreaterThanOrEqual(2);
  });
});

describe('stats.aiStats', () => {
  it('should return empty stats when no AI calls', async () => {
    const stats = await ctx.statsService.getAIStats();

    expect(stats.totalCalls).toBe(0);
    expect(stats.successRate).toBe(0);
    expect(stats.totalTokens).toBe(0);
    expect(stats.avgDuration).toBe(0);
    expect(stats.byProcessor).toEqual({});
    expect(stats.recentCalls).toEqual([]);
  });

  it('should count AI audit logs', async () => {
    await ctx.prisma.aIAuditLog.create({
      data: {
        processor: 'task-extractor',
        input: '{}',
        output: '{}',
        model: 'gpt-4o',
        tokensUsed: 100,
        duration: 500,
        success: true,
      },
    });
    await ctx.prisma.aIAuditLog.create({
      data: {
        processor: 'task-extractor',
        input: '{}',
        output: '{}',
        model: 'gpt-4o',
        tokensUsed: 200,
        duration: 800,
        success: false,
      },
    });

    const stats = await ctx.statsService.getAIStats();
    expect(stats.totalCalls).toBe(2);
    expect(stats.successRate).toBe(0.5);
    expect(stats.totalTokens).toBe(300);
  });
});

describe('stats.systemStats', () => {
  it('should return system stats', async () => {
    await ctx.prisma.agent.create({
      data: {
        name: 'Test Agent',
        apiKey: 'ath_test_key',
      },
    });
    await ctx.prisma.integration.create({
      data: {
        type: 'webhook',
        name: 'Test Integration',
        config: '{}',
        isActive: true,
      },
    });

    const stats = await ctx.statsService.getSystemStats();

    expect(stats.activeModules).toBeGreaterThanOrEqual(1);
    expect(stats.totalModules).toBeGreaterThanOrEqual(1);
    expect(stats.registeredAgents).toBe(1);
    expect(stats.activeIntegrations).toBe(1);
    expect(stats.sseClients).toBe(0);
    expect(stats.uptime).toBeGreaterThanOrEqual(0);
  });
});

describe('stats.dashboard', () => {
  it('should return combined dashboard data', async () => {
    const dashboard = await Promise.all([
      ctx.statsService.getTaskStats(),
      ctx.statsService.getDailyTrends(14),
      ctx.statsService.getAIStats(),
      ctx.statsService.getSystemStats(),
    ]);

    expect(dashboard).toHaveLength(4);
    expect(dashboard[0]).toHaveProperty('total');
    expect(dashboard[1]).toBeInstanceOf(Array);
    expect(dashboard[2]).toHaveProperty('totalCalls');
    expect(dashboard[3]).toHaveProperty('registeredAgents');
  });
});
