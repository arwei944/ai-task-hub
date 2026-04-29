// ==================== Workflow Types ====================

export type StepType = 'create-task' | 'update-status' | 'ai-analyze' | 'send-notification' | 'wait' | 'parallel-group' | 'condition' | 'foreach' | 'invoke-agent' | 'http-request' | 'transform' | 'approval';
export type TriggerType = 'manual' | 'webhook' | 'schedule' | 'event' | 'github-issue' | 'approval';
export type SOLOCallMode = 'mcp' | 'rest' | 'pull';
export type SOLOSubAgentType = 'explore' | 'plan' | 'general_purpose';
export type FeedbackMode = 'auto' | 'notify' | 'block' | 'smart';
export type CheckpointType = 'pre_execute' | 'post_execute' | 'timeout' | 'error' | 'manual';
export type CheckpointStatus = 'pending' | 'approved' | 'rejected' | 'skipped' | 'modified' | 'timeout_expired';
export type FeedbackAction = 'proceed' | 'block' | 'notify' | 'skip' | 'retry' | 'suggest_retry';
export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type IsolationLevel = 'none' | 'context' | 'full';
export type StepExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'cancelled';

export interface WorkflowStep { id: string; name: string; type: StepType; config: Record<string, unknown>; feedbackMode?: FeedbackMode; onError?: 'continue' | 'fail'; timeoutMs?: number; soloSubAgent?: SOLOSubAgentType; soloCallMode?: SOLOCallMode; condition?: { expression: string; thenSteps?: WorkflowStep[]; elseSteps?: WorkflowStep[] }; steps?: WorkflowStep[]; }
export interface SOLOCallParams { prompt: string; stepId: string; executionId: string; stepName: string; callMode?: SOLOCallMode; subAgentType?: SOLOSubAgentType; sessionId?: string; context?: Record<string, unknown>; timeoutMs?: number; }
export interface SOLOCallResult { success: boolean; data?: unknown; error?: string; sessionId: string; durationMs: number; tokensUsed?: number; }
export interface SOLOCallRecord { id: string; executionId: string; stepId: string; stepName: string; callMode: SOLOCallMode; subAgentType: SOLOSubAgentType; sessionId: string; prompt: string; output?: unknown; error?: string; durationMs: number; tokensUsed?: number; startedAt: Date; completedAt?: Date; }
export interface StepMetricRecord { id: string; executionId: string; stepId: string; stepName: string; stepType: string; status: string; durationMs: number; tokensUsed?: number; error?: string; timestamp: Date; retryCount?: number; }
export interface ExecutionMetricRecord { id: string; executionId: string; workflowId: string; workflowName: string; status: string; triggerType: string; totalSteps: number; completedSteps: number; failedSteps: number; durationMs: number; totalTokensUsed?: number; startedAt: Date; completedAt?: Date; }
export interface SOLOBridgeConfig { defaultMode: SOLOCallMode; mcpEndpoint?: string; restEndpoint?: string; defaultTimeoutMs: number; maxConcurrentSessions: number; }
export interface FeedbackDecision { action: FeedbackAction; reason?: string; notified?: boolean; checkpointId?: string; soloReflection?: SoloReflection; }
export interface PostFeedbackAction { action: 'proceed' | 'suggest_retry' | 'block'; reason?: string; suggestions?: string[]; }
export interface SoloReflection { riskLevel: 'low' | 'medium' | 'high'; confidence: number; reasoning: string; historicalScore?: number; recentFeedback?: string[]; }
export interface FeedbackRuleConfig { triggerType: string; triggerConfig: Record<string, unknown>; action: string; actionConfig?: Record<string, unknown>; }
export interface WorkflowContext { [key: string]: unknown; _executionId?: string; _stepId?: string; _stepName?: string; _stepType?: string; _soloSessionId?: string; _parallelIndex?: number; _parentStepId?: string; }
export interface StepResult { [key: string]: unknown; }
export interface StepHandler { execute(config: Record<string, unknown>, context: WorkflowContext): Promise<StepResult>; }
export interface StepHandlerDeps { prisma: any; taskService: any; soloBridge?: any; executor?: any; }
export interface RetryPolicy { max: number; backoff: 'fixed' | 'exponential' | 'linear'; delayMs: number; }
export interface WorkflowSOLOConfig { defaultMode?: SOLOCallMode; defaultSubAgent?: SOLOSubAgentType; defaultTimeoutMs?: number; }
export interface CreateWorkflowDTO { name: string; description?: string; trigger?: TriggerType; triggerConfig?: string; steps: WorkflowStep[]; variables?: Record<string, unknown>; retryPolicy?: RetryPolicy; concurrencyLimit?: number; timeoutMs?: number; soloConfig?: WorkflowSOLOConfig; createdBy?: string; }
export interface UpdateWorkflowDTO { name?: string; description?: string; trigger?: TriggerType; triggerConfig?: string; steps?: WorkflowStep[]; variables?: Record<string, unknown>; isActive?: boolean; retryPolicy?: RetryPolicy; concurrencyLimit?: number; timeoutMs?: number; soloConfig?: WorkflowSOLOConfig; }
export interface ListWorkflowsOptions { page?: number; pageSize?: number; isActive?: boolean; createdBy?: string; }
export interface ListExecutionsOptions { page?: number; pageSize?: number; status?: ExecutionStatus; }
export interface ImprovementAnalysis { period: { start: Date; end: Date }; totalCheckpoints: number; approvalRate: number; rejectionRate: number; timeoutRate: number; avgRating: number; stepTypeStats: Array<{ stepType: string; count: number; avgDurationMs: number; failureRate: number; rejectionRate: number; avgTokensUsed: number }>; topErrorPatterns: Array<{ pattern: string; count: number }>; highRiskSteps: Array<{ stepName: string; stepType: string; reason: string }>; }
export interface ImprovementRecommendation { id: string; type: 'add_rule' | 'adjust_timeout' | 'add_retry' | 'change_feedback_mode' | 'optimize_prompt' | 'split_step'; targetStepType?: string; description: string; confidence: number; action: Record<string, unknown>; reasoning: string; }
export interface ImprovementCycleResult { analysis: ImprovementAnalysis; recommendations: ImprovementRecommendation[]; appliedCount: number; skippedCount: number; timestamp: Date; }
export interface ImprovementRecord { id: string; timestamp: Date; workflowId?: string; analysisSummary: string; recommendationsCount: number; appliedCount: number; }