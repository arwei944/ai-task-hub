// ============================================================
// AI Task Hub v3.0 — Foundation Layer (基座层)
// ============================================================
// 统一导出所有基座层模块
// ============================================================

// 类型
export type {
  EventType,
  EventPayload,
  EventEnvelope,
  HealthStatus,
  HealthReport,
  IDIContainer,
  IEventBus,
  ILinkageTracer,
  EventBusMetrics,
  LinkageStats,
  LinkageTrace,
  LinkageSpan,
  TopologyEdge,
  LinkageAlert,
  Capability,
  AppKernelConfig,
  AppKernelStatus,
  StepSummary,
  ImprovementSuggestion,
} from './types';

// DI 容器
export { DIContainer } from './di';

// EventBus
export { EventBus, getGlobalEventBus } from './event-bus';
export type { EventBusConfig, DeadLetterEntry } from './event-bus';

// 联动追踪器
export { LinkageTracer } from './linkage-tracer';
export type { LinkageTracerConfig } from './linkage-tracer';

// 健康监控 + 熔断器
export { HealthMonitor, CircuitBreaker } from './health';
export type { HealthMonitorConfig, CircuitBreakerConfig } from './health';

// AppKernel
export { AppKernel, getKernel, initKernel } from './kernel';

// MCP Auto-Discovery Registry
export { McpAutoRegistry, jsonSchemaToZodShape } from './mcp-registry';
export type { ResolvedTool, ModuleContext, ModuleInitResult, McpToolModuleDescriptor } from './mcp-registry';
export { mcpToolModules } from './mcp-modules';

// Service Factory (centralized service instantiation for tRPC)
export { ServiceTokens, registerAllServices, resolveService } from './service-factory';
export type { ServiceRegistry, ServiceToken } from './service-factory';

// tRPC Context Extension
export { ServiceAccessor } from './trpc-context';

// Base Capability
export { BaseCapability } from './base-capability';

// Capability Implementations
export {
  TaskCapability,
  NotificationCapability,
  WorkflowCapability,
  AICapability,
  IntegrationCapability,
  AgentCapability,
  ObservabilityCapability,
} from './capabilities';

// Self-Healing Manager
export { SelfHealingManager, getSelfHealingManager } from './self-healing';
export type { HealthEvent, HealthListener, DLQEntry } from './self-healing';
