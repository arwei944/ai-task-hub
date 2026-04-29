import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, adminProcedure } from './server';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

let _prisma: PrismaClient | null = null;
function getPrisma(): PrismaClient {
  if (_prisma) return _prisma;
  const dbPath = process.env.DATABASE_URL?.replace(/^file:/, '') ?? './prisma/dev.db';
  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  _prisma = new PrismaClient({ adapter });
  return _prisma;
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
      const prisma = getPrisma();
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
      const prisma = getPrisma();
      return prisma.feedbackCheckpoint.update({
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
    }),

  listRules: protectedProcedure.query(async () => {
    const prisma = getPrisma();
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
      const prisma = getPrisma();
      return prisma.feedbackRule.create({ data: { ...input, createdBy: 'user' } });
    }),

  getStats: protectedProcedure.query(async () => {
    const prisma = getPrisma();
    const [pending, total, approved, rejected] = await Promise.all([
      prisma.feedbackCheckpoint.count({ where: { status: 'pending' } }),
      prisma.feedbackCheckpoint.count(),
      prisma.feedbackCheckpoint.count({ where: { status: 'approved' } }),
      prisma.feedbackCheckpoint.count({ where: { status: 'rejected' } }),
    ]);
    return { pending, total, approved, rejected };
  }),
});
