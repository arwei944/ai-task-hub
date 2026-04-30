import type { ILogger } from '@/lib/core/types';
import type { WebPushService } from '@/lib/modules/notifications/web-push.service';

/**
 * Create tool handlers for Web Push notification tools.
 */
export function createWebPushToolHandlers(
  webPushServiceFn: () => WebPushService,
  logger: ILogger,
) {
  return {
    webpush_subscribe: async (args: Record<string, unknown>) => {
      const { userId, endpoint, keys } = args as {
        userId: string;
        endpoint: string;
        keys?: { p256dh?: string; auth?: string };
      };

      try {
        const service = webPushServiceFn();
        service.subscribe(userId, { endpoint, keys });

        return {
          success: true,
          message: `User ${userId} subscribed to push notifications`,
          userId,
          endpoint: endpoint.slice(0, 80) + '...',
        };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },

    webpush_unsubscribe: async (args: Record<string, unknown>) => {
      const { userId } = args as { userId: string };

      try {
        const service = webPushServiceFn();
        const removed = service.unsubscribe(userId);

        if (!removed) {
          return {
            success: false,
            error: `No subscription found for user ${userId}`,
          };
        }

        return {
          success: true,
          message: `User ${userId} unsubscribed from push notifications`,
        };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },

    webpush_send: async (args: Record<string, unknown>) => {
      const { userId, title, body, data } = args as {
        userId: string;
        title: string;
        body: string;
        data?: Record<string, unknown>;
      };

      try {
        const service = webPushServiceFn();
        const sent = await service.sendNotification(userId, title, body, data);

        if (!sent) {
          return {
            success: false,
            error: `Failed to send push notification to user ${userId}. User may not have an active subscription.`,
          };
        }

        return {
          success: true,
          message: `Push notification sent to user ${userId}`,
          title,
          body,
        };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },

    webpush_get_vapid_key: async () => {
      try {
        const service = webPushServiceFn();
        const publicKey = service.getVAPIDPublicKey();

        if (!publicKey) {
          return {
            success: false,
            error: 'VAPID public key not configured. Set VAPID_PUBLIC_KEY environment variable.',
            hint: 'You can generate VAPID keys using: npx web-push generate-vapid-keys',
          };
        }

        return {
          success: true,
          publicKey,
        };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  };
}
