// ============================================================
// Test Management Module
// ============================================================

import type { Module, ModuleContext } from '@/lib/core/types';
import { testManagementMcpTools } from '@/lib/modules/mcp-server/tools/test-management-tools';
import { APP_VERSION } from '@/lib/core/version';

export default class TestManagementModule implements Module {
  id = 'test-management';
  name = '测试管理';
  version = APP_VERSION;
  description = '测试用例管理、测试执行、测试套件、AI 测试生成';
  dependencies = ['task-core'];

  mcpTools = testManagementMcpTools;

  lifecycle = {
    install: async (context: ModuleContext): Promise<void> => {
      context.logger.info('TestManagementModule installing...');
    },

    enable: async (context: ModuleContext): Promise<void> => {
      context.logger.info('TestManagementModule enabling...');

      const { getPrisma } = await import('@/lib/db');
      const prisma = getPrisma();

      const { TestManagementService } = await import('./test-management.service');
      const service = new TestManagementService(
        context.logger,
        context.eventBus,
        () => prisma,
      );
      context.container.register('TestManagementService', () => service);

      context.logger.info('TestManagementModule enabled');
    },

    disable: async (): Promise<void> => {
      console.log('[TestManagementModule] Disabled');
    },

    uninstall: async (): Promise<void> => {
      console.log('[TestManagementModule] Uninstalled');
    },
  };
}
