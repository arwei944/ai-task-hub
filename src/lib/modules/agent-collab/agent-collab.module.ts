import type { Module, ModuleContext } from '@/lib/core/types';
import { APP_VERSION } from '@/lib/core/version';

export default class AgentCollabModule implements Module {
  id = 'agent-collab';
  name = '智能体协作';
  version = APP_VERSION;
  description = '智能体注册、权限管理、操作日志';
  dependencies = ['task-core'];

  lifecycle = {
    install: async (context: ModuleContext): Promise<void> => {
      context.logger.info('AgentCollabModule installing...');
    },

    enable: async (context: ModuleContext): Promise<void> => {
      context.logger.info('AgentCollabModule enabling...');

      // Initialize database
      const { PrismaClient } = await import('@/generated/prisma/client');
      const { PrismaBetterSqlite3 } = await import('@prisma/adapter-better-sqlite3');
      const dbPath = process.env.DATABASE_URL?.replace(/^file:/, '') ?? './prisma/dev.db';
      const adapter = new PrismaBetterSqlite3({ url: dbPath });
      const prisma = new PrismaClient({ adapter });

      // Repositories
      const { AgentRepository } = await import('./agent.repository');
      const { AgentOperationRepository } = await import('./agent-operation.repository');
      const agentRepo = new AgentRepository(prisma);
      const operationRepo = new AgentOperationRepository(prisma);

      context.container.register('AgentRepository', () => agentRepo);
      context.container.register('AgentOperationRepository', () => operationRepo);

      // Services
      const { AgentService } = await import('./agent.service');
      const agentService = new AgentService(agentRepo, operationRepo, context.eventBus, context.logger);
      context.container.register('AgentService', () => agentService);

      const { TaskRepository } = await import('@/lib/modules/task-core/task.repository');
      const taskRepo = context.container.has('TaskRepository')
        ? context.container.resolve<InstanceType<typeof TaskRepository>>('TaskRepository')
        : new TaskRepository(prisma);

      const { PermissionService } = await import('./permission.service');
      const permissionService = new PermissionService(taskRepo, context.logger);
      context.container.register('PermissionService', () => permissionService);

      const { AgentOperationLogger } = await import('./operation-logger');
      const operationLogger = new AgentOperationLogger(operationRepo, context.eventBus, context.logger);
      context.container.register('AgentOperationLogger', () => operationLogger);

      context.logger.info('AgentCollabModule enabled with all services registered');
    },

    disable: async (): Promise<void> => {
      console.log('[AgentCollabModule] Disabled');
    },

    uninstall: async (): Promise<void> => {
      console.log('[AgentCollabModule] Uninstalled');
    },
  };
}
