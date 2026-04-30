import type { ILogger } from '@/lib/core/types';
import type { OutboundWebhookService } from '@/lib/modules/integration-webhook/outbound-webhook.service';

/**
 * Create MCP tool handlers for outbound webhook retry operations
 * @param service - The OutboundWebhookService instance
 * @param logger - Logger instance
 * @returns Record of tool name to handler function
 */
export function createWebhookRetryToolHandlers(service: OutboundWebhookService, logger: ILogger) {
  return {
    /**
     * Manually retry a failed webhook delivery
     */
    webhook_retry_delivery: async (args: Record<string, unknown>) => {
      const { deliveryId } = args as { deliveryId: string };
      try {
        const result = await service.retryDelivery(deliveryId);
        return { success: result.success, retryCount: result.retryCount, error: result.error ?? null };
      } catch (error: any) {
        logger.error('webhook_retry_delivery failed', { error: String(error) });
        return { success: false, error: error.message };
      }
    },

    /**
     * Get retry queue status and pending items
     */
    webhook_get_retry_queue: async () => {
      try {
        const stats = service.getRetryQueueStats();
        return { success: true, stats };
      } catch (error: any) {
        logger.error('webhook_get_retry_queue failed', { error: String(error) });
        return { success: false, error: error.message };
      }
    },

    /**
     * Clear all pending retries from the queue
     */
    webhook_clear_retry_queue: async () => {
      try {
        const clearedCount = service.clearRetryQueue();
        return { success: true, clearedCount };
      } catch (error: any) {
        logger.error('webhook_clear_retry_queue failed', { error: String(error) });
        return { success: false, error: error.message };
      }
    },
  };
}
