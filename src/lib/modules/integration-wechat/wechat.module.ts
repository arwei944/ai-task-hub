import type { Module, ModuleContext } from '@/lib/core/types';
import { WeChatAdapter } from './wechat.adapter';

export default class WeChatIntegrationModule implements Module {
  id = 'integration-wechat';
  name = '企业微信集成';
  version = '1.0.0';
  description = '企业微信 Bot 双向操作 + 通知推送';
  dependencies = ['task-core'];

  lifecycle = {
    install: async (context: ModuleContext): Promise<void> => {
      context.logger.info('WeChatIntegrationModule installing...');
    },

    enable: async (context: ModuleContext): Promise<void> => {
      context.logger.info('WeChatIntegrationModule enabling...');

      const adapter = new WeChatAdapter(context.logger);
      context.container.register('WeChatAdapter', () => adapter);

      if (context.container.has('IntegrationService')) {
        const integrationService = context.container.resolve<any>('IntegrationService');
        integrationService.registerAdapter(adapter);
      }

      context.logger.info('WeChatIntegrationModule enabled');
    },

    disable: async (): Promise<void> => {
      console.log('[WeChatIntegrationModule] Disabled');
    },

    uninstall: async (): Promise<void> => {
      console.log('[WeChatIntegrationModule] Uninstalled');
    },
  };
}
