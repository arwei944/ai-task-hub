import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, adminProcedure } from './server';

const stepSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['create-task', 'update-status', 'ai-analyze', 'send-notification', 'wait', 'parallel-group', 'condition', 'foreach', 'invoke-agent', 'http-request', 'transform', 'approval']),
  config: z.record(z.string(), z.unknown()),
  onError: z.enum(['continue', 'fail']).optional(),
  feedbackMode: z.enum(['auto', 'notify', 'block', 'smart']).optional(),
  soloSubAgent: z.enum(['explore', 'plan', 'general_purpose']).optional(),
  soloCallMode: z.enum(['mcp', 'rest', 'pull']).optional(),
  timeoutMs: z.number().optional(),
  condition: z.object({
    expression: z.string(),
    thenSteps: z.array(z.any()).optional(),
    elseSteps: z.array(z.any()).optional(),
  }).optional(),
  steps: z.array(z.any()).optional(),
});

export const workflowsRouter = createTRPCRouter({
  // Create workflow
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        trigger: z.string().optional(),
        triggerConfig: z.string().optional(),
        steps: z.array(stepSchema).min(1),
        variables: z.record(z.string(), z.unknown()).optional(),
        retryPolicy: z.object({
          max: z.number(),
          backoff: z.enum(['fixed', 'exponential', 'linear']),
          delayMs: z.number(),
        }).optional(),
        concurrencyLimit: z.number().min(1).max(20).optional(),
        timeoutMs: z.number().optional(),
        soloConfig: z.object({
          defaultMode: z.enum(['mcp', 'rest', 'pull']).optional(),
          defaultSubAgent: z.enum(['explore', 'plan', 'general_purpose']).optional(),
          defaultTimeoutMs: z.number().optional(),
        }).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const service = ctx.services.workflowService;
      const dto = { ...input, createdBy: ctx.user.id };
      return service.createWorkflow(dto as any);
    }),

  // Update workflow
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        trigger: z.string().optional(),
        triggerConfig: z.string().optional(),
        steps: z.array(stepSchema).optional(),
        variables: z.record(z.string(), z.unknown()).optional(),
        isActive: z.boolean().optional(),
        retryPolicy: z.object({
          max: z.number(),
          backoff: z.enum(['fixed', 'exponential', 'linear']),
          delayMs: z.number(),
        }).optional(),
        concurrencyLimit: z.number().min(1).max(20).optional(),
        timeoutMs: z.number().optional(),
        soloConfig: z.object({
          defaultMode: z.enum(['mcp', 'rest', 'pull']).optional(),
          defaultSubAgent: z.enum(['explore', 'plan', 'general_purpose']).optional(),
          defaultTimeoutMs: z.number().optional(),
        }).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const service = ctx.services.workflowService;
      const { id, ...dto } = input;
      return service.updateWorkflow(id, dto as any);
    }),

  // Delete workflow (admin only)
  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const service = ctx.services.workflowService;
      return service.deleteWorkflow(input.id);
    }),

  // Get single workflow
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const service = ctx.services.workflowService;
      return service.getWorkflow(input.id);
    }),

  // List workflows
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).optional(),
        pageSize: z.number().min(1).max(100).optional(),
        isActive: z.boolean().optional(),
        createdBy: z.string().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const service = ctx.services.workflowService;
      return service.listWorkflows(input);
    }),

  // Trigger workflow execution
  run: protectedProcedure
    .input(z.object({ workflowId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const service = ctx.services.workflowService;
      return service.runWorkflow(input.workflowId, ctx.user.id);
    }),

  // Cancel execution
  cancel: protectedProcedure
    .input(z.object({ executionId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const service = ctx.services.workflowService;
      return service.cancelExecution(input.executionId);
    }),

  // Get execution details
  getExecution: protectedProcedure
    .input(z.object({ executionId: z.string() }))
    .query(async ({ input, ctx }) => {
      const service = ctx.services.workflowService;
      return service.getExecution(input.executionId);
    }),

  // List executions for a workflow
  listExecutions: protectedProcedure
    .input(
      z.object({
        workflowId: z.string(),
        page: z.number().min(1).optional(),
        pageSize: z.number().min(1).max(100).optional(),
        status: z.string().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const service = ctx.services.workflowService;
      const { workflowId, ...options } = input;
      return service.listExecutions(workflowId, options);
    }),

  trigger: protectedProcedure.input(z.object({
    workflowId: z.string(),
  })).mutation(async ({ input, ctx }) => {
    const service = ctx.services.workflowService;
    return service.runWorkflow(input.workflowId, ctx.user.id);
  }),

  // --- Observability procedures (real data from database) ---

  getObservabilityStats: protectedProcedure.query(async ({ ctx }) => {
    const prisma = ctx.services.prisma;

    const [totalExecutions, totalSteps, completedExecs, soloStats] = await Promise.all([
      prisma.workflowExecution.count(),
      prisma.workflowStepExecution.count(),
      prisma.workflowExecution.findMany({
        where: { status: 'completed', completedAt: { not: null }, startedAt: { not: null } },
        select: { startedAt: true, completedAt: true },
        take: 1000,
      }),
      prisma.workflowStepExecution.count({
        where: {
          stepType: { in: ['ai-analyze', 'invoke-agent'] },
        },
      }),
    ]);

    // Calculate avg duration from startedAt -> completedAt
    let avgDurationMs = 0;
    if (completedExecs.length > 0) {
      const totalDuration = completedExecs.reduce((sum, e) => {
        return sum + ((e.completedAt?.getTime() ?? 0) - (e.startedAt?.getTime() ?? 0));
      }, 0);
      avgDurationMs = Math.round(totalDuration / completedExecs.length);
    }

    const totalFinished = await prisma.workflowExecution.count({
      where: { status: { in: ['completed', 'failed'] } },
    });
    const successCount = await prisma.workflowExecution.count({
      where: { status: 'completed' },
    });

    const soloSuccessCount = await prisma.workflowStepExecution.count({
      where: {
        stepType: { in: ['ai-analyze', 'invoke-agent'] },
        status: 'completed',
      },
    });

    return {
      totalExecutions,
      totalSteps,
      successRate: totalFinished > 0 ? successCount / totalFinished : 0,
      avgDurationMs,
      totalSOLOCalls: soloStats,
      soloSuccessRate: soloStats > 0 ? soloSuccessCount / soloStats : 0,
    };
  }),

  getRecentExecutions: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).optional() }))
    .query(async ({ input, ctx }) => {
      const limit = input.limit ?? 10;
      const prisma = ctx.services.prisma;

      const executions = await prisma.workflowExecution.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          stepExecutions: true,
          workflow: { select: { name: true } },
        },
      });

      const items = executions.map((exec) => {
        let workflowName = exec.workflow?.name ?? 'Unknown';
        // Fallback: try to extract name from workflowSnapshot JSON
        if (!exec.workflow?.name && exec.workflowSnapshot) {
          try {
            const snapshot = JSON.parse(exec.workflowSnapshot);
            if (snapshot.name) workflowName = snapshot.name;
          } catch {
            // ignore parse errors
          }
        }

        const stepsCompleted = exec.stepExecutions.filter(
          (s) => s.status === 'completed',
        ).length;
        const totalSteps = exec.stepExecutions.length;
        const durationMs =
          exec.startedAt && exec.completedAt
            ? exec.completedAt.getTime() - exec.startedAt.getTime()
            : exec.startedAt
              ? Date.now() - exec.startedAt.getTime()
              : 0;

        return {
          id: exec.id,
          workflowName,
          status: exec.status,
          durationMs,
          stepsCompleted,
          totalSteps,
          startedAt: exec.startedAt ?? exec.createdAt,
        };
      });

      return { items };
    }),

  getStepPerformance: protectedProcedure.query(async ({ ctx }) => {
    const prisma = ctx.services.prisma;

    const stepGroups = await prisma.workflowStepExecution.groupBy({
      by: ['stepType'],
      _count: { id: true },
      _avg: { durationMs: true },
      where: { status: { in: ['completed', 'failed'] } },
    });

    const failCounts = await prisma.workflowStepExecution.groupBy({
      by: ['stepType'],
      _count: { id: true },
      where: { status: 'failed' },
    });

    const failCountMap = new Map(
      failCounts.map((f) => [f.stepType, f._count.id]),
    );

    const stepLabels: Record<string, string> = {
      'create-task': '创建任务',
      'update-status': '更新状态',
      'ai-analyze': 'AI 分析',
      'send-notification': '发送通知',
      condition: '条件判断',
      wait: '等待',
      'http-request': 'HTTP 请求',
      transform: '数据转换',
      foreach: '循环',
      'parallel-group': '并行组',
      approval: '审批',
      'invoke-agent': '调用代理',
    };

    const items = stepGroups.map((group) => {
      const totalCalls = group._count.id;
      const failCount = failCountMap.get(group.stepType) ?? 0;
      const successCount = totalCalls - failCount;

      return {
        stepType: group.stepType,
        label: stepLabels[group.stepType] ?? group.stepType,
        totalCalls,
        avgDurationMs: Math.round(group._avg.durationMs ?? 0),
        failureRate: totalCalls > 0 ? failCount / totalCalls : 0,
        successCount,
        failCount,
      };
    });

    return { items };
  }),

  getSOLOCallHistory: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).optional() }))
    .query(async ({ input, ctx }) => {
      const limit = input.limit ?? 10;
      const prisma = ctx.services.prisma;

      const soloSteps = await prisma.workflowStepExecution.findMany({
        where: {
          stepType: { in: ['ai-analyze', 'invoke-agent'] },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      const items = soloSteps.map((step) => {
        let prompt = '';
        if (step.input) {
          try {
            const parsed = JSON.parse(step.input);
            prompt = parsed.prompt ?? parsed.query ?? parsed.message ?? '';
          } catch {
            prompt = step.input.slice(0, 100);
          }
        }

        return {
          id: step.id,
          mode: step.soloCallMode ?? 'mcp',
          subAgent: step.soloSubAgent ?? 'general_purpose',
          prompt,
          durationMs: step.durationMs ?? 0,
          success: step.status === 'completed',
          tokensUsed: step.tokensUsed ?? 0,
          startedAt: step.startedAt ?? step.createdAt,
        };
      });

      return { items };
    }),
});
