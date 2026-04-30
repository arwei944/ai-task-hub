import type { Module, ModuleContext } from '@/lib/core/types';

export default class KnowledgeModule implements Module {
  id = 'knowledge';
  name = '知识管理';
  version = '1.0.0';
  description = '知识库管理，支持经验教训、决策记录、模式识别、解决方案模板等知识条目的创建、搜索和统计';
  dependencies = [];

  lifecycle = {
    install: async (context: ModuleContext) => {
      context.logger.info('[Knowledge] Installing...');
    },
    enable: async (context: ModuleContext) => {
      context.logger.info('[Knowledge] Enabling...');
      const { KnowledgeService } = await import('./knowledge.service');
      const service = new KnowledgeService(context.logger, context.eventBus);
      context.container.register('KnowledgeService', () => service);
      context.logger.info('[Knowledge] Enabled');
    },
    disable: async () => {
      console.log('[Knowledge] Disabled');
    },
    uninstall: async () => {
      console.log('[Knowledge] Uninstalled');
    },
  };
}
