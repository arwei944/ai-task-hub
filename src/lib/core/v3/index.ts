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
