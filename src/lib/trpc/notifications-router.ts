import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from './server';
import type { PushSubscriptionLike } from '@/lib/modules/notifications/web-push.service';

/** Zod schema matching the PushSubscription JSON structure */
const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().optional(),
    auth: z.string().optional(),
  }).optional(),
});

export const notificationsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({
      type: z.string().optional(),
      isRead: z.boolean().optional(),
      level: z.string().optional(),
      limit: z.number().min(1).max(200).optional(),
      offset: z.number().min(0).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const repo = ctx.services.notificationRepo;
      return repo.findMany(input);
    }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const repo = ctx.services.notificationRepo;
    return repo.findUnreadCount();
  }),

  markAsRead: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const repo = ctx.services.notificationRepo;
    await repo.markAsRead(input.id);
    return { success: true };
  }),

  markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
    const repo = ctx.services.notificationRepo;
    await repo.markAllAsRead();
    return { success: true };
  }),

  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const repo = ctx.services.notificationRepo;
    await repo.delete(input.id);
    return { success: true };
  }),

  // ----------------------------------------------------------
  // Web Push subscription procedures
  // ----------------------------------------------------------

  pushSubscribe: protectedProcedure
    .input(pushSubscriptionSchema)
    .mutation(async ({ ctx, input }) => {
      const push = ctx.services.webPushService;
      const userId = ctx.user.id;
      push.subscribe(userId, input as unknown as PushSubscriptionLike);
      return { success: true };
    }),

  pushUnsubscribe: protectedProcedure
    .mutation(async ({ ctx }) => {
      const push = ctx.services.webPushService;
      const userId = ctx.user.id;
      push.unsubscribe(userId);
      return { success: true };
    }),

  pushTest: protectedProcedure
    .mutation(async ({ ctx }) => {
      const push = ctx.services.webPushService;
      const userId = ctx.user.id;
      const sent = await push.sendNotification(
        userId,
        'Test Notification',
        'Web Push is working! If you see this, push notifications are configured correctly.',
        { test: true, timestamp: new Date().toISOString() },
      );
      return { success: sent, message: sent ? 'Test notification sent' : 'No active subscription found' };
    }),
});
