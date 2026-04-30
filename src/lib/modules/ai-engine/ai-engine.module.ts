import type { Module, ModuleContext } from '@/lib/core/types';
import { aiEngineMcpTools } from '@/lib/modules/mcp-server/tools/ai-engine-tools';
import { APP_VERSION } from '@/lib/core/version';

export default class AIEngineModule implements Module {
  id = 'ai-engine';
  name = 'AI 引擎';
  version = APP_VERSION;
  description = 'AI 任务提取、状态推断、任务拆解、智能分析';
  dependencies = ['task-core'];

  // MCP tools exposed by this module
  mcpTools = aiEngineMcpTools;

  lifecycle = {
    install: async (context: ModuleContext): Promise<void> => {
      context.logger.info('AIEngineModule installing...');
    },

    enable: async (context: ModuleContext): Promise<void> => {
      context.logger.info('AIEngineModule enabling...');

      // Read AI config
      const modelProvider = context.config.getModuleConfig<string>('ai-engine', 'model_provider', 'openai-compatible');
      const modelName = context.config.getModuleConfig<string>('ai-engine', 'default_model', 'gpt-4o');
      const baseURL = context.config.getModuleConfig<string>('ai-engine', 'base_url', process.env.OPENAI_BASE_URL);
      const apiKey = context.config.getModuleConfig<string>('ai-engine', 'api_key', process.env.OPENAI_API_KEY);

      const { OpenAICompatibleAdapter } = await import('./ai-model-adapter');
      const aiModel = new OpenAICompatibleAdapter(
        { model: modelName, baseURL, apiKey },
        context.logger,
      );

      context.container.register('IAIModelAdapter', () => aiModel);

      // Repositories
      const { PrismaClient } = await import('@/generated/prisma/client');
      const { PrismaBetterSqlite3 } = await import('@prisma/adapter-better-sqlite3');
      const dbPath = process.env.DATABASE_URL?.replace(/^file:/, '') ?? './prisma/dev.db';
      const adapter = new PrismaBetterSqlite3({ url: dbPath });
      const prisma = new PrismaClient({ adapter });
      const { AuditLogRepository } = await import('./audit-log.repository');
      const auditLogRepo = new AuditLogRepository(prisma);
      context.container.register('AuditLogRepository', () => auditLogRepo);

      // Processors
      const { TaskExtractor } = await import('./extractors/task-extractor');
      const taskExtractor = new TaskExtractor(aiModel, context.logger);
      context.container.register('TaskExtractor', () => taskExtractor);

      const { TaskDecomposer } = await import('./decomposers/task-decomposer');
      const taskDecomposer = new TaskDecomposer(aiModel, context.logger);
      context.container.register('TaskDecomposer', () => taskDecomposer);

      const { StatusInferencer } = await import('./inferencers/status-inferencer');
      const statusInferencer = new StatusInferencer(aiModel, context.logger);
      context.container.register('StatusInferencer', () => statusInferencer);

      const { TaskAnalyzer } = await import('./analyzers/task-analyzer');
      const taskAnalyzer = new TaskAnalyzer(aiModel, context.logger);
      context.container.register('TaskAnalyzer', () => taskAnalyzer);

      // Subscribe to events via AI Orchestrator
      const { AIOrchestrator } = await import('./ai-orchestrator');
      const { TaskCreatedHandler } = await import('./handlers/task-created.handler');
      const { TaskStatusHandler } = await import('./handlers/task-status.handler');
      const { ProjectPhaseHandler } = await import('./handlers/project-phase.handler');
      const { RequirementCreatedHandler } = await import('./handlers/requirement-created.handler');
      const { DeploymentStatusHandler } = await import('./handlers/deployment-status.handler');
      const { WorkflowCompletedHandler } = await import('./handlers/workflow-completed.handler');
      const { KnowledgeUpdatedHandler } = await import('./handlers/knowledge-updated.handler');

      const orchestrator = new AIOrchestrator(context.eventBus, context.logger);
      orchestrator.registerHandler(new TaskCreatedHandler(context.eventBus, context.logger));
      orchestrator.registerHandler(new TaskStatusHandler(context.eventBus, context.logger));
      orchestrator.registerHandler(new ProjectPhaseHandler(context.eventBus, context.logger));
      orchestrator.registerHandler(new RequirementCreatedHandler(context.eventBus, context.logger));
      orchestrator.registerHandler(new DeploymentStatusHandler(context.eventBus, context.logger));
      orchestrator.registerHandler(new WorkflowCompletedHandler(context.eventBus, context.logger));
      orchestrator.registerHandler(new KnowledgeUpdatedHandler(context.eventBus, context.logger));

      context.container.register('AIOrchestrator', () => orchestrator);

      context.logger.info('AIEngineModule enabled with all processors registered');
    },

    disable: async (): Promise<void> => {
      console.log('[AIEngineModule] Disabled');
    },

    uninstall: async (): Promise<void> => {
      console.log('[AIEngineModule] Uninstalled');
    },
  };
}
