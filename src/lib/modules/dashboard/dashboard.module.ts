import type { Module, ModuleContext } from '@/lib/core/types';
import { APP_VERSION } from '@/lib/core/version';

export default class DashboardModule implements Module {
  id = 'dashboard';
  name = '数据可视化';
  version = APP_VERSION;
  description = '任务统计仪表盘、进度报告、风险预警';

  lifecycle = {
    install: async (context: ModuleContext): Promise<void> => {
      context.logger.info('DashboardModule installing...');
    },

    enable: async (context: ModuleContext): Promise<void> => {
      context.logger.info('DashboardModule enabled');
    },

    disable: async (): Promise<void> => {
      console.log('[DashboardModule] Disabled');
    },

    uninstall: async (): Promise<void> => {
      console.log('[DashboardModule] Uninstalled');
    },
  };
}
