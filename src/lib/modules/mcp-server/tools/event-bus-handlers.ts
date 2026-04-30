import type { ILogger } from '@/lib/core/types';
import type { EventBus } from '@/lib/core/event-bus';

export function createEventBusToolHandlers(eventBus: EventBus, logger: ILogger) {
  return {
    get_event_bus_metrics: async () => {
      try {
        const metrics = eventBus.getMetrics();
        return { success: true, ...metrics };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },

    get_dead_letter_queue: async () => {
      try {
        const dlq = eventBus.getDeadLetterQueue();
        return {
          success: true,
          entries: dlq.map(e => ({
            id: e.id,
            eventType: e.event.type,
            handlerName: e.handlerName,
            error: e.error,
            retryCount: e.retryCount,
            maxRetries: e.maxRetries,
            firstFailedAt: e.firstFailedAt,
            lastFailedAt: e.lastFailedAt,
            nextRetryAt: e.nextRetryAt,
          })),
          count: dlq.length,
        };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },

    retry_dead_letter_queue: async () => {
      try {
        const result = await eventBus.retryDLQ();
        return { success: true, ...result };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },

    clear_dead_letter_queue: async () => {
      try {
        const count = eventBus.clearDLQ();
        return { success: true, cleared: count };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },

    remove_dlq_entry: async (args: Record<string, unknown>) => {
      const { id } = args as any;
      const removed = eventBus.removeFromDLQ(id);
      if (!removed) {
        return { success: false, error: 'DLQ entry not found' };
      }
      return { success: true, message: 'Entry removed' };
    },

    clean_expired_events: async () => {
      try {
        const count = await eventBus.cleanExpiredEvents();
        return { success: true, cleaned: count };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  };
}
