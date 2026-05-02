import { z } from 'zod';
import { createTRPCRouter, publicProcedure, protectedProcedure } from './server';
import type { TaskSummary } from '@/lib/modules/ai-engine/advisors/schedule-advisor';

export const aiRouter = createTRPCRouter({
  // ====== Existing AI capabilities ======

  // Extract tasks from text
  extractTasks: publicProcedure
    .input(z.object({ text: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const ai = ctx.services.aiModel;
      const logger = ctx.services.logger;
      const extractor = ctx.services.taskExtractor;
      return extractor.extract(input.text);
    }),

  // Decompose a task into subtasks (preview only)
  decomposeTask: publicProcedure
    .input(z.object({ title: z.string().min(1), description: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const decomposer = ctx.services.taskDecomposer;
      return decomposer.decompose(input.title, input.description);
    }),

  // Infer task status from context
  inferStatus: publicProcedure
    .input(z.object({
      taskTitle: z.string(),
      currentStatus: z.string(),
      context: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const inferencer = ctx.services.statusInferencer;
      return inferencer.infer(input.taskTitle, input.currentStatus, input.context);
    }),

  // Generate analysis report
  generateReport: publicProcedure
    .input(z.object({
      totalTasks: z.number(),
      statusCounts: z.record(z.string(), z.number()),
      recentTasks: z.array(z.object({
        title: z.string(),
        status: z.string(),
        priority: z.string(),
        dueDate: z.string().nullable(),
        createdAt: z.string(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      const analyzer = ctx.services.taskAnalyzer;
      return analyzer.generateReport(input);
    }),

  // ====== New M12 capabilities ======

  // Natural language task query
  nlQuery: protectedProcedure
    .input(z.object({ query: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const nlQuery = ctx.services.nlTaskQuery;
      return nlQuery.query(input.query);
    }),

  // Smart scheduling advice
  scheduleAdvice: protectedProcedure
    .input(z.object({
      tasks: z.array(z.object({
        id: z.string(),
        title: z.string(),
        status: z.string(),
        priority: z.string(),
        progress: z.number(),
        dueDate: z.string().nullable().optional(),
        assignee: z.string().nullable().optional(),
        createdAt: z.string(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      const advisor = ctx.services.scheduleAdvisor;
      return advisor.analyze(input.tasks as TaskSummary[]);
    }),

  // Auto-decompose task and create sub-tasks
  autoDecompose: protectedProcedure
    .input(z.object({
      taskId: z.string(),
      title: z.string().min(1),
      description: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const decomposer = ctx.services.autoTaskDecomposer;

      // Preview mode (no auto-creation without task service)
      return decomposer.preview(input.title, input.description);
    }),

  // ====== Ops Monitoring ======

  // Get AI model usage statistics
  getUsageStats: protectedProcedure.query(async ({ ctx }) => {
    const prisma = ctx.services.prisma;

    // Count SOLO/AI step executions in last 24h
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [totalCalls24h, failedCalls24h, byModel] = await Promise.all([
      prisma.workflowStepExecution.count({
        where: {
          stepType: { in: ['ai-analyze', 'invoke-agent'] },
          createdAt: { gte: since24h },
        },
      }),
      prisma.workflowStepExecution.count({
        where: {
          stepType: { in: ['ai-analyze', 'invoke-agent'] },
          status: 'failed',
          createdAt: { gte: since24h },
        },
      }),
      prisma.workflowStepExecution.groupBy({
        by: ['soloSubAgent'],
        _count: { id: true },
        _avg: { durationMs: true },
        where: {
          stepType: { in: ['ai-analyze', 'invoke-agent'] },
          createdAt: { gte: since24h },
        },
      }),
    ]);

    const modelStats = byModel.map((g: any) => ({
      model: g.soloSubAgent ?? 'unknown',
      requestCount24h: g._count.id,
      avgLatencyMs: Math.round(Number(g._avg.durationMs) || 0),
    }));

    return {
      totalCalls24h,
      failedCalls24h,
      errorRate: totalCalls24h > 0 ? failedCalls24h / totalCalls24h : 0,
      models: modelStats,
    };
  }),

  // Get recent AI usage history
  getUsageHistory: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).optional() }))
    .query(async ({ ctx, input }) => {
      const limit = input.limit ?? 20;
      const prisma = ctx.services.prisma;

      const steps = await prisma.workflowStepExecution.findMany({
        where: {
          stepType: { in: ['ai-analyze', 'invoke-agent'] },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      const items = steps.map((step: any) => ({
        id: step.id,
        model: step.soloSubAgent ?? 'unknown',
        type: step.stepType === 'ai-analyze' ? 'chat' : step.stepType === 'invoke-agent' ? 'agent' : 'other',
        tokens: step.tokensUsed ?? 0,
        latencyMs: step.durationMs ?? 0,
        timestamp: step.startedAt ?? step.createdAt,
        success: step.status === 'completed',
        error: step.error,
      }));

      return { items };
    }),

  // Get model status overview
  getModelStatus: protectedProcedure.query(async ({ ctx }) => {
    const prisma = ctx.services.prisma;
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Get unique models used
    const modelGroups = await prisma.workflowStepExecution.groupBy({
      by: ['soloSubAgent'],
      _count: { id: true },
      _avg: { durationMs: true },
      where: {
        stepType: { in: ['ai-analyze', 'invoke-agent'] },
        createdAt: { gte: since24h },
      },
    });

    const failGroups = await prisma.workflowStepExecution.groupBy({
      by: ['soloSubAgent'],
      _count: { id: true },
      where: {
        stepType: { in: ['ai-analyze', 'invoke-agent'] },
        status: 'failed',
        createdAt: { gte: since24h },
      },
    });

    const failMap = new Map<string, number>(failGroups.map((g: any) => [g.soloSubAgent, g._count.id]));

    const models = modelGroups.map((g: any) => {
      const total: number = g._count.id;
      const fails: number = failMap.get(g.soloSubAgent) ?? 0;
      const errorRate: number = total > 0 ? fails / total : 0;
      return {
        name: g.soloSubAgent ?? 'default',
        provider: 'SOLO',
        status: errorRate > 0.15 ? 'degraded' as const : errorRate > 0 ? 'active' as const : 'active' as const,
        avgLatencyMs: Math.round(Number(g._avg.durationMs) || 0),
        requestCount24h: total,
        errorRate,
        lastUsedAt: Date.now(), // approximate
      };
    });

    return { models };
  }),
});
