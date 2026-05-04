// ============================================================
// MCP Tool Module Descriptors (v3.1)
// ============================================================
//
// Declarative registry of all MCP tool modules.
// Each module's init() returns { toolConfigs, handlerFactory, handlerArgs }.
// All imports use static paths that bundlers can resolve.
//
// To add a new tool module:
// 1. Create *-tools.ts (tool definitions) and *-handlers.ts (handler factory)
// 2. Add a descriptor below with static imports
// 3. That's it! No changes to route.ts needed.
//

import type { McpToolModuleDescriptor, ModuleContext, ModuleInitResult } from './mcp-registry';

// ============================================================
// Module Descriptors
// ============================================================

export const mcpToolModules: McpToolModuleDescriptor[] = [
  // ---- Core Task Management ----
  {
    id: 'task-core',
    name: 'Task Core',
    init: async (ctx: ModuleContext): Promise<ModuleInitResult> => {
      const { TaskRepository } = await import('@/lib/modules/task-core/task.repository');
      const { TaskHistoryRepository } = await import('@/lib/modules/task-core/task-history.repository');
      const { TaskDependencyRepository } = await import('@/lib/modules/task-core/task-dependency.repository');
      const { TaskProgressService } = await import('@/lib/modules/task-core/task-progress.service');
      const { TaskService } = await import('@/lib/modules/task-core/task.service');
      const { taskCoreMcpTools } = await import('@/lib/modules/mcp-server/tools/task-core-tools');
      const { createTaskCoreToolHandlers } = await import('@/lib/modules/mcp-server/tools/handlers');

      const taskRepo = new TaskRepository(ctx.prisma);
      const historyRepo = new TaskHistoryRepository(ctx.prisma);
      const depRepo = new TaskDependencyRepository(ctx.prisma);
      const progressService = new TaskProgressService(taskRepo, ctx.logger);
      const taskService = new TaskService(taskRepo, historyRepo, depRepo, progressService, ctx.eventBus, ctx.logger);

      ctx.services.set('taskService', taskService);
      ctx.services.set('taskRepo', taskRepo);

      return {
        toolConfigs: taskCoreMcpTools,
        handlerFactory: createTaskCoreToolHandlers,
        handlerArgs: [taskService, ctx.logger],
      };
    },
  },

  // ---- AI Engine ----
  {
    id: 'ai-engine',
    name: 'AI Engine',
    optional: true,
    init: async (ctx: ModuleContext): Promise<ModuleInitResult> => {
      const { OpenAICompatibleAdapter } = await import('@/lib/modules/ai-engine/ai-model-adapter');
      const { TaskExtractor } = await import('@/lib/modules/ai-engine/extractors/task-extractor');
      const { TaskDecomposer } = await import('@/lib/modules/ai-engine/decomposers/task-decomposer');
      const { StatusInferencer } = await import('@/lib/modules/ai-engine/inferencers/status-inferencer');
      const { TaskAnalyzer } = await import('@/lib/modules/ai-engine/analyzers/task-analyzer');
      const { aiEngineMcpTools } = await import('@/lib/modules/mcp-server/tools/ai-engine-tools');
      const { createAIEngineToolHandlers } = await import('@/lib/modules/mcp-server/tools/handlers');

      const aiModel = new OpenAICompatibleAdapter(
        {
          model: process.env.AI_MODEL ?? 'gpt-4o',
          baseURL: process.env.OPENAI_BASE_URL,
          apiKey: process.env.OPENAI_API_KEY,
        },
        ctx.logger,
      );

      return {
        toolConfigs: aiEngineMcpTools,
        handlerFactory: createAIEngineToolHandlers,
        handlerArgs: [
          new TaskExtractor(aiModel, ctx.logger),
          new TaskDecomposer(aiModel, ctx.logger),
          new StatusInferencer(aiModel, ctx.logger),
          new TaskAnalyzer(aiModel, ctx.logger),
          ctx.logger,
        ],
      };
    },
  },

  // ---- Project Management ----
  {
    id: 'project',
    name: 'Project',
    init: async (ctx: ModuleContext): Promise<ModuleInitResult> => {
      const { projectMcpTools } = await import('@/lib/modules/mcp-server/tools/project-tools');
      const { createProjectToolHandlers } = await import('@/lib/modules/mcp-server/tools/project-handlers');
      return {
        toolConfigs: projectMcpTools,
        handlerFactory: createProjectToolHandlers,
        handlerArgs: [ctx.logger, ctx.eventBus],
      };
    },
  },

  // ---- Version Management ----
  {
    id: 'version',
    name: 'Version',
    init: async (ctx: ModuleContext): Promise<ModuleInitResult> => {
      const { VersionMgmtService } = await import('@/lib/modules/version-mgmt/version-mgmt.service');
      const { versionMcpTools } = await import('@/lib/modules/mcp-server/tools/version-tools');
      const { createVersionToolHandlers } = await import('@/lib/modules/mcp-server/tools/version-handlers');
      const service = new VersionMgmtService(ctx.logger, ctx.eventBus);
      ctx.services.set('versionService', service);
      return {
        toolConfigs: versionMcpTools,
        handlerFactory: createVersionToolHandlers,
        handlerArgs: [service, ctx.logger],
      };
    },
  },

  // ---- Test Management ----
  {
    id: 'test-management',
    name: 'Test Management',
    init: async (ctx: ModuleContext): Promise<ModuleInitResult> => {
      const { TestManagementService } = await import('@/lib/modules/test-management/test-management.service');
      const { testManagementMcpTools } = await import('@/lib/modules/mcp-server/tools/test-management-tools');
      const { createTestManagementToolHandlers } = await import('@/lib/modules/mcp-server/tools/test-management-handlers');
      const service = new TestManagementService(ctx.prisma, ctx.eventBus, ctx.logger);
      return {
        toolConfigs: testManagementMcpTools,
        handlerFactory: createTestManagementToolHandlers,
        handlerArgs: [service, ctx.logger],
      };
    },
  },

  // ---- Requirements ----
  {
    id: 'requirement',
    name: 'Requirements',
    init: async (ctx: ModuleContext): Promise<ModuleInitResult> => {
      const { RequirementsService } = await import('@/lib/modules/requirements/requirements.service');
      const { requirementMcpTools } = await import('@/lib/modules/mcp-server/tools/requirement-tools');
      const { createRequirementToolHandlers } = await import('@/lib/modules/mcp-server/tools/requirement-handlers');
      const service = new RequirementsService(ctx.prisma, ctx.eventBus, ctx.logger);
      return {
        toolConfigs: requirementMcpTools,
        handlerFactory: createRequirementToolHandlers,
        handlerArgs: [service, ctx.logger],
      };
    },
  },

  // ---- Knowledge ----
  {
    id: 'knowledge',
    name: 'Knowledge',
    init: async (ctx: ModuleContext): Promise<ModuleInitResult> => {
      const { KnowledgeService } = await import('@/lib/modules/knowledge/knowledge.service');
      const { knowledgeMcpTools } = await import('@/lib/modules/mcp-server/tools/knowledge-tools');
      const { createKnowledgeToolHandlers } = await import('@/lib/modules/mcp-server/tools/knowledge-handlers');
      const service = new KnowledgeService(ctx.prisma, ctx.eventBus, ctx.logger);
      return {
        toolConfigs: knowledgeMcpTools,
        handlerFactory: createKnowledgeToolHandlers,
        handlerArgs: [service, ctx.logger],
      };
    },
  },

  // ---- Lifecycle ----
  {
    id: 'lifecycle',
    name: 'Lifecycle',
    init: async (ctx: ModuleContext): Promise<ModuleInitResult> => {
      const { LifecycleService } = await import('@/lib/modules/lifecycle/lifecycle.service');
      const { lifecycleMcpTools } = await import('@/lib/modules/mcp-server/tools/lifecycle-tools');
      const { createLifecycleToolHandlers } = await import('@/lib/modules/mcp-server/tools/lifecycle-handlers');
      const service = new LifecycleService(ctx.prisma, ctx.eventBus, ctx.logger);
      return {
        toolConfigs: lifecycleMcpTools,
        handlerFactory: createLifecycleToolHandlers,
        handlerArgs: [service, ctx.logger],
      };
    },
  },

  // ---- Context Aggregation ----
  {
    id: 'context',
    name: 'Context',
    init: async (ctx: ModuleContext): Promise<ModuleInitResult> => {
      const { contextMcpTools } = await import('@/lib/modules/mcp-server/tools/context-tools');
      const { createContextToolHandlers } = await import('@/lib/modules/mcp-server/tools/context-handlers');
      return {
        toolConfigs: contextMcpTools,
        handlerFactory: createContextToolHandlers,
        handlerArgs: [ctx.logger, ctx.eventBus, () => ctx.prisma],
      };
    },
  },

  // ---- Prompt Templates ----
  {
    id: 'prompt',
    name: 'Prompt Templates',
    init: async (ctx: ModuleContext): Promise<ModuleInitResult> => {
      const { promptMcpTools } = await import('@/lib/modules/mcp-server/tools/prompt-tools');
      const { createPromptToolHandlers } = await import('@/lib/modules/mcp-server/tools/prompt-handlers');
      return {
        toolConfigs: promptMcpTools,
        handlerFactory: createPromptToolHandlers,
        handlerArgs: [ctx.logger],
      };
    },
  },

  // ---- Deployment Management ----
  {
    id: 'deployment',
    name: 'Deployment',
    init: async (ctx: ModuleContext): Promise<ModuleInitResult> => {
      const { DeploymentService } = await import('@/lib/modules/deployment-mgmt/deployment.service');
      const { deploymentMcpTools } = await import('@/lib/modules/mcp-server/tools/deployment-tools');
      const { createDeploymentToolHandlers } = await import('@/lib/modules/mcp-server/tools/deployment-handlers');
      const service = new DeploymentService(ctx.logger, ctx.eventBus, () => ctx.prisma);
      return {
        toolConfigs: deploymentMcpTools,
        handlerFactory: createDeploymentToolHandlers,
        handlerArgs: [service, ctx.logger],
      };
    },
  },

  // ---- Dashboard Statistics ----
  {
    id: 'dashboard',
    name: 'Dashboard',
    init: async (ctx: ModuleContext): Promise<ModuleInitResult> => {
      const { StatisticsService } = await import('@/lib/modules/dashboard/statistics.service');
      const { dashboardMcpTools } = await import('@/lib/modules/mcp-server/tools/dashboard-tools');
      const { createDashboardToolHandlers } = await import('@/lib/modules/mcp-server/tools/dashboard-handlers');
      const service = new StatisticsService(ctx.prisma, ctx.logger, ctx.eventBus);
      return {
        toolConfigs: dashboardMcpTools,
        handlerFactory: createDashboardToolHandlers,
        handlerArgs: [service, ctx.logger],
      };
    },
  },

  // ---- Notification Rules (with side effects) ----
  {
    id: 'notification-rule',
    name: 'Notification Rules',
    init: async (ctx: ModuleContext): Promise<ModuleInitResult> => {
      const { NotificationRepository } = await import('@/lib/modules/notifications/notification.repository');
      const { NotificationRuleEngine } = await import('@/lib/modules/notifications/rule-engine');
      const { notificationRuleMcpTools } = await import('@/lib/modules/mcp-server/tools/notification-rule-tools');
      const { createNotificationRuleToolHandlers } = await import('@/lib/modules/mcp-server/tools/notification-rule-handlers');

      const notificationRepo = new NotificationRepository(ctx.prisma);
      const ruleEngine = new NotificationRuleEngine(notificationRepo, ctx.eventBus, ctx.logger, () => ctx.prisma);

      ruleEngine.start();
      ctx.logger.info('NotificationRuleEngine started - event listeners registered');

      try {
        await ruleEngine.createRule({ name: '任务创建通知', eventPattern: 'task.created', action: 'notify', level: 'info', priority: 10 });
        await ruleEngine.createRule({ name: '任务状态变更通知', eventPattern: 'task.status.changed', action: 'notify', level: 'info', priority: 10 });
        await ruleEngine.createRule({ name: '项目阶段变更通知', eventPattern: 'project.phase.changed', action: 'notify', level: 'info', priority: 10 });
        await ruleEngine.createRule({ name: '工作流完成通知', eventPattern: 'workflow.completed', action: 'notify', level: 'success', priority: 10 });
        ctx.logger.info('Default notification rules persisted to DB (4 rules)');
      } catch (err: any) {
        ruleEngine.addRule({ event: 'task.created', action: 'notify', level: 'info' });
        ruleEngine.addRule({ event: 'task.status.changed', action: 'notify', level: 'info' });
        ruleEngine.addRule({ event: 'project.phase.changed', action: 'notify', level: 'info' });
        ruleEngine.addRule({ event: 'workflow.completed', action: 'notify', level: 'success' });
        ctx.logger.info(`Default notification rules added to memory (DB create failed: ${err.message})`);
      }

      try {
        const { BrowserPushChannel } = await import('@/lib/modules/notifications/channels/browser-push-channel');
        const browserPush = new BrowserPushChannel(ctx.logger);
        ruleEngine.registerChannel(browserPush);
        ctx.logger.info('BrowserPush channel registered');
      } catch (err: any) {
        ctx.logger.warn(`Failed to register BrowserPush channel: ${err.message}`);
      }

      ctx.services.set('ruleEngine', ruleEngine);
      return {
        toolConfigs: notificationRuleMcpTools,
        handlerFactory: createNotificationRuleToolHandlers,
        handlerArgs: [ruleEngine, ctx.logger],
      };
    },
  },

  // ---- Event Bus ----
  {
    id: 'event-bus',
    name: 'Event Bus',
    init: async (ctx: ModuleContext): Promise<ModuleInitResult> => {
      const { eventBusMcpTools } = await import('@/lib/modules/mcp-server/tools/event-bus-tools');
      const { createEventBusToolHandlers } = await import('@/lib/modules/mcp-server/tools/event-bus-handlers');
      return {
        toolConfigs: eventBusMcpTools,
        handlerFactory: createEventBusToolHandlers,
        handlerArgs: [ctx.eventBus, ctx.logger],
      };
    },
  },

  // ---- Outbound Webhook ----
  {
    id: 'outbound-webhook',
    name: 'Outbound Webhook',
    init: async (ctx: ModuleContext): Promise<ModuleInitResult> => {
      const { OutboundWebhookService } = await import('@/lib/modules/integration-webhook/outbound-webhook.service');
      const { outboundWebhookMcpTools } = await import('@/lib/modules/mcp-server/tools/outbound-webhook-tools');
      const { createOutboundWebhookToolHandlers } = await import('@/lib/modules/mcp-server/tools/outbound-webhook-handlers');
      const service = new OutboundWebhookService(ctx.logger, ctx.eventBus, () => ctx.prisma);
      ctx.services.set('outboundWebhookService', service);
      return {
        toolConfigs: outboundWebhookMcpTools,
        handlerFactory: createOutboundWebhookToolHandlers,
        handlerArgs: [service, ctx.logger],
      };
    },
  },

  // ---- Workflow V3 ----
  {
    id: 'workflow-v3',
    name: 'Workflow V3',
    init: async (ctx: ModuleContext): Promise<ModuleInitResult> => {
      const { ExecutionStateManager } = await import('@/lib/modules/workflow-engine/execution-state');
      const { workflowV3McpTools } = await import('@/lib/modules/mcp-server/tools/workflow-v3-tools');
      const { createWorkflowV3ToolHandlers } = await import('@/lib/modules/mcp-server/tools/workflow-v3-handlers');
      const stateManager = new ExecutionStateManager(ctx.logger, () => ctx.prisma);
      return {
        toolConfigs: workflowV3McpTools,
        handlerFactory: createWorkflowV3ToolHandlers,
        handlerArgs: [stateManager, ctx.logger],
      };
    },
  },

  // ---- Notification Preferences ----
  {
    id: 'notification-preference',
    name: 'Notification Preferences',
    init: async (ctx: ModuleContext): Promise<ModuleInitResult> => {
      const { NotificationPreferenceService } = await import('@/lib/modules/notifications/preference.service');
      const { notificationPreferenceMcpTools } = await import('@/lib/modules/mcp-server/tools/notification-preference-tools');
      const { createNotificationPreferenceToolHandlers } = await import('@/lib/modules/mcp-server/tools/notification-preference-handlers');
      const service = new NotificationPreferenceService(ctx.logger, () => ctx.prisma);
      return {
        toolConfigs: notificationPreferenceMcpTools,
        handlerFactory: createNotificationPreferenceToolHandlers,
        handlerArgs: [service, ctx.logger],
      };
    },
  },

  // ---- SOLO Bridge ----
  {
    id: 'solo-bridge',
    name: 'SOLO Bridge',
    init: async (ctx: ModuleContext): Promise<ModuleInitResult> => {
      const { SOLOBridge } = await import('@/lib/modules/workflow-engine/solo/solo-bridge');
      const { soloBridgeMcpTools } = await import('@/lib/modules/mcp-server/tools/solo-bridge-tools');
      const { createSOLOBridgeToolHandlers } = await import('@/lib/modules/mcp-server/tools/solo-bridge-handlers');
      const soloBridge = new SOLOBridge(
        {
          defaultMode: (process.env.SOLO_DEFAULT_MODE as 'mcp' | 'rest' | 'pull') || 'mcp',
          mcpEndpoint: process.env.SOLO_MCP_ENDPOINT || 'http://localhost:3001/mcp',
          restEndpoint: process.env.SOLO_REST_ENDPOINT || 'http://localhost:3001/api/solo/call',
          defaultTimeoutMs: parseInt(process.env.SOLO_TIMEOUT_MS || '30000', 10),
          maxConcurrentSessions: 5,
        },
        ctx.eventBus,
        ctx.logger,
      );
      ctx.services.set('soloBridge', soloBridge);
      return {
        toolConfigs: soloBridgeMcpTools,
        handlerFactory: createSOLOBridgeToolHandlers,
        handlerArgs: [() => soloBridge, ctx.logger],
      };
    },
  },

  // ---- AI Handler Management ----
  {
    id: 'ai-handler',
    name: 'AI Handler',
    dependsOn: ['solo-bridge'],
    init: async (ctx: ModuleContext): Promise<ModuleInitResult> => {
      const { AIOrchestrator } = await import('@/lib/modules/ai-engine/ai-orchestrator');
      const { aiHandlerMcpTools } = await import('@/lib/modules/mcp-server/tools/ai-handler-tools');
      const { createAIHandlerToolHandlers } = await import('@/lib/modules/mcp-server/tools/ai-handler-handlers');
      const aiOrchestrator = new AIOrchestrator(ctx.eventBus, ctx.logger);

      try {
        const { TaskCreatedHandler } = await import('@/lib/modules/ai-engine/handlers/task-created.handler');
        const { TaskStatusHandler } = await import('@/lib/modules/ai-engine/handlers/task-status.handler');
        const { ProjectPhaseHandler } = await import('@/lib/modules/ai-engine/handlers/project-phase.handler');
        const { WorkflowCompletedHandler } = await import('@/lib/modules/ai-engine/handlers/workflow-completed.handler');
        const { SOLOCallHandler } = await import('@/lib/modules/ai-engine/handlers/solo-call-handler');

        aiOrchestrator.registerHandler(new TaskCreatedHandler(ctx.eventBus, ctx.logger));
        aiOrchestrator.registerHandler(new TaskStatusHandler(ctx.eventBus, ctx.logger));
        aiOrchestrator.registerHandler(new ProjectPhaseHandler(ctx.eventBus, ctx.logger));
        aiOrchestrator.registerHandler(new WorkflowCompletedHandler(ctx.eventBus, ctx.logger));
        aiOrchestrator.registerHandler(new SOLOCallHandler(ctx.eventBus, ctx.logger));
        ctx.logger.info(`AI Orchestrator event handlers registered (${aiOrchestrator.getRegisteredHandlers().length})`);
      } catch (err: any) {
        ctx.logger.warn(`Failed to register AI handlers: ${err.message}`);
      }

      return {
        toolConfigs: aiHandlerMcpTools,
        handlerFactory: createAIHandlerToolHandlers,
        handlerArgs: [() => aiOrchestrator, ctx.eventBus, ctx.logger],
      };
    },
  },

  // ---- Email Notification ----
  {
    id: 'email-notification',
    name: 'Email Notification',
    init: async (ctx: ModuleContext): Promise<ModuleInitResult> => {
      const { emailNotificationMcpTools } = await import('@/lib/modules/mcp-server/tools/email-notification-tools');
      const { createEmailNotificationToolHandlers } = await import('@/lib/modules/mcp-server/tools/email-notification-handlers');
      return {
        toolConfigs: emailNotificationMcpTools,
        handlerFactory: createEmailNotificationToolHandlers,
        handlerArgs: [ctx.logger],
      };
    },
  },

  // ---- Web Push ----
  {
    id: 'webpush',
    name: 'Web Push',
    init: async (ctx: ModuleContext): Promise<ModuleInitResult> => {
      const { WebPushService } = await import('@/lib/modules/notifications/web-push.service');
      const { webpushMcpTools } = await import('@/lib/modules/mcp-server/tools/webpush-tools');
      const { createWebPushToolHandlers } = await import('@/lib/modules/mcp-server/tools/webpush-handlers');
      const service = new WebPushService(ctx.logger);
      return {
        toolConfigs: webpushMcpTools,
        handlerFactory: createWebPushToolHandlers,
        handlerArgs: [() => service, ctx.logger],
      };
    },
  },

  // ---- Webhook Retry ----
  {
    id: 'webhook-retry',
    name: 'Webhook Retry',
    dependsOn: ['outbound-webhook'],
    init: async (ctx: ModuleContext): Promise<ModuleInitResult> => {
      const { webhookRetryMcpTools } = await import('@/lib/modules/mcp-server/tools/webhook-retry-tools');
      const { createWebhookRetryToolHandlers } = await import('@/lib/modules/mcp-server/tools/webhook-retry-handlers');
      const service = ctx.services.get('outboundWebhookService');
      return {
        toolConfigs: webhookRetryMcpTools,
        handlerFactory: createWebhookRetryToolHandlers,
        handlerArgs: [service, ctx.logger],
      };
    },
  },

  // ---- GitHub Trigger ----
  {
    id: 'github-trigger',
    name: 'GitHub Trigger',
    dependsOn: ['task-core', 'solo-bridge'],
    init: async (ctx: ModuleContext): Promise<ModuleInitResult> => {
      const { TriggerDispatcher } = await import('@/lib/modules/workflow-engine/triggers/trigger-dispatcher');
      const { WorkflowOrchestrator } = await import('@/lib/modules/workflow-engine/orchestrator');
      const { WorkflowExecutor } = await import('@/lib/modules/workflow-engine/executor');
      const { ConcurrencyController } = await import('@/lib/modules/workflow-engine/concurrency');
      const { Observability } = await import('@/lib/modules/workflow-engine/observability');
      const { FeedbackModule } = await import('@/lib/modules/workflow-engine/feedback/feedback-module');
      const { githubTriggerMcpTools } = await import('@/lib/modules/mcp-server/tools/github-trigger-tools');
      const { createGitHubTriggerToolHandlers } = await import('@/lib/modules/mcp-server/tools/github-trigger-handlers');

      const taskService = ctx.services.get('taskService');
      const soloBridge = ctx.services.get('soloBridge');

      const observability = new Observability(ctx.eventBus, ctx.logger);
      const concurrencyController = new ConcurrencyController(5);
      const feedbackModule = new FeedbackModule(ctx.prisma, soloBridge, observability, ctx.eventBus, ctx.logger);
      const executor = new WorkflowExecutor(ctx.prisma, taskService, soloBridge, feedbackModule, observability, ctx.logger);
      const workflowOrchestrator = new WorkflowOrchestrator(ctx.prisma, executor, concurrencyController, observability, ctx.logger);
      const triggerDispatcher = new TriggerDispatcher(ctx.prisma, workflowOrchestrator, ctx.eventBus, ctx.logger);

      return {
        toolConfigs: githubTriggerMcpTools,
        handlerFactory: createGitHubTriggerToolHandlers,
        handlerArgs: [() => triggerDispatcher, ctx.logger],
      };
    },
  },
];
