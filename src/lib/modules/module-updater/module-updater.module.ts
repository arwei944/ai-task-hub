import type { Module, ModuleContext } from '@/lib/core/types';
import { APP_VERSION } from '@/lib/core/version';

export default class ModuleUpdaterModule implements Module {
  id = 'module-updater';
  name = '模块热更新';
  version = APP_VERSION;
  description = '运行时模块热更新、版本管理与回滚';
  dependencies = ['task-core'];

  lifecycle = {
    install: async (context: ModuleContext): Promise<void> => {
      context.logger.info('ModuleUpdaterModule installing...');
    },

    enable: async (context: ModuleContext): Promise<void> => {
      context.logger.info('ModuleUpdaterModule enabling...');

      // Repository
      const { getPrisma } = await import('@/lib/db');
      const prisma = getPrisma();

      const { ModuleVersionRepository } = await import('./module-version.repository');
      const { AppVersionRepository } = await import('./app-version.repository');
      const { ModuleUpdaterService } = await import('./module-updater.service');

      const moduleVersionRepo = new ModuleVersionRepository(prisma);
      const appVersionRepo = new AppVersionRepository(prisma);

      context.container.register('ModuleVersionRepository', () => moduleVersionRepo);
      context.container.register('AppVersionRepository', () => appVersionRepo);

      const updaterService = new ModuleUpdaterService(
        moduleVersionRepo,
        appVersionRepo,
        context.registry,
        context.eventBus,
        context.logger,
      );

      context.container.register('ModuleUpdaterService', () => updaterService);

      // Register initial app version if none exists
      const currentVersion = await appVersionRepo.getCurrent();
      if (!currentVersion) {
        await appVersionRepo.create({
          version: APP_VERSION,
          channel: 'stable',
          releaseNotes: `初始版本 - AI Task Hub v${APP_VERSION}\n\n功能:\n- 任务核心管理\n- AI 引擎\n- MCP 服务\n- 智能体协作\n- 平台集成 (GitHub/飞书/Notion/Webhook/Telegram/企业微信)\n- 通知系统\n- 模块热更新`,
          isCurrent: true,
        });
      }

      context.logger.info('ModuleUpdaterModule enabled');
    },

    disable: async (): Promise<void> => {
      console.log('[ModuleUpdaterModule] Disabled');
    },

    uninstall: async (): Promise<void> => {
      console.log('[ModuleUpdaterModule] Uninstalled');
    },
  };
}
