import type { Module, ModuleContext } from '@/lib/core/types';
import { GitHubAdapter } from './github.adapter';
import { APP_VERSION } from '@/lib/core/version';

export default class GitHubIntegrationModule implements Module {
  id = 'integration-github';
  name = 'GitHub 集成';
  version = APP_VERSION;
  description = '同步 GitHub Issues 为任务，支持 Webhook 事件处理';
  dependencies = ['task-core'];

  lifecycle = {
    install: async (context: ModuleContext): Promise<void> => {
      context.logger.info('GitHubIntegrationModule installing...');
    },

    enable: async (context: ModuleContext): Promise<void> => {
      context.logger.info('GitHubIntegrationModule enabling...');

      const adapter = new GitHubAdapter(context.logger);
      context.container.register('GitHubAdapter', () => adapter);

      // Register with IntegrationService if available
      if (context.container.has('IntegrationService')) {
        const integrationService = context.container.resolve<any>('IntegrationService');
        integrationService.registerAdapter(adapter);
      }

      context.logger.info('GitHubIntegrationModule enabled');
    },

    disable: async (): Promise<void> => {
      console.log('[GitHubIntegrationModule] Disabled');
    },

    uninstall: async (): Promise<void> => {
      console.log('[GitHubIntegrationModule] Uninstalled');
    },
  };
}
