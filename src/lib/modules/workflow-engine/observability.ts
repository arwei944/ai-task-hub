import type { Logger } from '@/lib/core/logger';
import type { EventBus } from '@/lib/core/event-bus';
import type { SOLOCallRecord } from './types';

/**
 * 可观测性层
 * 统一管理日志、事件发射、指标收集
 */
export class Observability {
  constructor(
    private eventBus?: EventBus,
    private logger?: Logger,
  ) {}

  /** 发射工作流事件 */
  emitWorkflowEvent(type: string, payload: Record<string, unknown>): void {
    this.eventBus?.emit({
      type: `workflow.${type}`,
      payload,
      timestamp: new Date(),
      source: 'workflow-engine',
    });
    this.logger?.info(`Workflow event: ${type}`, payload);
  }

  /** 发射反馈事件 */
  emitFeedbackEvent(type: string, payload: Record<string, unknown>): void {
    this.eventBus?.emit({
      type: `feedback.${type}`,
      payload,
      timestamp: new Date(),
      source: 'workflow-engine',
    });
    this.logger?.info(`Feedback event: ${type}`, payload);
  }

  /** 记录步骤执行指标 */
  recordStepMetrics(params: {
    executionId: string;
    stepId: string;
    stepName: string;
    stepType: string;
    durationMs: number;
    status: string;
    tokensUsed?: number;
    error?: string;
  }): void {
    this.emitWorkflowEvent('step.metrics', params);
  }

  /** 记录 SOLO 调用 */
  recordSOLOCall(record: SOLOCallRecord): void {
    this.logger?.info(`SOLO call: ${record.stepName}`, {
      mode: record.callMode,
      subAgent: record.subAgentType,
      duration: record.durationMs,
      success: !record.error,
    });
  }
}
