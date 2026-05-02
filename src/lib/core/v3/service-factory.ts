// ============================================================
// v3 Service Factory — Centralized Service Instantiation
// ============================================================
//
// Replaces the scattered lazy-init patterns in 15 tRPC routers.
// All services are registered in the DIContainer as singletons.
// tRPC routers access services via ctx.services.xxx.
//
// Service categories:
// - Core: prisma, eventBus, logger
// - Auth: authService, userRepo
// - Task: taskService (+ repos)
// - AI: aiModel, extractors, decomposers, etc.
// - Agent: agentService, permissionService
// - Integration: integrationService
// - Notification: notificationRepo, webPushService, ruleEngine
// - Stats: statisticsService
// - Workflow: workflowService
// - Plugin: pluginLoader
// - Updater: moduleUpdaterService
// - Feedback: improvementLoop
// ============================================================

import type { IDIContainer } from '@/lib/core/v3';
import { getPrisma } from '@/lib/db';
import { Logger } from '@/lib/core/logger';
import { EventBus as V3EventBus } from '@/lib/core/v3/event-bus';

// PrismaClient is generated at build time — use the same path as db.ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaClient = any;

// ---- Forward type references for ServiceRegistry ----
// These are type-only imports resolved at compile time.
// The actual classes are imported dynamically in register functions.

type UserRepository = import('@/lib/modules/auth/user.repository').UserRepository;
type AuthService = import('@/lib/modules/auth/auth.service').AuthService;
type TaskRepository = import('@/lib/modules/task-core/task.repository').TaskRepository;
type TaskHistoryRepository = import('@/lib/modules/task-core/task-history.repository').TaskHistoryRepository;
type TaskDependencyRepository = import('@/lib/modules/task-core/task-dependency.repository').TaskDependencyRepository;
type TaskProgressService = import('@/lib/modules/task-core/task-progress.service').TaskProgressService;
type TaskService = import('@/lib/modules/task-core/task.service').TaskService;
type IAIModelAdapter = import('@/lib/modules/ai-engine/ai-model-adapter').IAIModelAdapter;
type TaskExtractor = import('@/lib/modules/ai-engine/extractors/task-extractor').TaskExtractor;
type TaskDecomposer = import('@/lib/modules/ai-engine/decomposers/task-decomposer').TaskDecomposer;
type AutoTaskDecomposer = import('@/lib/modules/ai-engine/decomposers/auto-task-decomposer').AutoTaskDecomposer;
type StatusInferencer = import('@/lib/modules/ai-engine/inferencers/status-inferencer').StatusInferencer;
type TaskAnalyzer = import('@/lib/modules/ai-engine/analyzers/task-analyzer').TaskAnalyzer;
type NLTaskQuery = import('@/lib/modules/ai-engine/queries/nl-task-query').NLTaskQuery;
type ScheduleAdvisor = import('@/lib/modules/ai-engine/advisors/schedule-advisor').ScheduleAdvisor;
type AgentRepository = import('@/lib/modules/agent-collab/agent.repository').AgentRepository;
type AgentOperationRepository = import('@/lib/modules/agent-collab/agent-operation.repository').AgentOperationRepository;
type AgentService = import('@/lib/modules/agent-collab/agent.service').AgentService;
type PermissionService = import('@/lib/modules/agent-collab/permission.service').PermissionService;
type AgentOperationLogger = import('@/lib/modules/agent-collab/operation-logger').AgentOperationLogger;
type NotificationRepository = import('@/lib/modules/notifications/notification.repository').NotificationRepository;
type WebPushService = import('@/lib/modules/notifications/web-push.service').WebPushService;
type NotificationRuleEngine = import('@/lib/modules/notifications/rule-engine').NotificationRuleEngine;
type StatisticsService = import('@/lib/modules/dashboard/statistics.service').StatisticsService;
type WorkflowService = import('@/lib/modules/workflow-engine/workflow.service').WorkflowService;
type PluginLoader = import('@/lib/modules/plugins/plugin-loader').PluginLoader;
type ModuleUpdaterService = import('@/lib/modules/module-updater/module-updater.service').ModuleUpdaterService;
type ImprovementLoop = import('@/lib/modules/workflow-engine/feedback/improvement-loop').ImprovementLoop;

// ---- Service Token Constants ----

export const ServiceTokens = {
  // Core
  prisma: 'prisma',
  eventBus: 'eventBus',
  logger: 'logger',

  // Auth
  authService: 'authService',
  userRepo: 'userRepo',

  // Task
  taskService: 'taskService',
  taskRepo: 'taskRepo',
  taskHistoryRepo: 'taskHistoryRepo',
  taskDepRepo: 'taskDepRepo',
  taskProgressService: 'taskProgressService',

  // AI
  aiModel: 'aiModel',
  taskExtractor: 'taskExtractor',
  taskDecomposer: 'taskDecomposer',
  autoTaskDecomposer: 'autoTaskDecomposer',
  statusInferencer: 'statusInferencer',
  taskAnalyzer: 'taskAnalyzer',
  nlTaskQuery: 'nlTaskQuery',
  scheduleAdvisor: 'scheduleAdvisor',

  // Agent
  agentService: 'agentService',
  permissionService: 'permissionService',
  agentOperationLogger: 'agentOperationLogger',
  agentRepo: 'agentRepo',
  agentOpRepo: 'agentOpRepo',

  // Integration
  integrationService: 'integrationService',

  // Notification
  notificationRepo: 'notificationRepo',
  webPushService: 'webPushService',
  ruleEngine: 'ruleEngine',

  // Stats
  statisticsService: 'statisticsService',

  // Workflow
  workflowService: 'workflowService',

  // Plugin
  pluginLoader: 'pluginLoader',

  // Updater
  moduleUpdaterService: 'moduleUpdaterService',

  // Feedback
  improvementLoop: 'improvementLoop',
} as const;

export type ServiceToken = (typeof ServiceTokens)[keyof typeof ServiceTokens];

// ---- Service Registry Map (typed) ----

export interface ServiceRegistry {
  // Core
  [ServiceTokens.prisma]: PrismaClient;
  [ServiceTokens.eventBus]: V3EventBus;
  [ServiceTokens.logger]: Logger;

  // Auth
  [ServiceTokens.authService]: AuthService;
  [ServiceTokens.userRepo]: UserRepository;

  // Task
  [ServiceTokens.taskService]: TaskService;
  [ServiceTokens.taskRepo]: TaskRepository;
  [ServiceTokens.taskHistoryRepo]: TaskHistoryRepository;
  [ServiceTokens.taskDepRepo]: TaskDependencyRepository;
  [ServiceTokens.taskProgressService]: TaskProgressService;

  // AI
  [ServiceTokens.aiModel]: IAIModelAdapter;
  [ServiceTokens.taskExtractor]: TaskExtractor;
  [ServiceTokens.taskDecomposer]: TaskDecomposer;
  [ServiceTokens.autoTaskDecomposer]: AutoTaskDecomposer;
  [ServiceTokens.statusInferencer]: StatusInferencer;
  [ServiceTokens.taskAnalyzer]: TaskAnalyzer;
  [ServiceTokens.nlTaskQuery]: NLTaskQuery;
  [ServiceTokens.scheduleAdvisor]: ScheduleAdvisor;

  // Agent
  [ServiceTokens.agentService]: AgentService;
  [ServiceTokens.permissionService]: PermissionService;
  [ServiceTokens.agentOperationLogger]: AgentOperationLogger;
  [ServiceTokens.agentRepo]: AgentRepository;
  [ServiceTokens.agentOpRepo]: AgentOperationRepository;

  // Integration (adapter array)
  [ServiceTokens.integrationService]: unknown[];

  // Notification
  [ServiceTokens.notificationRepo]: NotificationRepository;
  [ServiceTokens.webPushService]: WebPushService;
  [ServiceTokens.ruleEngine]: NotificationRuleEngine;

  // Stats
  [ServiceTokens.statisticsService]: StatisticsService;

  // Workflow
  [ServiceTokens.workflowService]: WorkflowService;

  // Plugin
  [ServiceTokens.pluginLoader]: PluginLoader;

  // Updater
  [ServiceTokens.moduleUpdaterService]: ModuleUpdaterService;

  // Feedback
  [ServiceTokens.improvementLoop]: ImprovementLoop;
}

// ---- Registration Functions ----

/**
 * Register all core services (prisma, eventBus, logger).
 * These are shared dependencies for all other services.
 */
export function registerCoreServices(container: IDIContainer): void {
  const prisma = getPrisma();
  const eventBus = new V3EventBus();
  const logger = new Logger('v3-services');

  container.register(ServiceTokens.prisma, () => prisma, { singleton: true });
  container.register(ServiceTokens.eventBus, () => eventBus, { singleton: true });
  container.register(ServiceTokens.logger, () => logger, { singleton: true });
}

/**
 * Register auth services.
 */
export async function registerAuthServices(container: IDIContainer): Promise<void> {
  const { UserRepository } = await import('@/lib/modules/auth/user.repository');
  const { AuthService } = await import('@/lib/modules/auth/auth.service');
  const logger = container.resolve(ServiceTokens.logger) as any;
  const prisma = container.resolve(ServiceTokens.prisma) as any;

  const userRepo = new UserRepository(prisma);
  const authService = new AuthService(userRepo, logger);

  container.register(ServiceTokens.userRepo, () => userRepo, { singleton: true });
  container.register(ServiceTokens.authService, () => authService, { singleton: true });
}

/**
 * Register task-core services.
 */
export async function registerTaskServices(container: IDIContainer): Promise<void> {
  const { TaskRepository } = await import('@/lib/modules/task-core/task.repository');
  const { TaskHistoryRepository } = await import('@/lib/modules/task-core/task-history.repository');
  const { TaskDependencyRepository } = await import('@/lib/modules/task-core/task-dependency.repository');
  const { TaskProgressService } = await import('@/lib/modules/task-core/task-progress.service');
  const { TaskService } = await import('@/lib/modules/task-core/task.service');

  const prisma = container.resolve(ServiceTokens.prisma) as any;
  const eventBus = container.resolve(ServiceTokens.eventBus) as any;
  const logger = container.resolve(ServiceTokens.logger) as any;

  const taskRepo = new TaskRepository(prisma);
  const historyRepo = new TaskHistoryRepository(prisma);
  const depRepo = new TaskDependencyRepository(prisma);
  const progressService = new TaskProgressService(taskRepo, logger);
  const taskService = new TaskService(taskRepo, historyRepo, depRepo, progressService, eventBus, logger);

  container.register(ServiceTokens.taskRepo, () => taskRepo, { singleton: true });
  container.register(ServiceTokens.taskHistoryRepo, () => historyRepo, { singleton: true });
  container.register(ServiceTokens.taskDepRepo, () => depRepo, { singleton: true });
  container.register(ServiceTokens.taskProgressService, () => progressService, { singleton: true });
  container.register(ServiceTokens.taskService, () => taskService, { singleton: true });
}

/**
 * Register AI engine services.
 */
export async function registerAIServices(container: IDIContainer): Promise<void> {
  const { OpenAICompatibleAdapter } = await import('@/lib/modules/ai-engine/ai-model-adapter');
  const { TaskExtractor } = await import('@/lib/modules/ai-engine/extractors/task-extractor');
  const { TaskDecomposer } = await import('@/lib/modules/ai-engine/decomposers/task-decomposer');
  const { AutoTaskDecomposer } = await import('@/lib/modules/ai-engine/decomposers/auto-task-decomposer');
  const { StatusInferencer } = await import('@/lib/modules/ai-engine/inferencers/status-inferencer');
  const { TaskAnalyzer } = await import('@/lib/modules/ai-engine/analyzers/task-analyzer');
  const { NLTaskQuery } = await import('@/lib/modules/ai-engine/queries/nl-task-query');
  const { ScheduleAdvisor } = await import('@/lib/modules/ai-engine/advisors/schedule-advisor');

  const logger = container.resolve(ServiceTokens.logger) as any;

  const aiModel = new OpenAICompatibleAdapter(
    {
      model: process.env.AI_MODEL ?? 'gpt-4o',
      baseURL: process.env.OPENAI_BASE_URL,
      apiKey: process.env.OPENAI_API_KEY,
    },
    logger,
  );

  const taskExtractor = new TaskExtractor(aiModel, logger);
  const taskDecomposer = new TaskDecomposer(aiModel, logger);
  const autoTaskDecomposer = new AutoTaskDecomposer(aiModel, logger);
  const statusInferencer = new StatusInferencer(aiModel, logger);
  const taskAnalyzer = new TaskAnalyzer(aiModel, logger);
  const nlTaskQuery = new NLTaskQuery(aiModel, logger);
  const scheduleAdvisor = new ScheduleAdvisor(aiModel, logger);

  container.register(ServiceTokens.aiModel, () => aiModel, { singleton: true });
  container.register(ServiceTokens.taskExtractor, () => taskExtractor, { singleton: true });
  container.register(ServiceTokens.taskDecomposer, () => taskDecomposer, { singleton: true });
  container.register(ServiceTokens.autoTaskDecomposer, () => autoTaskDecomposer, { singleton: true });
  container.register(ServiceTokens.statusInferencer, () => statusInferencer, { singleton: true });
  container.register(ServiceTokens.taskAnalyzer, () => taskAnalyzer, { singleton: true });
  container.register(ServiceTokens.nlTaskQuery, () => nlTaskQuery, { singleton: true });
  container.register(ServiceTokens.scheduleAdvisor, () => scheduleAdvisor, { singleton: true });
}

/**
 * Register agent collaboration services.
 */
export async function registerAgentServices(container: IDIContainer): Promise<void> {
  const { AgentService } = await import('@/lib/modules/agent-collab/agent.service');
  const { AgentRepository } = await import('@/lib/modules/agent-collab/agent.repository');
  const { AgentOperationRepository } = await import('@/lib/modules/agent-collab/agent-operation.repository');
  const { PermissionService } = await import('@/lib/modules/agent-collab/permission.service');
  const { AgentOperationLogger } = await import('@/lib/modules/agent-collab/operation-logger');

  const prisma = container.resolve(ServiceTokens.prisma) as any;
  const eventBus = container.resolve(ServiceTokens.eventBus) as any;
  const logger = container.resolve(ServiceTokens.logger) as any;
  const taskRepo = container.resolve(ServiceTokens.taskRepo) as any;

  const agentRepo = new AgentRepository(prisma);
  const agentOpRepo = new AgentOperationRepository(prisma);
  const agentService = new AgentService(agentRepo, agentOpRepo, eventBus, logger);
  const permissionService = new PermissionService(taskRepo, logger);
  const operationLogger = new AgentOperationLogger(agentOpRepo, eventBus, logger);

  container.register(ServiceTokens.agentRepo, () => agentRepo, { singleton: true });
  container.register(ServiceTokens.agentOpRepo, () => agentOpRepo, { singleton: true });
  container.register(ServiceTokens.agentService, () => agentService, { singleton: true });
  container.register(ServiceTokens.permissionService, () => permissionService, { singleton: true });
  container.register(ServiceTokens.agentOperationLogger, () => operationLogger, { singleton: true });
}

/**
 * Register integration services.
 */
export async function registerIntegrationServices(container: IDIContainer): Promise<void> {
  const { GitHubAdapter } = await import('@/lib/modules/integration-github/github.adapter');
  const { NotionAdapter } = await import('@/lib/modules/integration-notion/notion.adapter');
  const { WeChatAdapter } = await import('@/lib/modules/integration-wechat/wechat.adapter');
  const { FeishuAdapter } = await import('@/lib/modules/integration-feishu/feishu.adapter');
  const { TelegramAdapter } = await import('@/lib/modules/integration-telegram/telegram.adapter');
  const { WebhookAdapter } = await import('@/lib/modules/integration-webhook/webhook.adapter');

  const logger = container.resolve(ServiceTokens.logger) as any;

  const adapters = [
    new GitHubAdapter(logger),
    new NotionAdapter(logger),
    new WeChatAdapter(logger),
    new FeishuAdapter(logger),
    new TelegramAdapter(logger),
    new WebhookAdapter(logger),
  ];

  container.register(ServiceTokens.integrationService, () => adapters, { singleton: true });
}

/**
 * Register notification services.
 */
export async function registerNotificationServices(container: IDIContainer): Promise<void> {
  const { NotificationRepository } = await import('@/lib/modules/notifications/notification.repository');
  const { NotificationRuleEngine } = await import('@/lib/modules/notifications/rule-engine');
  const { WebPushService } = await import('@/lib/modules/notifications/web-push.service');

  const prisma = container.resolve(ServiceTokens.prisma) as any;
  const eventBus = container.resolve(ServiceTokens.eventBus) as any;
  const logger = container.resolve(ServiceTokens.logger) as any;

  const notificationRepo = new NotificationRepository(prisma);
  const ruleEngine = new NotificationRuleEngine(notificationRepo, eventBus, logger, () => prisma);
  const webPushService = new WebPushService(logger);

  container.register(ServiceTokens.notificationRepo, () => notificationRepo, { singleton: true });
  container.register(ServiceTokens.ruleEngine, () => ruleEngine, { singleton: true });
  container.register(ServiceTokens.webPushService, () => webPushService, { singleton: true });
}

/**
 * Register statistics/dashboard services.
 */
export async function registerStatsServices(container: IDIContainer): Promise<void> {
  const { StatisticsService } = await import('@/lib/modules/dashboard/statistics.service');

  const prisma = container.resolve(ServiceTokens.prisma) as any;
  const eventBus = container.resolve(ServiceTokens.eventBus) as any;
  const logger = container.resolve(ServiceTokens.logger) as any;

  const statisticsService = new StatisticsService(prisma, logger, eventBus);

  container.register(ServiceTokens.statisticsService, () => statisticsService, { singleton: true });
}

/**
 * Register workflow services.
 */
export async function registerWorkflowServices(container: IDIContainer): Promise<void> {
  const { WorkflowService } = await import('@/lib/modules/workflow-engine/workflow.service');

  const prisma = container.resolve(ServiceTokens.prisma) as any;
  const logger = container.resolve(ServiceTokens.logger) as any;
  const taskService = container.resolve(ServiceTokens.taskService) as any;

  const workflowService = new WorkflowService(prisma, taskService, logger);

  container.register(ServiceTokens.workflowService, () => workflowService, { singleton: true });
}

/**
 * Register plugin services.
 */
export async function registerPluginServices(container: IDIContainer): Promise<void> {
  const { PluginLoader } = await import('@/lib/modules/plugins/plugin-loader');

  const prisma = container.resolve(ServiceTokens.prisma) as any;
  const eventBus = container.resolve(ServiceTokens.eventBus) as any;
  const logger = container.resolve(ServiceTokens.logger) as any;

  const pluginLoader = new PluginLoader(prisma, eventBus, logger);

  container.register(ServiceTokens.pluginLoader, () => pluginLoader, { singleton: true });
}

/**
 * Register module updater services.
 */
export async function registerUpdaterServices(container: IDIContainer): Promise<void> {
  const { ModuleUpdaterService } = await import('@/lib/modules/module-updater/module-updater.service');
  const { ModuleVersionRepository } = await import('@/lib/modules/module-updater/module-version.repository');
  const { AppVersionRepository } = await import('@/lib/modules/module-updater/app-version.repository');

  const prisma = container.resolve(ServiceTokens.prisma) as any;
  const eventBus = container.resolve(ServiceTokens.eventBus) as any;
  const logger = container.resolve(ServiceTokens.logger) as any;

  const moduleVersionRepo = new ModuleVersionRepository(prisma);
  const appVersionRepo = new AppVersionRepository(prisma);
  const moduleUpdaterService = new ModuleUpdaterService(
    moduleVersionRepo, appVersionRepo, null as any, eventBus, logger,
  );

  container.register(ServiceTokens.moduleUpdaterService, () => moduleUpdaterService, { singleton: true });
}

/**
 * Register feedback/improvement-loop services.
 */
export async function registerFeedbackServices(container: IDIContainer): Promise<void> {
  const { ImprovementLoop } = await import('@/lib/modules/workflow-engine/feedback/improvement-loop');
  const { SOLOBridge } = await import('@/lib/modules/workflow-engine/solo/solo-bridge');
  const { Observability } = await import('@/lib/modules/workflow-engine/observability');

  const prisma = container.resolve(ServiceTokens.prisma) as any;
  const eventBus = container.resolve(ServiceTokens.eventBus) as any;
  const logger = container.resolve(ServiceTokens.logger) as any;

  const soloBridge = new SOLOBridge(
    {
      defaultMode: (process.env.SOLO_DEFAULT_MODE as any) || 'mcp',
      mcpEndpoint: process.env.SOLO_MCP_ENDPOINT || 'http://localhost:3001/mcp',
      restEndpoint: process.env.SOLO_REST_ENDPOINT || 'http://localhost:3001/api/solo/call',
      defaultTimeoutMs: parseInt(process.env.SOLO_TIMEOUT_MS || '30000', 10),
      maxConcurrentSessions: 5,
    },
    eventBus,
    logger,
  );
  const observability = new Observability(eventBus, logger);
  const improvementLoop = new ImprovementLoop(prisma, soloBridge, observability, logger);

  container.register(ServiceTokens.improvementLoop, () => improvementLoop, { singleton: true });
}

/**
 * Register ALL services into the DI container.
 * Call this once during application startup.
 */
export async function registerAllServices(container: IDIContainer): Promise<void> {
  // 1. Core first (no dependencies)
  registerCoreServices(container);

  // 2. Auth (depends on core)
  await registerAuthServices(container);

  // 3. Task (depends on core)
  await registerTaskServices(container);

  // 4. AI (depends on core + task)
  await registerAIServices(container);

  // 5. Agent (depends on core + task)
  await registerAgentServices(container);

  // 6. Integration (depends on core + task)
  await registerIntegrationServices(container);

  // 7. Notification (depends on core)
  await registerNotificationServices(container);

  // 8. Stats (depends on core)
  await registerStatsServices(container);

  // 9. Workflow (depends on core + task)
  await registerWorkflowServices(container);

  // 10. Plugin (depends on core)
  await registerPluginServices(container);

  // 11. Updater (depends on core)
  await registerUpdaterServices(container);

  // 12. Feedback (depends on core)
  await registerFeedbackServices(container);
}

/**
 * Helper: resolve a service from the container with type safety.
 */
export function resolveService<T extends ServiceRegistry[ServiceToken]>(
  container: IDIContainer,
  token: ServiceToken,
): T {
  return container.resolve<T>(token);
}
