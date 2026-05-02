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
          byLevel: Object.fromEntries(byLevel.map((g: any) => [g.level, g._count])),
          byChannel: Object.fromEntries(byChannel.map((g: any) => [g.channel, g._count])),
        };
      } finally {
        await prisma.$disconnect();
      }
    }),

  /**
   * Get channel-level statistics for ops panel
   */
  getChannelStats: protectedProcedure.query(async ({ ctx }) => {
    const prisma = ctx.services.prisma;
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [byChannel24h, byChannelFailed, totalByChannel] = await Promise.all([
      prisma.notification.groupBy({
        by: ['channel'],
        _count: { id: true },
        where: { createdAt: { gte: since24h } },
      }),
      prisma.notification.groupBy({
        by: ['channel'],
        _count: { id: true },
        where: { 
          createdAt: { gte: since24h },
          level: 'error',
        },
      }),
      prisma.notification.groupBy({
        by: ['channel'],
        _count: { id: true },
      }),
    ]);

    const sentMap = new Map<string, number>(byChannel24h.map((g: any) => [g.channel, g._count.id]));
    const failedMap = new Map<string, number>(byChannelFailed.map((g: any) => [g.channel, g._count.id]));
    const totalMap = new Map<string, number>(totalByChannel.map((g: any) => [g.channel, g._count.id]));

    // Get all unique channels
    const allChannels = new Set<string>([...sentMap.keys(), ...failedMap.keys(), ...totalMap.keys()]);
    
    const channelLabels: Record<string, { name: string; icon: string }> = {
      email: { name: '邮件', icon: '📧' },
      webhook: { name: 'Webhook', icon: '🔗' },
      'in-app': { name: '站内信', icon: '🔔' },
      slack: { name: 'Slack', icon: '💬' },
      push: { name: '推送', icon: '📱' },
    };

    const channels = [...allChannels].map((channel: string) => {
      const sent: number = sentMap.get(channel) ?? 0;
      const failed: number = failedMap.get(channel) ?? 0;
      const label = channelLabels[channel] ?? { name: channel, icon: '📡' };
      return {
        id: channel,
        name: label.name,
        icon: label.icon,
        status: sent > 0 ? (failed / sent > 0.1 ? 'degraded' as const : 'active' as const) : 'disabled' as const,
        sent24h: sent,
        failed24h: failed,
        avgLatencyMs: 0, // Notification table doesn't track latency
        total: totalMap.get(channel) ?? 0,
      };
    });

    return { channels };
  }),

  /**
   * Get delivery statistics for ops panel
   */
  getDeliveryStats: protectedProcedure.query(async ({ ctx }) => {
    const prisma = ctx.services.prisma;
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [total24h, unread24h, error24h, activeChannels] = await Promise.all([
      prisma.notification.count({ where: { createdAt: { gte: since24h } } }),
      prisma.notification.count({ where: { createdAt: { gte: since24h }, isRead: false } }),
      prisma.notification.count({ where: { createdAt: { gte: since24h }, level: 'error' } }),
      prisma.notification.groupBy({
        by: ['channel'],
        _count: { id: true },
        where: { createdAt: { gte: since24h } },
      }),
    ]);

    return {
      sent24h: total24h,
      failed24h: error24h,
      deliveryRate: total24h > 0 ? (total24h - error24h) / total24h : 1,
      activeChannels: activeChannels.length,
      unread24h,
    };
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
