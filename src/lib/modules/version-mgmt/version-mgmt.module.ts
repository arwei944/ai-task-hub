import type { Module, ModuleContext } from '@/lib/core/types';

export default class VersionMgmtModule implements Module {
  id = 'version-mgmt';
  name = '版本管理';
  version = '1.0.0';
  description = '项目版本发布管理、变更日志、审批流程、版本对比、标签管理';
  dependencies = ['task-core'];

  lifecycle = {
    install: async (context: ModuleContext) => {
      context.logger.info('[VersionMgmt] Installing...');
    },
    enable: async (context: ModuleContext) => {
      context.logger.info('[VersionMgmt] Enabling...');
      const { VersionMgmtService } = await import('./version-mgmt.service');
      const service = new VersionMgmtService(context.logger);
      context.container.register('VersionMgmtService', () => service);
      context.logger.info('[VersionMgmt] Enabled');
    },
    disable: async () => {
      console.log('[VersionMgmt] Disabled');
    },
    uninstall: async () => {
      console.log('[VersionMgmt] Uninstalled');
    },
  };
}
