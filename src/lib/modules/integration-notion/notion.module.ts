import type { Module, ModuleContext } from '@/lib/core/types';
import { NotionAdapter } from './notion.adapter';
import { APP_VERSION } from '@/lib/core/version';

export default class NotionIntegrationModule implements Module {
  id = 'integration-notion';
  name = 'Notion 集成';
  version = APP_VERSION;
  description = '同步 Notion 数据库为任务，支持字段映射';
  dependencies = ['task-core'];

  lifecycle = {
    install: async (context: ModuleContext): Promise<void> => {
      context.logger.info('NotionIntegrationModule installing...');
    },

    enable: async (context: ModuleContext): Promise<void> => {
      context.logger.info('NotionIntegrationModule enabling...');

      const adapter = new NotionAdapter(context.logger);
      context.container.register('NotionAdapter', () => adapter);

      if (context.container.has('IntegrationService')) {
        const integrationService = context.container.resolve<any>('IntegrationService');
        integrationService.registerAdapter(adapter);
      }

      context.logger.info('NotionIntegrationModule enabled');
    },

    disable: async (): Promise<void> => {
      console.log('[NotionIntegrationModule] Disabled');
    },

    uninstall: async (): Promise<void> => {
      console.log('[NotionIntegrationModule] Uninstalled');
    },
  };
}
