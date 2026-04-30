import type { ILogger } from '@/lib/core/types';
import type { NotificationPreferenceService } from '@/lib/modules/notifications/preference.service';

export function createNotificationPreferenceToolHandlers(service: NotificationPreferenceService, logger: ILogger) {
  return {
    get_notification_preference: async (args: Record<string, unknown>) => {
      const { userId } = args as any;
      const pref = await service.getPreference(userId);
      if (!pref) {
        return { success: false, error: 'No preference found for user. Use set_notification_preference to create one.' };
      }
      return { success: true, preference: pref };
    },

    set_notification_preference: async (args: Record<string, unknown>) => {
      const { userId, eventPatterns, channels, minLevel, digestEnabled, digestInterval, quietHoursEnabled, quietHoursStart, quietHoursEnd, includeOwnActions } = args as any;
      try {
        const pref = await service.upsertPreference(userId, {
          eventPatterns, channels, minLevel, digestEnabled, digestInterval,
          quietHoursEnabled, quietHoursStart, quietHoursEnd, includeOwnActions,
        });
        return { success: true, preference: pref };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },

    check_notification_delivery: async (args: Record<string, unknown>) => {
      const { userId, eventType, level, actorId } = args as any;
      const pref = await service.getPreference(userId);
      if (!pref) {
        return { success: true, deliver: true, reason: 'no_preference_set (defaults to deliver)' };
      }

      const result = service.shouldDeliver(pref, {
        eventType,
        level,
        actorId,
        userId,
      });

      return { success: true, ...result };
    },
  };
}
