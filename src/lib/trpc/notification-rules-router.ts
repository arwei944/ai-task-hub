import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, adminProcedure } from './server';

async function getPrisma() {
  const { getPrisma: _getPrisma } = await import('@/lib/db');
  return _getPrisma();
}

export const notificationRulesRouter = createTRPCRouter({
  // List notification rules
  list: protectedProcedure
    .input(z.object({ isActive: z.boolean().optional() }).optional())
    .query(async ({ input }) => {
      const prisma = await getPrisma();
      try {
        const where: Record<string, unknown> = {};
        if (input?.isActive !== undefined) where.isActive = input.isActive;
        return await prisma.notificationRule.findMany({
          where,
          orderBy: { priority: 'desc' },
        });
      } finally { await prisma.$disconnect(); }
    }),

  // Create notification rule
  create: adminProcedure
    .input(z.object({
      name: z.string(),
      eventPattern: z.string(),
      action: z.enum(['notify', 'log', 'webhook']).optional(),
      level: z.enum(['info', 'warning', 'error', 'success']).optional(),
      titleTemplate: z.string().optional(),
      messageTemplate: z.string().optional(),
      channels: z.string().optional(),
      priority: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const prisma = await getPrisma();
      try {
        return await prisma.notificationRule.create({
          data: {
            name: input.name,
            eventPattern: input.eventPattern,
            action: input.action ?? 'notify',
            level: input.level ?? null,
            titleTemplate: input.titleTemplate ?? null,
            messageTemplate: input.messageTemplate ?? null,
            channels: input.channels ?? 'system',
            priority: input.priority ?? 0,
          },
        });
      } finally { await prisma.$disconnect(); }
    }),

  // Update notification rule
  update: adminProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      eventPattern: z.string().optional(),
      action: z.enum(['notify', 'log', 'webhook']).optional(),
      level: z.enum(['info', 'warning', 'error', 'success']).optional(),
      titleTemplate: z.string().optional(),
      messageTemplate: z.string().optional(),
      channels: z.string().optional(),
      isActive: z.boolean().optional(),
      priority: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const prisma = await getPrisma();
      try {
        const { id, ...data } = input;
        return await prisma.notificationRule.update({ where: { id }, data });
      } catch (error: any) {
        if (error.code === 'P2025') throw new Error('Rule not found');
        throw error;
      } finally { await prisma.$disconnect(); }
    }),

  // Delete notification rule
  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const prisma = await getPrisma();
      try {
        await prisma.notificationRule.delete({ where: { id: input.id } });
        return { success: true };
      } catch (error: any) {
        if (error.code === 'P2025') throw new Error('Rule not found');
        throw error;
      } finally { await prisma.$disconnect(); }
    }),
});
