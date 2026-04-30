import type { Module, ModuleContext } from '@/lib/core/types';
import type { SOLOBridgeConfig, SOLOCallMode } from './types';
import { APP_VERSION } from '@/lib/core/version';

export default class WorkflowEngineModule implements Module {
  id = 'workflow-engine';
  name = '工作流引擎';
  version = APP_VERSION;
  description = 'SOLO 驱动的智能工作流引擎，支持策略即代码、反馈驱动改进、可观测性';
  locked = true;
  dependencies = ['task-core'];

  lifecycle = {
    install: async (context: ModuleContext) => {
      context.logger.info('[WorkflowEngine] Installing...');
    },

    enable: async (context: ModuleContext) => {
      const { getPrisma } = await import('@/lib/db');
      const prisma = getPrisma();

      // Create core services
      const { SOLOBridge } = await import('./solo/solo-bridge');
      const { Observability } = await import('./observability');
      const { ConcurrencyController } = await import('./concurrency');
      const { FeedbackModule } = await import('./feedback/feedback-module');
      const { ImprovementLoop } = await import('./feedback/improvement-loop');
      const { WorkflowExecutor } = await import('./executor');
      const { WorkflowOrchestrator } = await import('./orchestrator');
      const { TriggerDispatcher } = await import('./triggers/trigger-dispatcher');
      const { WorkflowNotificationIntegration } = await import('./notification/notification-integration');
      const { WorkflowParser } = await import('./config/workflow-parser');
      const { WorkflowValidator } = await import('./config/workflow-validator');

      const logger = context.logger as any;
      const eventBus = context.eventBus as any;

      // SOLO bridge config - 从环境变量读取
      const validModes: SOLOCallMode[] = ['mcp', 'rest', 'pull'];
      const envMode = process.env.SOLO_DEFAULT_MODE as SOLOCallMode | undefined;
      const soloConfig: SOLOBridgeConfig = {
        defaultMode: envMode && validModes.includes(envMode) ? envMode : 'mcp',
        mcpEndpoint: process.env.SOLO_MCP_ENDPOINT || 'http://localhost:3001/mcp',
        restEndpoint: process.env.SOLO_REST_ENDPOINT || 'http://localhost:3001/api/solo/call',
        defaultTimeoutMs: parseInt(process.env.SOLO_TIMEOUT_MS || '30000', 10),
        maxConcurrentSessions: 5,
      };

      context.logger.info('[WorkflowEngine] SOLO Bridge config', {
        defaultMode: soloConfig.defaultMode,
        mcpEndpoint: soloConfig.mcpEndpoint,
        restEndpoint: soloConfig.restEndpoint,
        timeoutMs: soloConfig.defaultTimeoutMs,
      });

      // Instantiate services
      const soloBridge = new SOLOBridge(soloConfig, eventBus, logger);
      const observability = new Observability(eventBus, logger);
      const concurrencyController = new ConcurrencyController(5);
      const feedbackModule = new FeedbackModule(prisma, soloBridge, observability, eventBus, logger);
      const improvementLoop = new ImprovementLoop(prisma, soloBridge, observability, logger);

      // Get TaskService from DI container (dependency: task-core)
      const taskService = context.container.resolve('TaskService') as any;

      const executor = new WorkflowExecutor(prisma, taskService, soloBridge, feedbackModule, observability, logger);
      const orchestrator = new WorkflowOrchestrator(prisma, executor, concurrencyController, observability, logger);
      const triggerDispatcher = new TriggerDispatcher(prisma, orchestrator, eventBus, logger);
      const notificationIntegration = new WorkflowNotificationIntegration(eventBus, logger);

      // Set cross-references
      orchestrator.setTriggerDispatcher(triggerDispatcher);

      // Setup notification listeners
      notificationIntegration.setupEventListeners();

      // Register to DI container
      context.container.register('PrismaClient', () => prisma);
      context.container.register('SOLOBridge', () => soloBridge);
      context.container.register('Observability', () => observability);
      context.container.register('ConcurrencyController', () => concurrencyController);
      context.container.register('FeedbackModule', () => feedbackModule);
      context.container.register('ImprovementLoop', () => improvementLoop);
      context.container.register('WorkflowExecutor', () => executor);
      context.container.register('WorkflowOrchestrator', () => orchestrator);
      context.container.register('TriggerDispatcher', () => triggerDispatcher);
      context.container.register('WorkflowNotificationIntegration', () => notificationIntegration);
      context.container.register('WorkflowParser', () => new WorkflowParser());
      context.container.register('WorkflowValidator', () => new WorkflowValidator());

      context.logger.info('[WorkflowEngine] Module enabled - all services registered');
    },

    disable: async () => {
      // Cleanup would go here
    },

    uninstall: async () => {
      // Full cleanup would go here
    },
  };
}
