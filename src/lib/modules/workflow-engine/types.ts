// ==================== Workflow Types ====================

/** 所有支持的步骤类型 */
export type StepType =
  | 'create-task'
  | 'update-status'
  | 'ai-analyze'
  | 'send-notification'
  | 'wait'
  | 'parallel-group'
  | 'condition'
  | 'foreach'
  | 'invoke-agent'
  | 'http-request'
  | 'transform'
  | 'approval';

/** 所有支持的触发器类型 */
export type TriggerType =
  | 'manual'
  | 'webhook'
  | 'schedule'
  | 'event'
  | 'github-issue'
  | 'approval';

/** SOLO 调用模式 */
export type SOLOCallMode = 'mcp' | 'rest' | 'pull';

/** SOLO 子智能体类型 */
export type SOLOSubAgentType = 'explore' | 'plan' | 'general_purpose';

/** 反馈审批模式 */
export type FeedbackMode = 'auto' | 'notify' | 'block' | 'smart';

/** 反馈检查点类型 */
export type CheckpointType = 'pre_execute' | 'post_execute' | 'timeout' | 'error' | 'manual';

/** 反馈检查点状态 */
export type CheckpointStatus = 'pending' | 'approved' | 'rejected' | 'skipped' | 'modified' | 'timeout_expired';

/** 反馈决策动作 */
export type FeedbackAction = 'proceed' | 'block' | 'notify' | 'skip' | 'retry' | 'suggest_retry';

/** 工作流执行状态 */
export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/** 工作区隔离级别 */
export type IsolationLevel = 'none' | 'context' | 'full';

/** 步骤执行状态 */
export type StepExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'cancelled';

// ==================== Workflow Step ====================

export interface WorkflowStep {
  id: string;
  name: string;
  type: StepType;
  config: Record<string, unknown>;
  feedbackMode?: FeedbackMode;
  onError?: 'continue' | 'fail';
  timeoutMs?: number;
  /** SOLO 子智能体类型 (仅 ai-analyze/invoke-agent) */
  soloSubAgent?: SOLOSubAgentType;
  /** SOLO 调用模式 */
  soloCallMode?: SOLOCallMode;
  /** 条件步骤配置 */
  condition?: {
    expression: string;
    thenSteps?: WorkflowStep[];
    elseSteps?: WorkflowStep[];
  };
  /** 并行组子步骤 */
  steps?: WorkflowStep[];
}

// ==================== SOLO Bridge ====================

export interface SOLOCallParams {
  prompt: string;
  stepId: string;
  executionId: string;
  stepName: string;
  callMode?: SOLOCallMode;
  subAgentType?: SOLOSubAgentType;
  sessionId?: string;
  context?: Record<string, unknown>;
  timeoutMs?: number;
}

export interface SOLOCallResult {
  success: boolean;
  data?: unknown;
  error?: string;
  sessionId: string;
  durationMs: number;
  tokensUsed?: number;
}

export interface SOLOCallRecord {
  id: string;
  executionId: string;
  stepId: string;
  stepName: string;
  callMode: SOLOCallMode;
  subAgentType: SOLOSubAgentType;
  sessionId: string;
  prompt: string;
  output?: unknown;
  error?: string;
  durationMs: number;
  tokensUsed?: number;
  startedAt: Date;
  completedAt?: Date;
}

// ==================== Observability Metrics ====================

export interface StepMetricRecord {
  id: string;
  executionId: string;
  stepId: string;
  stepName: string;
  stepType: string;
  status: string;
  durationMs: number;
  tokensUsed?: number;
  error?: string;
  timestamp: Date;
  retryCount?: number;
}

export interface ExecutionMetricRecord {
  id: string;
  executionId: string;
  workflowId: string;
  workflowName: string;
  status: string;
  triggerType: string;
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  durationMs: number;
  totalTokensUsed?: number;
  startedAt: Date;
  completedAt?: Date;
}

export interface SOLOBridgeConfig {
  defaultMode: SOLOCallMode;
  mcpEndpoint?: string;
  restEndpoint?: string;
  defaultTimeoutMs: number;
  maxConcurrentSessions: number;
}

// ==================== Feedback ====================

export interface FeedbackDecision {
  action: FeedbackAction;
  reason?: string;
  notified?: boolean;
  checkpointId?: string;
  soloReflection?: SoloReflection;
}

export interface PostFeedbackAction {
  action: 'proceed' | 'suggest_retry' | 'block';
  reason?: string;
  suggestions?: string[];
}

export interface SoloReflection {
  riskLevel: 'low' | 'medium' | 'high';
  confidence: number; // 0-1
  reasoning: string;
  historicalScore?: number;
  recentFeedback?: string[];
}

export interface FeedbackRuleConfig {
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  action: string;
  actionConfig?: Record<string, unknown>;
}

// ==================== Execution Context ====================

export interface WorkflowContext {
  [key: string]: unknown;
  /** 内部字段 */
  _executionId?: string;
  _stepId?: string;
  _stepName?: string;
  _stepType?: string;
  _soloSessionId?: string;
  _parallelIndex?: number;
  _parentStepId?: string;
}

export interface StepResult {
  [key: string]: unknown;
}

export interface StepHandler {
  execute(config: Record<string, unknown>, context: WorkflowContext): Promise<StepResult>;
}

/** 步骤处理器依赖注入 */
export interface StepHandlerDeps {
  prisma: any;
  taskService: any;
  soloBridge?: any;
  executor?: any;
}

// ==================== Retry Policy ====================

export interface RetryPolicy {
  max: number;
  backoff: 'fixed' | 'exponential' | 'linear';
  delayMs: number;
}

// ==================== SOLO Config ====================

export interface WorkflowSOLOConfig {
  defaultMode?: SOLOCallMode;
  defaultSubAgent?: SOLOSubAgentType;
  defaultTimeoutMs?: number;
}

// ==================== DTO ====================

export interface CreateWorkflowDTO {
  name: string;
  description?: string;
  trigger?: TriggerType;
  triggerConfig?: string;
  steps: WorkflowStep[];
  variables?: Record<string, unknown>;
  retryPolicy?: RetryPolicy;
  concurrencyLimit?: number;
  timeoutMs?: number;
  soloConfig?: WorkflowSOLOConfig;
  createdBy?: string;
}

export interface UpdateWorkflowDTO {
  name?: string;
  description?: string;
  trigger?: TriggerType;
  triggerConfig?: string;
  steps?: WorkflowStep[];
  variables?: Record<string, unknown>;
  isActive?: boolean;
  retryPolicy?: RetryPolicy;
  concurrencyLimit?: number;
  timeoutMs?: number;
  soloConfig?: WorkflowSOLOConfig;
}

export interface ListWorkflowsOptions {
  page?: number;
  pageSize?: number;
  isActive?: boolean;
  createdBy?: string;
}

export interface ListExecutionsOptions {
  page?: number;
  pageSize?: number;
  status?: ExecutionStatus;
}
