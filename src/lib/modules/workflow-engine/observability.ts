import type { Logger } from '@/lib/core/logger';
import type { EventBus } from '@/lib/core/event-bus';
import type { SOLOCallRecord } from './types';

export class Observability {
  constructor(private eventBus?: EventBus, private logger?: Logger) {}

  emitWorkflowEvent(type: string, payload: Record<string, unknown>): void {
    this.eventBus?.emit({ type: `workflow.${type}`, payload, timestamp: new Date(), source: 'workflow-engine' });
    this.logger?.info(`Workflow event: ${type}`, payload);
  }

  emitFeedbackEvent(type: string, payload: Record<string, unknown>): void {
    this.eventBus?.emit({ type: `feedback.${type}`, payload, timestamp: new Date(), source: 'workflow-engine' });
    this.logger?.info(`Feedback event: ${type}`, payload);
  }

  recordStepMetrics(params: {
    executionId: string; stepId: string; stepName: string; stepType: string;
    durationMs: number; status: string; tokensUsed?: number; error?: string;
  }): void { this.emitWorkflowEvent('step.metrics', params); }

  recordSOLOCall(record: SOLOCallRecord): void {
    this.logger?.info(`SOLO call: ${record.stepName}`, {
      mode: record.callMode, subAgent: record.subAgentType,
      duration: record.durationMs, success: !record.error,
    });
  }
}