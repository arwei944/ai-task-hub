import type { Module, ModuleContext } from '@/lib/core/types';
import { taskCoreMcpTools } from '@/lib/modules/mcp-server/tools/task-core-tools';

export default class TaskCoreModule implements Module {
  id = 'task-core';
  name = '任务管理核心';
  version = '1.0.0';
  description = '任务 CRUD、状态管理、依赖关系、变更历史';
  locked = true;

  // MCP tools exposed by this module
  mcpTools = taskCoreMcpTools;

  lifecycle = {
    install: async (context: ModuleContext): Promise<void> => {
      context.logger.info('TaskCoreModule installing...');
    },

    enable: async (context: ModuleContext): Promise<void> => {
      context.logger.info('TaskCoreModule enabling...');

      const { PrismaClient } = await import('@/generated/prisma/client');
      const { PrismaBetterSqlite3 } = await import('@prisma/adapter-better-sqlite3');
      const dbPath = process.env.DATABASE_URL?.replace(/^file:/, '') ?? './prisma/dev.db';
      const adapter = new PrismaBetterSqlite3({ url: dbPath });
      const prisma = new PrismaClient({ adapter });

      // Repositories
      const taskRepo = new (await import('./task.repository')).TaskRepository(prisma);
      const historyRepo = new (await import('./task-history.repository')).TaskHistoryRepository(prisma);
      const dependencyRepo = new (await import('./task-dependency.repository')).TaskDependencyRepository(prisma);
      const tagRepo = new (await import('./tag.repository')).TagRepository(prisma);

      context.container.register('TaskRepository', () => taskRepo);
      context.container.register('TaskHistoryRepository', () => historyRepo);
      context.container.register('TaskDependencyRepository', () => dependencyRepo);
      context.container.register('TagRepository', () => tagRepo);

      // Services
      const { TaskProgressService } = await import('./task-progress.service');
      const progressService = new TaskProgressService(taskRepo, context.logger);
      context.container.register('TaskProgressService', () => progressService);

      const { TaskService } = await import('./task.service');
      const taskService = new TaskService(
        taskRepo,
        historyRepo,
        dependencyRepo,
        progressService,
        context.eventBus,
        context.logger,
      );
      context.container.register('TaskService', () => taskService);

      context.logger.info('TaskCoreModule enabled with all services registered');
    },

    disable: async (): Promise<void> => {
      console.log('[TaskCoreModule] Disabled');
    },

    uninstall: async (): Promise<void> => {
      console.log('[TaskCoreModule] Uninstalled');
    },
  };
}
