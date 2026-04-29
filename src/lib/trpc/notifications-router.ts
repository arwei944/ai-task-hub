import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from './server';
import { NotificationRepository } from '@/lib/modules/notifications/notification.repository';
import { WebPushService } from '@/lib/modules/notifications/web-push.service';
import type { PushSubscriptionLike } from '@/lib/modules/notifications/web-push.service';
import { Logger } from '@/lib/core/logger';
import { getPrisma } from '@/lib/db';

let _repo: NotificationRepository | null = null;

function getRepo() {
  if (_repo) return _repo;
  const prisma = getPrisma();
  _repo = new NotificationRepository(prisma);
  return _repo;
}

// Singleton WebPushService (in-memory subscriptions)
let _pushService: WebPushService | null = null;

function getPushService(): WebPushService {
  if (!_pushService) {
    _pushService = new WebPushService(new Logger('WebPush'));
  }
  return _pushService;
}

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
    .query(async ({ input }) => {
      const repo = getRepo();
      return repo.findMany(input);
    }),

  unreadCount: protectedProcedure.query(async () => {
    const repo = getRepo();
    return getRepo().findUnreadCount();
  }),

  markAsRead: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    const repo = getRepo();
    await repo.markAsRead(input.id);
    return { success: true };
  }),

  markAllAsRead: protectedProcedure.mutation(async () => {
    const repo = getRepo();
    await repo.markAllAsRead();
    return { success: true };
  }),

  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    const repo = getRepo();
    await repo.delete(input.id);
    return { success: true };
  }),

  // ----------------------------------------------------------
  // Web Push subscription procedures
  // ----------------------------------------------------------

  pushSubscribe: protectedProcedure
    .input(pushSubscriptionSchema)
    .mutation(async ({ ctx, input }) => {
      const push = getPushService();
      const userId = ctx.user.id;
      push.subscribe(userId, input as unknown as PushSubscriptionLike);
      return { success: true };
    }),

  pushUnsubscribe: protectedProcedure
    .mutation(async ({ ctx }) => {
      const push = getPushService();
      const userId = ctx.user.id;
      push.unsubscribe(userId);
      return { success: true };
    }),

  pushTest: protectedProcedure
    .mutation(async ({ ctx }) => {
      const push = getPushService();
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
