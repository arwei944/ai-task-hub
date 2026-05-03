// ============================================================
// AI Task Hub v3.0 — Core Type Definitions
// ============================================================
// 基座层的所有核心类型定义，编译时类型安全
// ============================================================

// --- EventMap: 编译时类型安全的事件目录 ---

/** 工作流步骤摘要 */
export interface StepSummary {
  stepId: string;
  stepType: string;
  duration: number;
  success: boolean;
  error?: string;
}

/** AI 改进建议 */
export interface ImprovementSuggestion {
  type: 'timeout' | 'performance' | 'reliability' | 'config';
  target: string;
  description: string;
  confidence: number;
  action?: string;
}

/**
 * 事件类型映射 — 所有事件在此定义，编译时类型检查
 * 新增事件只需在此添加一行，所有订阅者自动获得类型提示
 */
export interface EventMap {
  // === 任务事件 ===
  'task.created': {
    taskId: string;
    title: string;
    projectId: string;
    priority: string;
    assignee?: string;
  };
  'task.status.changed': {
    taskId: string;
    from: string;
    to: string;
    changedBy?: string;
  };
  'task.completed': {
    taskId: string;
    duration: number;
  };
  'task.assigned': {
    taskId: string;
    assigneeId: string;
    previousAssignee?: string;
  };
  'task.priority.changed': {
    taskId: string;
    from: string;
    to: string;
  };

  // === 项目事件 ===
  'project.created': {
    projectId: string;
    name: string;
    description?: string;
  };
  'project.phase.changed': {
    projectId: string;
    from: string;
    to: string;
  };

  // === 项目中心事件 (Project Hub) ===
  'project.agent.assigned': {
    projectId: string;
    agentId: string;
    agentName: string;
    role: string;
    assignedBy?: string;
  };
  'project.agent.removed': {
    projectId: string;
    agentId: string;
    removedBy?: string;
  };
  'project.agent.roleChanged': {
    projectId: string;
    agentId: string;
    oldRole: string;
    newRole: string;
  };
  'project.milestone.created': {
    projectId: string;
    milestoneId: string;
    title: string;
    dueDate?: string;
  };
  'project.milestone.completed': {
    projectId: string;
    milestoneId: string;
    title: string;
  };
  'project.milestone.overdue': {
    projectId: string;
    milestoneId: string;
    title: string;
    dueDate: string;
  };
  'project.dependency.created': {
    sourceProjectId: string;
    targetProjectId: string;
    dependencyType: string;
  };
  'project.doc.created': {
    projectId: string;
    docId: string;
    title: string;
    docType: string;
  };
  'project.doc.updated': {
    projectId: string;
    docId: string;
    title: string;
    version: number;
  };
  'project.agent.workLogged': {
    projectId: string;
    agentId: string;
    hours: number;
    date: string;
  };
  'project.template.used': {
    templateId: string;
    projectId: string;
    templateName: string;
  };

  // === 工作流事件 ===
  'workflow.started': {
    executionId: string;
    workflowId: string;
    trigger: string;
  };
  'workflow.step.completed': {
    executionId: string;
    stepId: string;
    stepType: string;
    duration: number;
    success: boolean;
    error?: string;
  };
  'workflow.completed': {
    executionId: string;
    workflowId: string;
    duration: number;
    stepCount: number;
    errorCount: number;
    steps: StepSummary[];
  };
  'workflow.failed': {
    executionId: string;
    error: string;
    failedStep: string;
  };

  // === AI 事件 ===
  'solo.call.completed': {
    stepId: string;
    duration: number;
    success: boolean;
    tokens?: number;
    model?: string;
    error?: string;
  };
  'ai.analysis.completed': {
    taskId: string;
    complexity: string;
    suggestedWorkflow?: string;
  };
  'ai.improvement.suggested': {
    workflowId: string;
    suggestions: ImprovementSuggestion[];
  };

  // === 通知事件 ===
  'notification.sent': {
    notificationId: string;
    channel: string;
    recipient: string;
    title: string;
  };
  'feedback.approved': {
    feedbackId: string;
    executionId: string;
    decision: 'approve' | 'reject';
    approvedBy?: string;
  };

  // === 系统事件 ===
  'system.health.degraded': {
    module: string;
    severity: 'warning' | 'critical';
    reason: string;
  };
  'system.handler.failed': {
    eventType: string;
    handler: string;
    error: string;
    traceId?: string;
  };
  'system.bus.pressure': {
    queueDepth: number;
    dropCount: number;
  };
  'system.module.failed': {
    module: string;
    error: string;
  };
  'system.config.changed': {
    key: string;
    oldValue?: unknown;
    newValue?: unknown;
  };
}

/** 所有事件类型的联合 */
export type EventType = keyof EventMap;

/** 提取事件载荷类型 */
export type EventPayload<T extends EventType> = EventMap[T];

/** 带元数据的事件信封 */
export interface EventEnvelope<T extends EventType = EventType> {
  type: T;
  payload: EventPayload<T>;
  timestamp: number;
  source?: string;
  traceId?: string;
  spanId?: string;
}

// --- Capability: 统一积木接口 ---

/** 健康状态 */
export type HealthStatus = 'healthy' | 'degraded' | 'failed' | 'unknown';

/** 健康报告 */
export interface HealthReport {
  status: HealthStatus;
  latency?: number;
  details?: string;
  metrics?: Record<string, number | string | boolean>;
  checkedAt: number;
}

/** DI 容器接口 */
export interface IDIContainer {
  register<T>(token: string, factory: (container: IDIContainer) => T, options?: { singleton?: boolean; tags?: string[] }): void;
  resolve<T>(token: string): T;
  has(token: string): boolean;
  reset(): void;
}

/** EventBus 接口 */
export interface IEventBus {
  emit<T extends EventType>(event: EventEnvelope<T>): void;
  on<T extends EventType>(type: T, handler: (event: EventEnvelope<T>) => void | Promise<void>): () => void;
  once<T extends EventType>(type: T, handler: (event: EventEnvelope<T>) => void): () => void;
  off<T extends EventType>(type: T, handler: (event: EventEnvelope<T>) => void): void;
  removeAllListeners(type?: EventType): void;
  getMetrics(): EventBusMetrics;
}

/** EventBus 指标 */
export interface EventBusMetrics {
  totalEmitted: number;
  totalHandled: number;
  totalFailed: number;
  dlqSize: number;
  byType: Partial<Record<EventType, { emitted: number; handled: number; failed: number }>>;
}

/** 联动追踪器接口 */
export interface ILinkageTracer {
  getStats(): LinkageStats;
  getActiveTraces(): LinkageTrace[];
  getCompletedTraces(limit?: number): LinkageTrace[];
  getTopologyHeatmap(): TopologyEdge[];
  getAlerts(): LinkageAlert[];
  clearAlerts(): void;
}

/** 联动统计 */
export interface LinkageStats {
  activeTraces: number;
  successRate: number;
  avgDuration: number;
  errorCount: number;
  throughput: number; // events per minute
}

/** 联动链路 */
export interface LinkageTrace {
  traceId: string;
  rootEvent: string;
  status: 'active' | 'completed' | 'degraded';
  startedAt: number;
  completedAt?: number;
  totalDuration: number;
  spans: LinkageSpan[];
}

/** 联动跨度 */
export interface LinkageSpan {
  traceId: string;
  spanId: string;
  eventType: string;
  handlerName: string;
  duration: number;
  status: 'success' | 'error';
  error?: string;
  timestamp: number;
}

/** 拓扑边（热力图） */
export interface TopologyEdge {
  from: string;
  to: string;
  eventType: string;
  throughput: number;
  successRate: number;
  avgLatency: number;
}

/** 联动告警 */
export interface LinkageAlert {
  id: string;
  severity: 'warning' | 'critical';
  type: 'timeout' | 'error_spike' | 'latency_increase' | 'dlq_growth';
  message: string;
  traceId?: string;
  handlerName?: string;
  timestamp: number;
}

/**
 * 统一积木接口 — 三个方法定义一个能力模块
 * 所有积木必须实现此接口
 */
export interface Capability {
  /** 积木唯一标识 */
  readonly id: string;

  /** 注册服务到 DI 容器 */
  register(container: IDIContainer): Promise<void>;

  /** 订阅事件到 EventBus */
  subscribe(bus: IEventBus): Promise<void>;

  /** 健康检查 */
  healthCheck(): HealthReport;
}

// --- AppKernel: 组合根 ---

/** AppKernel 配置 */
export interface AppKernelConfig {
  /** 是否启用联动追踪（默认 true） */
  enableLinkageTracer?: boolean;
  /** 是否启用 DLQ（默认 true） */
  enableDLQ?: boolean;
  /** 健康检查间隔（毫秒，默认 30000） */
  healthCheckInterval?: number;
  /** DLQ 最大容量（默认 1000） */
  maxDLQSize?: number;
}

/** AppKernel 状态 */
export interface AppKernelStatus {
  booted: boolean;
  bootDuration: number;
  capabilities: {
    id: string;
    status: HealthStatus;
    latency?: number;
  }[];
  eventBus: EventBusMetrics;
  linkage: LinkageStats;
  healthIssues: number;
}
