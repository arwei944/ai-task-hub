import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, adminProcedure } from './server';

async function getPrisma() {
  const { getPrisma: _getPrisma } = await import('@/lib/db');
  return _getPrisma();
}

export const feedbackRouter = createTRPCRouter({
  listCheckpoints: protectedProcedure
    .input(z.object({
      status: z.string().optional(),
      executionId: z.string().optional(),
      page: z.number().min(1).optional(),
      pageSize: z.number().min(1).max(100).optional(),
    }).optional())
    .query(async ({ input }) => {
      const prisma = await getPrisma();
      const where: Record<string, unknown> = {};
      if (input?.status) where.status = input.status;
      if (input?.executionId) where.executionId = input.executionId;

      const [items, total] = await Promise.all([
        prisma.feedbackCheckpoint.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: ((input?.page ?? 1) - 1) * (input?.pageSize ?? 20),
          take: input?.pageSize ?? 20,
        }),
        prisma.feedbackCheckpoint.count({ where }),
      ]);

      return { items, total, page: input?.page ?? 1, pageSize: input?.pageSize ?? 20 };
    }),

  handleApproval: protectedProcedure
    .input(z.object({
      checkpointId: z.string(),
      action: z.enum(['approved', 'rejected', 'modified', 'skipped']),
      intervention: z.string().optional(),
      rating: z.number().min(1).max(5).optional(),
      feedback: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const prisma = await getPrisma();
      const result = await prisma.feedbackCheckpoint.update({
        where: { id: input.checkpointId },
        data: {
          status: input.action,
          intervenedBy: 'user',
          intervention: input.intervention,
          rating: input.rating,
          feedback: input.feedback,
          resolvedAt: new Date(),
        },
      });

      // Emit EventBus event so downstream listeners react to the resolution
      try {
        const { getEventBus } = await import('@/lib/core/event-bus');
        getEventBus().emit({
          type: 'feedback.checkpoint.resolved',
          payload: { checkpointId: input.checkpointId, action: input.action },
          timestamp: new Date(),
          source: 'feedback-router',
        });
      } catch {}

      // Broadcast via SSE so other clients are notified in real time
      try {
        const { getSSEService } = await import('@/lib/modules/realtime/sse.service');
        getSSEService().broadcast('feedback', {
          type: 'checkpoint.resolved',
          data: { checkpointId: input.checkpointId, action: input.action },
        });
      } catch {}

      return result;
    }),

  listRules: protectedProcedure.query(async () => {
    const prisma = await getPrisma();
    return prisma.feedbackRule.findMany({ where: { isActive: true }, orderBy: { createdAt: 'desc' } });
  }),

  createRule: adminProcedure
    .input(z.object({
      name: z.string().min(1),
      triggerType: z.string(),
      triggerConfig: z.string(),
      action: z.string(),
      actionConfig: z.string().optional(),
      scopeWorkflowId: z.string().optional(),
      scopeStepType: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const prisma = await getPrisma();
      return prisma.feedbackRule.create({ data: { ...input, createdBy: 'user' } });
    }),

  getStats: protectedProcedure.query(async () => {
    const prisma = await getPrisma();
    const [pending, total, approved, rejected] = await Promise.all([
      prisma.feedbackCheckpoint.count({ where: { status: 'pending' } }),
      prisma.feedbackCheckpoint.count(),
      prisma.feedbackCheckpoint.count({ where: { status: 'approved' } }),
      prisma.feedbackCheckpoint.count({ where: { status: 'rejected' } }),
    ]);
    return { pending, total, approved, rejected };
  }),

  // Improvement Loop procedures
  runImprovementCycle: protectedProcedure
    .input(z.object({
      workflowId: z.string().optional(),
      days: z.number().min(1).max(90).optional(),
      autoApply: z.boolean().optional(),
    }).optional())
    .mutation(async ({ input }) => {
      try {
        const { getPrisma: _getPrisma } = await import('@/lib/db');
        const prisma = await _getPrisma();
        const { EventBus } = await import('@/lib/core/event-bus');
        const { Logger } = await import('@/lib/core/logger');
        const { SOLOBridge } = await import('@/lib/modules/workflow-engine/solo/solo-bridge');
        const { Observability } = await import('@/lib/modules/workflow-engine/observability');
        const { ImprovementLoop } = await import('@/lib/modules/workflow-engine/feedback/improvement-loop');

        const eventBus = new EventBus();
        const logger = new Logger('improvement-loop');
        const soloBridge = new SOLOBridge({
          defaultMode: 'mcp',
          mcpEndpoint: process.env.SOLO_MCP_ENDPOINT || 'http://localhost:3001/mcp',
          restEndpoint: process.env.SOLO_REST_ENDPOINT || 'http://localhost:3001/api/solo/call',
          defaultTimeoutMs: 30000,
          maxConcurrentSessions: 5,
        }, eventBus, logger);
        const observability = new Observability(eventBus, logger);
        const improvementLoop = new ImprovementLoop(prisma, soloBridge, observability, logger);

        const result = await improvementLoop.runImprovementCycle({
          workflowId: input?.workflowId,
          days: input?.days ?? 7,
          autoApply: input?.autoApply ?? false,
        });

        return {
          success: true,
          analysis: {
            totalCheckpoints: result.analysis.totalCheckpoints,
            approvalRate: result.analysis.approvalRate,
            rejectionRate: result.analysis.rejectionRate,
            highRiskSteps: (result.analysis as any).highRiskSteps?.length ?? 0,
          },
          recommendationsCount: result.recommendations.length,
          appliedCount: result.appliedCount,
          recommendations: result.recommendations.map(r => ({
            type: r.type,
            description: r.description,
            confidence: r.confidence,
            targetStepType: r.targetStepType,
          })),
        };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }),

  getImprovementHistory: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).optional() }).optional())
    .query(async ({ input }) => {
      try {
        const { getPrisma: _getPrisma } = await import('@/lib/db');
        const prisma = await _getPrisma();
        const { EventBus } = await import('@/lib/core/event-bus');
        const { Logger } = await import('@/lib/core/logger');
        const { SOLOBridge } = await import('@/lib/modules/workflow-engine/solo/solo-bridge');
        const { Observability } = await import('@/lib/modules/workflow-engine/observability');
        const { ImprovementLoop } = await import('@/lib/modules/workflow-engine/feedback/improvement-loop');

        const eventBus = new EventBus();
        const logger = new Logger('improvement-loop');
        const soloBridge = new SOLOBridge({
          defaultMode: 'mcp',
          mcpEndpoint: process.env.SOLO_MCP_ENDPOINT || 'http://localhost:3001/mcp',
          restEndpoint: process.env.SOLO_REST_ENDPOINT || 'http://localhost:3001/api/solo/call',
          defaultTimeoutMs: 30000,
          maxConcurrentSessions: 5,
        }, eventBus, logger);
        const observability = new Observability(eventBus, logger);
        const improvementLoop = new ImprovementLoop(prisma, soloBridge, observability, logger);

        return { items: improvementLoop.getImprovementHistory({ limit: input?.limit ?? 20 }) };
      } catch (error: any) {
        return { items: [], error: error.message };
      }
    }),
});
