import type { Logger } from '@/lib/core/logger';
import type { EventBus } from '@/lib/core/event-bus';
import type { SOLOCallRecord, StepMetricRecord, ExecutionMetricRecord } from './types';

export class Observability {
  private readonly stepMetrics: StepMetricRecord[] = [];
  private readonly soloCallHistory: SOLOCallRecord[] = [];
  private readonly executionHistory: ExecutionMetricRecord[] = [];
  private readonly maxEntries: number;

  constructor(private eventBus?: EventBus, private logger?: Logger, maxEntries: number = 10000) { this.maxEntries = Math.max(1, maxEntries); }

  emitWorkflowEvent(type: string, payload: Record<string, unknown>): void { this.eventBus?.emit({ type: `workflow.${type}`, payload, timestamp: new Date(), source: 'workflow-engine' }); this.logger?.info(`Workflow event: ${type}`, payload); }
  emitFeedbackEvent(type: string, payload: Record<string, unknown>): void { this.eventBus?.emit({ type: `feedback.${type}`, payload, timestamp: new Date(), source: 'workflow-engine' }); this.logger?.info(`Feedback event: ${type}`, payload); }

  recordStepMetrics(params: { executionId: string; stepId: string; stepName: string; stepType: string; durationMs: number; status: string; tokensUsed?: number; error?: string; retryCount?: number; }): void {
    this.emitWorkflowEvent('step.metrics', params);
    const record: StepMetricRecord = { id: this.generateId(), executionId: params.executionId, stepId: params.stepId, stepName: params.stepName, stepType: params.stepType, status: params.status, durationMs: params.durationMs, tokensUsed: params.tokensUsed, error: params.error, timestamp: new Date(), retryCount: params.retryCount };
    this.stepMetrics.push(record); if (this.stepMetrics.length > this.maxEntries) this.stepMetrics.shift();
  }

  recordSOLOCall(record: SOLOCallRecord): void {
    this.logger?.info(`SOLO call: ${record.stepName}`, { mode: record.callMode, subAgent: record.subAgentType, duration: record.durationMs, success: !record.error });
    this.soloCallHistory.push(record); if (this.soloCallHistory.length > this.maxEntries) this.soloCallHistory.shift();
  }

  recordExecutionStart(params: { executionId: string; workflowId: string; workflowName: string; triggerType: string; totalSteps: number; }): void {
    const record: ExecutionMetricRecord = { id: this.generateId(), executionId: params.executionId, workflowId: params.workflowId, workflowName: params.workflowName, status: 'running', triggerType: params.triggerType, totalSteps: params.totalSteps, completedSteps: 0, failedSteps: 0, durationMs: 0, startedAt: new Date() };
    this.executionHistory.push(record); if (this.executionHistory.length > this.maxEntries) this.executionHistory.shift();
    this.emitWorkflowEvent('execution.started', { executionId: params.executionId, workflowId: params.workflowId, workflowName: params.workflowName, triggerType: params.triggerType, totalSteps: params.totalSteps });
  }

  recordExecutionEnd(params: { executionId: string; status: string; completedSteps: number; failedSteps: number; totalTokensUsed?: number; }): void {
    const record = this.executionHistory.find(r => r.executionId === params.executionId && r.status === 'running');
    if (record) { record.status = params.status; record.completedSteps = params.completedSteps; record.failedSteps = params.failedSteps; record.totalTokensUsed = params.totalTokensUsed; record.durationMs = Date.now() - record.startedAt.getTime(); record.completedAt = new Date(); }
    this.emitWorkflowEvent('execution.completed', { executionId: params.executionId, status: params.status, completedSteps: params.completedSteps, failedSteps: params.failedSteps, totalTokensUsed: params.totalTokensUsed });
  }

  getStepMetrics(filter?: { executionId?: string; stepType?: string; status?: string; limit?: number; }): StepMetricRecord[] {
    let results = [...this.stepMetrics];
    if (filter?.executionId) results = results.filter(r => r.executionId === filter.executionId);
    if (filter?.stepType) results = results.filter(r => r.stepType === filter.stepType);
    if (filter?.status) results = results.filter(r => r.status === filter.status);
    if (filter?.limit && filter.limit > 0) results = results.slice(-filter.limit);
    return results;
  }

  getSOLOCallHistory(filter?: { executionId?: string; stepId?: string; limit?: number; }): SOLOCallRecord[] {
    let results = [...this.soloCallHistory];
    if (filter?.executionId) results = results.filter(r => r.executionId === filter.executionId);
    if (filter?.stepId) results = results.filter(r => r.stepId === filter.stepId);
    if (filter?.limit && filter.limit > 0) results = results.slice(-filter.limit);
    return results;
  }

  getExecutionMetrics(filter?: { workflowId?: string; status?: string; limit?: number; }): ExecutionMetricRecord[] {
    let results = [...this.executionHistory];
    if (filter?.workflowId) results = results.filter(r => r.workflowId === filter.workflowId);
    if (filter?.status) results = results.filter(r => r.status === filter.status);
    if (filter?.limit && filter.limit > 0) results = results.slice(-filter.limit);
    return results;
  }

  getWorkflowStats(workflowId: string): { totalExecutions: number; successRate: number; avgDurationMs: number; avgTokensUsed: number; } {
    const executions = this.executionHistory.filter(r => r.workflowId === workflowId && r.status !== 'running');
    const totalExecutions = executions.length;
    const successCount = executions.filter(r => r.status === 'completed').length;
    const successRate = totalExecutions > 0 ? successCount / totalExecutions : 0;
    const completedExecutions = executions.filter(r => r.status === 'completed');
    const avgDurationMs = completedExecutions.length > 0 ? completedExecutions.reduce((sum, r) => sum + r.durationMs, 0) / completedExecutions.length : 0;
    const withTokens = completedExecutions.filter(r => r.totalTokensUsed != null && r.totalTokensUsed > 0);
    const avgTokensUsed = withTokens.length > 0 ? withTokens.reduce((sum, r) => sum + (r.totalTokensUsed ?? 0), 0) / withTokens.length : 0;
    return { totalExecutions, successRate, avgDurationMs, avgTokensUsed };
  }

  getGlobalStats(): { totalExecutions: number; totalSteps: number; totalSOLOCalls: number; avgStepDurationMs: number; successRate: number; } {
    const totalExecutions = this.executionHistory.length; const totalSteps = this.stepMetrics.length; const totalSOLOCalls = this.soloCallHistory.length;
    const avgStepDurationMs = totalSteps > 0 ? this.stepMetrics.reduce((sum, r) => sum + r.durationMs, 0) / totalSteps : 0;
    const finishedExecutions = this.executionHistory.filter(r => r.status === 'completed' || r.status === 'failed');
    const successRate = finishedExecutions.length > 0 ? finishedExecutions.filter(r => r.status === 'completed').length / finishedExecutions.length : 0;
    return { totalExecutions, totalSteps, totalSOLOCalls, avgStepDurationMs, successRate };
  }

  private generateId(): string { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
}