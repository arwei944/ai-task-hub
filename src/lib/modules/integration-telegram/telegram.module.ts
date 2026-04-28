import type { Module, ModuleContext } from '@/lib/core/types';
import { TelegramAdapter } from './telegram.adapter';

export default class TelegramIntegrationModule implements Module {
  id = 'integration-telegram';
  name = 'Telegram 集成';
  version = '1.0.0';
  description = 'Telegram Bot 双向操作 + 通知推送';
  dependencies = ['task-core'];

  lifecycle = {
    install: async (context: ModuleContext): Promise<void> => {
      context.logger.info('TelegramIntegrationModule installing...');
    },

    enable: async (context: ModuleContext): Promise<void> => {
      context.logger.info('TelegramIntegrationModule enabling...');

      const adapter = new TelegramAdapter(context.logger);
      context.container.register('TelegramAdapter', () => adapter);

      if (context.container.has('IntegrationService')) {
        const integrationService = context.container.resolve<any>('IntegrationService');
        integrationService.registerAdapter(adapter);
      }

      context.logger.info('TelegramIntegrationModule enabled');
    },

    disable: async (): Promise<void> => {
      console.log('[TelegramIntegrationModule] Disabled');
    },

    uninstall: async (): Promise<void> => {
      console.log('[TelegramIntegrationModule] Uninstalled');
    },
  };
}
