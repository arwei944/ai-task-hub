import type { ILogger } from '@/lib/core/types';
import type { OutboundWebhookService } from '@/lib/modules/integration-webhook/outbound-webhook.service';

export function createOutboundWebhookToolHandlers(service: OutboundWebhookService, logger: ILogger) {
  return {
    create_outbound_webhook: async (args: Record<string, unknown>) => {
      const { name, url, secret, eventPatterns, headers } = args as any;
      try {
        const webhook = await service.createWebhook({
          name,
          url,
          secret,
          eventPatterns: eventPatterns || '*',
          headers,
        });
        return { success: true, webhook };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },

    list_outbound_webhooks: async (args: Record<string, unknown>) => {
      const { isActive } = args as any;
      try {
        const webhooks = await service.listWebhooks(
          isActive !== undefined ? { isActive } : undefined,
        );
        return { success: true, webhooks, count: webhooks.length };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },

    update_outbound_webhook: async (args: Record<string, unknown>) => {
      const { id, name, url, secret, eventPatterns, headers, isActive } = args as any;
      try {
        const webhook = await service.updateWebhook(id, {
          name, url, secret, eventPatterns, headers, isActive,
        });
        if (!webhook) {
          return { success: false, error: 'Webhook not found' };
        }
        return { success: true, webhook };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },

    delete_outbound_webhook: async (args: Record<string, unknown>) => {
      const { id } = args as any;
      const deleted = await service.deleteWebhook(id);
      if (!deleted) {
        return { success: false, error: 'Webhook not found' };
      }
      return { success: true, message: 'Webhook deleted' };
    },

    list_webhook_deliveries: async (args: Record<string, unknown>) => {
      const { webhookId, eventType, success, limit } = args as any;
      try {
        const deliveries = await service.listDeliveries({
          webhookId, eventType, success, limit: limit ?? 50,
        });
        return { success: true, deliveries, count: deliveries.length };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },

    dispatch_event_to_webhooks: async (args: Record<string, unknown>) => {
      const { eventType, payload } = args as any;
      try {
        const result = await service.dispatchEvent({
          type: eventType,
          payload,
          timestamp: new Date(),
          source: 'manual',
        });
        return { success: true, ...result };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  };
}
