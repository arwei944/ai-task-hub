// ============================================================
// v3 tRPC Context — Service-aware context for tRPC routers
// ============================================================
//
// Extends the base tRPC context with a `services` accessor
// that provides type-safe access to all registered services
// via the DI container.
//
// Usage in routers:
//   const taskService = ctx.services.taskService;
//   const prisma = ctx.services.prisma;
// ============================================================

import type { IDIContainer } from '@/lib/core/v3';
import {
  ServiceTokens,
  type ServiceRegistry,
  type ServiceToken,
} from './service-factory';

// ---- Service Accessor ----

/**
 * Provides typed access to services from the DI container.
 * Used as `ctx.services` in tRPC routers.
 */
export class ServiceAccessor {
  constructor(private container: IDIContainer) {}

  /**
   * Get a service by token with full type safety.
   * Usage: services.get(ServiceTokens.taskService)
   */
  get<K extends ServiceToken>(token: K): ServiceRegistry[K] {
    return this.container.resolve(token) as unknown as ServiceRegistry[K];
  }

  // ---- Convenience shortcuts ----

  get prisma() { return this.get(ServiceTokens.prisma); }
  get eventBus() { return this.get(ServiceTokens.eventBus); }
  get logger() { return this.get(ServiceTokens.logger); }

  get authService() { return this.get(ServiceTokens.authService); }
  get userRepo() { return this.get(ServiceTokens.userRepo); }

  get taskService() { return this.get(ServiceTokens.taskService); }
  get taskRepo() { return this.get(ServiceTokens.taskRepo); }

  get aiModel() { return this.get(ServiceTokens.aiModel); }
  get taskExtractor() { return this.get(ServiceTokens.taskExtractor); }
  get taskDecomposer() { return this.get(ServiceTokens.taskDecomposer); }
  get autoTaskDecomposer() { return this.get(ServiceTokens.autoTaskDecomposer); }
  get statusInferencer() { return this.get(ServiceTokens.statusInferencer); }
  get taskAnalyzer() { return this.get(ServiceTokens.taskAnalyzer); }
  get nlTaskQuery() { return this.get(ServiceTokens.nlTaskQuery); }
  get scheduleAdvisor() { return this.get(ServiceTokens.scheduleAdvisor); }

  get agentService() { return this.get(ServiceTokens.agentService); }
  get permissionService() { return this.get(ServiceTokens.permissionService); }
  get agentOperationLogger() { return this.get(ServiceTokens.agentOperationLogger); }

  get integrationService() { return this.get(ServiceTokens.integrationService); }

  get notificationRepo() { return this.get(ServiceTokens.notificationRepo); }
  get webPushService() { return this.get(ServiceTokens.webPushService); }
  get ruleEngine() { return this.get(ServiceTokens.ruleEngine); }

  get statisticsService() { return this.get(ServiceTokens.statisticsService); }

  get workflowService() { return this.get(ServiceTokens.workflowService); }

  get pluginLoader() { return this.get(ServiceTokens.pluginLoader); }

  get moduleUpdaterService() { return this.get(ServiceTokens.moduleUpdaterService); }

  get improvementLoop() { return this.get(ServiceTokens.improvementLoop); }

  get projectHubService() { return this.get(ServiceTokens.projectHubService); }
  get milestoneService() { return this.get(ServiceTokens.milestoneService); }
  get projectAgentService() { return this.get(ServiceTokens.projectAgentService); }
  get projectDependencyService() { return this.get(ServiceTokens.projectDependencyService); }
  get workLogService() { return this.get(ServiceTokens.workLogService); }
  get docService() { return this.get(ServiceTokens.docService); }
  get templateService() { return this.get(ServiceTokens.templateService); }
  get reportService() { return this.get(ServiceTokens.reportService); }
}

export type { ServiceToken };
