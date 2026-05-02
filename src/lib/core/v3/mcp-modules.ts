// ============================================================
// MCP Tool Module Descriptors
// ============================================================
//
// Declarative registry of all MCP tool modules.
// Each descriptor tells the McpAutoRegistry how to:
// 1. Import tool definitions (McpToolConfig[])
// 2. Import and call the handler factory
// 3. Initialize services and inject dependencies
//
// To add a new tool module:
// 1. Create *-tools.ts (tool definitions) and *-handlers.ts (handler factory)
// 2. Add a descriptor below
// 3. That's it! No changes to route.ts needed.
//

import type { McpToolModuleDescriptor, ModuleContext } from './mcp-registry';

// ---- Helper: create descriptor with common paths ----

const toolsDir = '@/lib/modules/mcp-server/tools';

function mod(
  id: string,
  toolsFile: string,
  toolsExport: string,
  handlersFile: string,
  handlersExport: string,
  opts?: Partial<Pick<McpToolModuleDescriptor, 'name' | 'init' | 'dependsOn' | 'optional'>>,
): McpToolModuleDescriptor {
  return {
    id,
    name: id,
    toolsPath: `${toolsDir}/${toolsFile}`,
    toolsExport,
    handlersPath: `${toolsDir}/${handlersFile}`,
    handlersExport,
    ...opts,
  };
}

// ---- All Module Descriptors ----

export const mcpToolModules: McpToolModuleDescriptor[] = [
  // ---- Core Task Management ----
  mod('task-core', 'task-core-tools.ts', 'taskCoreMcpTools', 'handlers.ts', 'createTaskCoreToolHandlers', {
    name: 'Task Core',
    init: async (ctx: ModuleContext) => {
      const { TaskRepository } = await import('@/lib/modules/task-core/task.repository');
      const { TaskHistoryRepository } = await import('@/lib/modules/task-core/task-history.repository');
      const { TaskDependencyRepository } = await import('@/lib/modules/task-core/task-dependency.repository');
      const { TaskProgressService } = await import('@/lib/modules/task-core/task-progress.service');
      const { TaskService } = await import('@/lib/modules/task-core/task.service');

      const taskRepo = new TaskRepository(ctx.prisma);
      const historyRepo = new TaskHistoryRepository(ctx.prisma);
      const depRepo = new TaskDependencyRepository(ctx.prisma);
      const progressService = new TaskProgressService(taskRepo, ctx.logger);
      const taskService = new TaskService(taskRepo, historyRepo, depRepo, progressService, ctx.eventBus, ctx.logger);

      // Register for downstream modules
      ctx.services.set('taskService', taskService);
      ctx.services.set('taskRepo', taskRepo);

      return [taskService, ctx.logger];
    },
  }),

  // ---- AI Engine ----
  mod('ai-engine', 'ai-engine-tools.ts', 'aiEngineMcpTools', 'handlers.ts', 'createAIEngineToolHandlers', {
    name: 'AI Engine',
    optional: true,
    init: async (ctx: ModuleContext) => {
      const { OpenAICompatibleAdapter } = await import('@/lib/modules/ai-engine/ai-model-adapter');
      const { TaskExtractor } = await import('@/lib/modules/ai-engine/extractors/task-extractor');
      const { TaskDecomposer } = await import('@/lib/modules/ai-engine/decomposers/task-decomposer');
      const { StatusInferencer } = await import('@/lib/modules/ai-engine/inferencers/status-inferencer');
      const { TaskAnalyzer } = await import('@/lib/modules/ai-engine/analyzers/task-analyzer');

      const aiModel = new OpenAICompatibleAdapter(
        {
          model: process.env.AI_MODEL ?? 'gpt-4o',
          baseURL: process.env.OPENAI_BASE_URL,
          apiKey: process.env.OPENAI_API_KEY,
        },
        ctx.logger,
      );

      return [
        new TaskExtractor(aiModel, ctx.logger),
        new TaskDecomposer(aiModel, ctx.logger),
        new StatusInferencer(aiModel, ctx.logger),
        new TaskAnalyzer(aiModel, ctx.logger),
        ctx.logger,
      ];
    },
  }),

  // ---- Project Management ----
  mod('project', 'project-tools.ts', 'projectMcpTools', 'project-handlers.ts', 'createProjectToolHandlers', {
    name: 'Project',
    init: async (ctx: ModuleContext) => {
      return [ctx.logger, ctx.eventBus];
    },
  }),

  // ---- Version Management ----
  mod('version', 'version-tools.ts', 'versionMcpTools', 'version-handlers.ts', 'createVersionToolHandlers', {
    name: 'Version',
    init: async (ctx: ModuleContext) => {
      const { VersionMgmtService } = await import('@/lib/modules/version-mgmt/version-mgmt.service');
      const service = new VersionMgmtService(ctx.prisma, ctx.eventBus, ctx.logger);
      ctx.services.set('versionService', service);
      return [service, ctx.logger];
    },
  }),

  // ---- Test Management ----
  mod('test-management', 'test-management-tools.ts', 'testManagementMcpTools', 'test-management-handlers.ts', 'createTestManagementToolHandlers', {
    name: 'Test Management',
    init: async (ctx: ModuleContext) => {
      const { TestManagementService } = await import('@/lib/modules/test-management/test-management.service');
      const service = new TestManagementService(ctx.prisma, ctx.eventBus, ctx.logger);
      return [service, ctx.logger];
    },
  }),

  // ---- Requirements ----
  mod('requirement', 'requirement-tools.ts', 'requirementMcpTools', 'requirement-handlers.ts', 'createRequirementToolHandlers', {
    name: 'Requirements',
    init: async (ctx: ModuleContext) => {
      const { RequirementsService } = await import('@/lib/modules/requirements/requirements.service');
      const service = new RequirementsService(ctx.prisma, ctx.eventBus, ctx.logger);
      return [service, ctx.logger];
    },
  }),

  // ---- Knowledge ----
  mod('knowledge', 'knowledge-tools.ts', 'knowledgeMcpTools', 'knowledge-handlers.ts', 'createKnowledgeToolHandlers', {
    name: 'Knowledge',
    init: async (ctx: ModuleContext) => {
      const { KnowledgeService } = await import('@/lib/modules/knowledge/knowledge.service');
      const service = new KnowledgeService(ctx.prisma, ctx.eventBus, ctx.logger);
      return [service, ctx.logger];
    },
  }),

  // ---- Lifecycle ----
  mod('lifecycle', 'lifecycle-tools.ts', 'lifecycleMcpTools', 'lifecycle-handlers.ts', 'createLifecycleToolHandlers', {
    name: 'Lifecycle',
    init: async (ctx: ModuleContext) => {
      const { LifecycleService } = await import('@/lib/modules/lifecycle/lifecycle.service');
      const service = new LifecycleService(ctx.prisma, ctx.eventBus, ctx.logger);
      return [service, ctx.logger];
    },
  }),

  // ---- Context Aggregation ----
  mod('context', 'context-tools.ts', 'contextMcpTools', 'context-handlers.ts', 'createContextToolHandlers', {
    name: 'Context',
    init: async (ctx: ModuleContext) => {
      return [ctx.logger, ctx.eventBus, () => ctx.prisma];
    },
  }),

  // ---- Prompt Templates ----
  mod('prompt', 'prompt-tools.ts', 'promptMcpTools', 'prompt-handlers.ts', 'createPromptToolHandlers', {
    name: 'Prompt Templates',
    init: async (ctx: ModuleContext) => {
      return [ctx.logger];
    },
  }),

  // ---- Deployment Management ----
  mod('deployment', 'deployment-tools.ts', 'deploymentMcpTools', 'deployment-handlers.ts', 'createDeploymentToolHandlers', {
    name: 'Deployment',
    init: async (ctx: ModuleContext) => {
      const { DeploymentService } = await import('@/lib/modules/deployment-mgmt/deployment.service');
      const service = new DeploymentService(ctx.logger, ctx.eventBus, () => ctx.prisma);
      return [service, ctx.logger];
    },
  }),

  // ---- Dashboard Statistics ----
  mod('dashboard', 'dashboard-tools.ts', 'dashboardMcpTools', 'dashboard-handlers.ts', 'createDashboardToolHandlers', {
    name: 'Dashboard',
    init: async (ctx: ModuleContext) => {
      const { StatisticsService } = await import('@/lib/modules/dashboard/statistics.service');
      const service = new StatisticsService(ctx.prisma, ctx.logger, ctx.eventBus);
      return [service, ctx.logger];
    },
  }),

  // ---- Notification Rules (with side effects) ----
  mod('notification-rule', 'notification-rule-tools.ts', 'notificationRuleMcpTools', 'notification-rule-handlers.ts', 'createNotificationRuleToolHandlers', {
    name: 'Notification Rules',
    init: async (ctx: ModuleContext) => {
      const { NotificationRepository } = await import('@/lib/modules/notifications/notification.repository');
      const { NotificationRuleEngine } = await import('@/lib/modules/notifications/rule-engine');

      const notificationRepo = new NotificationRepository(ctx.prisma);
      const ruleEngine = new NotificationRuleEngine(notificationRepo, ctx.eventBus, ctx.logger, () => ctx.prisma);

      // Start notification rule engine
      ruleEngine.start();
      ctx.logger.info('NotificationRuleEngine started - event listeners registered');

      // Add default notification rules
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

      // Register BrowserPush channel
      try {
        const { BrowserPushChannel } = await import('@/lib/modules/notifications/channels/browser-push-channel');
        const browserPush = new BrowserPushChannel(ctx.logger);
        ruleEngine.registerChannel(browserPush);
        ctx.logger.info('BrowserPush channel registered');
      } catch (err: any) {
        ctx.logger.warn(`Failed to register BrowserPush channel: ${err.message}`);
      }

      ctx.services.set('ruleEngine', ruleEngine);
      return [ruleEngine, ctx.logger];
    },
  }),

  // ---- Event Bus ----
  mod('event-bus', 'event-bus-tools.ts', 'eventBusMcpTools', 'event-bus-handlers.ts', 'createEventBusToolHandlers', {
    name: 'Event Bus',
    init: async (ctx: ModuleContext) => {
      return [ctx.eventBus, ctx.logger];
    },
  }),

  // ---- Outbound Webhook ----
  mod('outbound-webhook', 'outbound-webhook-tools.ts', 'outboundWebhookMcpTools', 'outbound-webhook-handlers.ts', 'createOutboundWebhookToolHandlers', {
    name: 'Outbound Webhook',
    init: async (ctx: ModuleContext) => {
      const { OutboundWebhookService } = await import('@/lib/modules/integration-webhook/outbound-webhook.service');
      const service = new OutboundWebhookService(ctx.logger, ctx.eventBus, () => ctx.prisma);
      ctx.services.set('outboundWebhookService', service);
      return [service, ctx.logger];
    },
  }),

  // ---- Workflow V3 ----
  mod('workflow-v3', 'workflow-v3-tools.ts', 'workflowV3McpTools', 'workflow-v3-handlers.ts', 'createWorkflowV3ToolHandlers', {
    name: 'Workflow V3',
    init: async (ctx: ModuleContext) => {
      const { ExecutionStateManager } = await import('@/lib/modules/workflow-engine/execution-state');
      const stateManager = new ExecutionStateManager(ctx.logger, () => ctx.prisma);
      return [stateManager, ctx.logger];
    },
  }),

  // ---- Notification Preferences ----
  mod('notification-preference', 'notification-preference-tools.ts', 'notificationPreferenceMcpTools', 'notification-preference-handlers.ts', 'createNotificationPreferenceToolHandlers', {
    name: 'Notification Preferences',
    init: async (ctx: ModuleContext) => {
      const { NotificationPreferenceService } = await import('@/lib/modules/notifications/preference.service');
      const service = new NotificationPreferenceService(ctx.logger, () => ctx.prisma);
      return [service, ctx.logger];
    },
  }),

  // ---- SOLO Bridge ----
  mod('solo-bridge', 'solo-bridge-tools.ts', 'soloBridgeMcpTools', 'solo-bridge-handlers.ts', 'createSOLOBridgeToolHandlers', {
    name: 'SOLO Bridge',
    init: async (ctx: ModuleContext) => {
      const { SOLOBridge } = await import('@/lib/modules/workflow-engine/solo/solo-bridge');
      const soloBridge = new SOLOBridge(
        {
          defaultMode: (process.env.SOLO_DEFAULT_MODE as any) || 'mcp',
          mcpEndpoint: process.env.SOLO_MCP_ENDPOINT || 'http://localhost:3001/mcp',
          restEndpoint: process.env.SOLO_REST_ENDPOINT || 'http://localhost:3001/api/solo/call',
          defaultTimeoutMs: parseInt(process.env.SOLO_TIMEOUT_MS || '30000', 10),
          maxConcurrentSessions: 5,
        },
        ctx.eventBus,
        ctx.logger,
      );
      ctx.services.set('soloBridge', soloBridge);
      return [() => soloBridge, ctx.logger];
    },
  }),

  // ---- AI Handler Management ----
  mod('ai-handler', 'ai-handler-tools.ts', 'aiHandlerMcpTools', 'ai-handler-handlers.ts', 'createAIHandlerToolHandlers', {
    name: 'AI Handler',
    dependsOn: ['solo-bridge'],
    init: async (ctx: ModuleContext) => {
      const { AIOrchestrator } = await import('@/lib/modules/ai-engine/ai-orchestrator');
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

      return [() => aiOrchestrator, ctx.eventBus, ctx.logger];
    },
  }),

  // ---- Email Notification ----
  mod('email-notification', 'email-notification-tools.ts', 'emailNotificationMcpTools', 'email-notification-handlers.ts', 'createEmailNotificationToolHandlers', {
    name: 'Email Notification',
    init: async (ctx: ModuleContext) => {
      return [ctx.logger];
    },
  }),

  // ---- Web Push ----
  mod('webpush', 'webpush-tools.ts', 'webpushMcpTools', 'webpush-handlers.ts', 'createWebPushToolHandlers', {
    name: 'Web Push',
    init: async (ctx: ModuleContext) => {
      const { WebPushService } = await import('@/lib/modules/notifications/web-push.service');
      const service = new WebPushService(ctx.logger);
      return [() => service, ctx.logger];
    },
  }),

  // ---- Webhook Retry ----
  mod('webhook-retry', 'webhook-retry-tools.ts', 'webhookRetryMcpTools', 'webhook-retry-handlers.ts', 'createWebhookRetryToolHandlers', {
    name: 'Webhook Retry',
    dependsOn: ['outbound-webhook'],
    init: async (ctx: ModuleContext) => {
      const service = ctx.services.get('outboundWebhookService');
      return [service, ctx.logger];
    },
  }),

  // ---- GitHub Trigger (depends on solo-bridge + task-core) ----
  mod('github-trigger', 'github-trigger-tools.ts', 'githubTriggerMcpTools', 'github-trigger-handlers.ts', 'createGitHubTriggerToolHandlers', {
    name: 'GitHub Trigger',
    dependsOn: ['task-core', 'solo-bridge'],
    init: async (ctx: ModuleContext) => {
      const { TriggerDispatcher } = await import('@/lib/modules/workflow-engine/triggers/trigger-dispatcher');
      const { WorkflowOrchestrator } = await import('@/lib/modules/workflow-engine/orchestrator');
      const { WorkflowExecutor } = await import('@/lib/modules/workflow-engine/executor');
      const { ConcurrencyController } = await import('@/lib/modules/workflow-engine/concurrency');
      const { Observability } = await import('@/lib/modules/workflow-engine/observability');
      const { FeedbackModule } = await import('@/lib/modules/workflow-engine/feedback/feedback-module');

      const taskService = ctx.services.get('taskService');
      const soloBridge = ctx.services.get('soloBridge');

      const observability = new Observability(ctx.eventBus, ctx.logger);
      const concurrencyController = new ConcurrencyController(5);
      const feedbackModule = new FeedbackModule(ctx.prisma, soloBridge, observability, ctx.eventBus, ctx.logger);
      const executor = new WorkflowExecutor(ctx.prisma, taskService, soloBridge, feedbackModule, observability, ctx.logger);
      const workflowOrchestrator = new WorkflowOrchestrator(ctx.prisma, executor, concurrencyController, observability, ctx.logger);
      const triggerDispatcher = new TriggerDispatcher(ctx.prisma, workflowOrchestrator, ctx.eventBus, ctx.logger);

      return [() => triggerDispatcher, ctx.logger];
    },
  }),
];
