// ============================================================
// Requirements Module - Project Requirement Analysis
// ============================================================

import type { Module, ModuleContext } from '@/lib/core/types';
import { APP_VERSION } from '@/lib/core/version';

export default class RequirementsModule implements Module {
  id = 'requirements';
  name = '需求分析';
  version = APP_VERSION;
  description = '需求分析模块，支持需求的创建、分解、优先级分析、验收标准生成和任务映射';
  dependencies = ['task-core'];

  lifecycle = {
    install: async (context: ModuleContext) => {
      context.logger.info('[Requirements] Installing...');
    },
    enable: async (context: ModuleContext) => {
      context.logger.info('[Requirements] Enabling...');
      const { RequirementsService } = await import('./requirements.service');
      const service = new RequirementsService(context.logger, context.eventBus);
      context.container.register('RequirementsService', () => service);
      context.logger.info('[Requirements] Enabled');
    },
    disable: async () => {
      console.log('[Requirements] Disabled');
    },
    uninstall: async () => {
      console.log('[Requirements] Uninstalled');
    },
  };
}
