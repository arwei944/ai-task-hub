import type { Module, ModuleContext } from '@/lib/core/types';
import { APP_VERSION } from '@/lib/core/version';

export default class DeploymentMgmtModule implements Module {
  id = 'deployment-mgmt';
  name = '部署管理';
  version = APP_VERSION;
  description = '多环境部署管理、部署流水线、健康检查、回滚机制';
  dependencies = ['task-core'];

  lifecycle = {
    install: async (_context: ModuleContext) => {
      // No special installation needed
    },

    enable: async (context: ModuleContext) => {
      const { DeploymentService } = await import('./deployment.service');
      const service = new DeploymentService(context.logger, context.eventBus);
      context.container.register('DeploymentService', () => service);

      // Subscribe to relevant events
      if (context.eventBus) {
        context.eventBus.on('project.phase.changed', (event: any) => {
          context.logger.info(`[deployment-mgmt] Project phase changed: ${event.payload?.projectId} → ${event.payload?.newPhase}`);
        });
      }
    },

    disable: async () => {
      // Cleanup if needed
    },

    uninstall: async () => {
      // Cleanup if needed
    },
  };
}
