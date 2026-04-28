import type { Module, ModuleContext } from '@/lib/core/types';
import { WebhookAdapter } from './webhook.adapter';

export default class WebhookIntegrationModule implements Module {
  id = 'integration-webhook';
  name = '通用 Webhook';
  version = '1.0.0';
  description = '接收任意 Webhook，通过规则引擎自动创建/更新任务';
  dependencies = ['task-core'];

  lifecycle = {
    install: async (context: ModuleContext): Promise<void> => {
      context.logger.info('WebhookIntegrationModule installing...');
    },

    enable: async (context: ModuleContext): Promise<void> => {
      context.logger.info('WebhookIntegrationModule enabling...');

      const adapter = new WebhookAdapter(context.logger);
      context.container.register('WebhookAdapter', () => adapter);

      if (context.container.has('IntegrationService')) {
        const integrationService = context.container.resolve<any>('IntegrationService');
        integrationService.registerAdapter(adapter);
      }

      context.logger.info('WebhookIntegrationModule enabled');
    },

    disable: async (): Promise<void> => {
      console.log('[WebhookIntegrationModule] Disabled');
    },

    uninstall: async (): Promise<void> => {
      console.log('[WebhookIntegrationModule] Uninstalled');
    },
  };
}
