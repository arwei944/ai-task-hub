import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from './server';

/**
 * tRPC router for notification history management.
 * Provides listing, stats, read status, and deletion of notifications.
 */
export const notificationHistoryRouter = createTRPCRouter({
  /**
   * List notifications with optional filters
   */
  list: protectedProcedure
    .input(z.object({
      level: z.string().optional(),
      channel: z.string().optional(),
      isRead: z.boolean().optional(),
      limit: z.number().min(1).max(200).optional(),
      offset: z.number().min(0).optional(),
    }).optional())
    .query(async ({ input, ctx }) => {
      const prisma = ctx.services.prisma;
      try {
        const where: Record<string, unknown> = {};
        if (input?.level) where.level = input.level;
        if (input?.channel) where.channel = input.channel;
        if (input?.isRead !== undefined) where.isRead = input.isRead;

        const [items, total] = await Promise.all([
          prisma.notification.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: input?.limit ?? 50,
            skip: input?.offset ?? 0,
          }),
          prisma.notification.count({ where }),
        ]);

        return { items, total };
      } finally {
        await prisma.$disconnect();
      }
    }),

  /**
   * Mark a single notification as read
   */
  markRead: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const prisma = ctx.services.prisma;
      try {
        await prisma.notification.update({
          where: { id: input.id },
          data: { isRead: true },
        });
        return { success: true };
      } catch (error: any) {
        if (error.code === 'P2025') throw new Error('Notification not found');
        throw error;
      } finally {
        await prisma.$disconnect();
      }
    }),

  /**
   * Mark all notifications as read for the current user
   */
  markAllRead: protectedProcedure
    .mutation(async ({ ctx }) => {
      const prisma = ctx.services.prisma;
      try {
        const result = await prisma.notification.updateMany({
          where: { isRead: false },
          data: { isRead: true },
        });
        return { success: true, updatedCount: result.count };
      } finally {
        await prisma.$disconnect();
      }
    }),

  /**
   * Get notification statistics
   */
  getStats: protectedProcedure
    .query(async ({ ctx }) => {
      const prisma = ctx.services.prisma;
      try {
        const [total, unread, byLevel, byChannel] = await Promise.all([
          prisma.notification.count(),
          prisma.notification.count({ where: { isRead: false } }),
          prisma.notification.groupBy({
            by: ['level'],
            _count: true,
          }),
          prisma.notification.groupBy({
            by: ['channel'],
            _count: true,
          }),
        ]);

        return {
          total,
          unread,
          byLevel: Object.fromEntries(byLevel.map(g => [g.level, g._count])),
          byChannel: Object.fromEntries(byChannel.map(g => [g.channel, g._count])),
        };
      } finally {
        await prisma.$disconnect();
      }
    }),

  /**
   * Delete a notification
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const prisma = ctx.services.prisma;
      try {
        await prisma.notification.delete({ where: { id: input.id } });
        return { success: true };
      } catch (error: any) {
        if (error.code === 'P2025') throw new Error('Notification not found');
        throw error;
      } finally {
        await prisma.$disconnect();
      }
    }),
});
