// ============================================================
// Lifecycle Module - Project Lifecycle Management
// ============================================================

import type { Module, ModuleContext } from '@/lib/core/types';
import { APP_VERSION } from '@/lib/core/version';

export default class LifecycleModule implements Module {
  id = 'lifecycle';
  name = '项目生命周期管理';
  version = APP_VERSION;
  description = '项目阶段转换管理、审批流程、阶段规则引擎';
  dependencies = ['task-core'];

  lifecycle = {
    install: async (context: ModuleContext) => {
      context.logger.info('[Lifecycle] Installing...');
    },
    enable: async (context: ModuleContext) => {
      context.logger.info('[Lifecycle] Enabling...');
      const { LifecycleService } = await import('./lifecycle.service');
      const service = new LifecycleService(context.logger, context.eventBus);
      context.container.register('LifecycleService', () => service);

      // Subscribe to phase change events for auto-validation
      if (context.eventBus) {
        context.eventBus.on('project.phase.changed', (event) => {
          const { projectId, previousPhase, newPhase } = event.payload as any;
          context.logger.info(
            `[Lifecycle] Phase changed for project ${projectId}: ${previousPhase} -> ${newPhase}`,
          );
        });
      }

      context.logger.info('[Lifecycle] Enabled');
    },
    disable: async () => {
      console.log('[Lifecycle] Disabled');
    },
    uninstall: async () => {
      console.log('[Lifecycle] Uninstalled');
    },
  };
}
