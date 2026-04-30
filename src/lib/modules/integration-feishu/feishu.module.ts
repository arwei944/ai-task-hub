import type { Module, ModuleContext } from '@/lib/core/types';
import { FeishuAdapter } from './feishu.adapter';
import { APP_VERSION } from '@/lib/core/version';

export default class FeishuIntegrationModule implements Module {
  id = 'integration-feishu';
  name = '飞书集成';
  version = APP_VERSION;
  description = '同步飞书任务，支持 Webhook 事件处理';
  dependencies = ['task-core'];

  lifecycle = {
    install: async (context: ModuleContext): Promise<void> => {
      context.logger.info('FeishuIntegrationModule installing...');
    },

    enable: async (context: ModuleContext): Promise<void> => {
      context.logger.info('FeishuIntegrationModule enabling...');

      const adapter = new FeishuAdapter(context.logger);
      context.container.register('FeishuAdapter', () => adapter);

      if (context.container.has('IntegrationService')) {
        const integrationService = context.container.resolve<any>('IntegrationService');
        integrationService.registerAdapter(adapter);
      }

      context.logger.info('FeishuIntegrationModule enabled');
    },

    disable: async (): Promise<void> => {
      console.log('[FeishuIntegrationModule] Disabled');
    },

    uninstall: async (): Promise<void> => {
      console.log('[FeishuIntegrationModule] Uninstalled');
    },
  };
}
