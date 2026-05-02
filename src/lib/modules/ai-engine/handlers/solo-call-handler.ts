import type { DomainEvent } from '@/lib/core/types';
import { BaseAIHandler } from './base.handler';

interface SOLOCallPayload {
  executionId?: string;
  stepId?: string;
  stepName?: string;
  callMode?: string;
  subAgentType?: string;
  durationMs?: number;
  success?: boolean;
  error?: string;
  tokensUsed?: number;
  [key: string]: unknown;
}

export class SOLOCallHandler extends BaseAIHandler {
  private callStats = {
    total: 0,
    success: 0,
    failed: 0,
    totalDurationMs: 0,
    totalTokensUsed: 0,
  };

  get eventType(): string {
    return 'solo.call.completed';
  }

  async handle(event: DomainEvent): Promise<void> {
    const payload = event.payload as SOLOCallPayload;
    const success = payload.success !== false;
    const duration = payload.durationMs ?? 0;

    this.callStats.total++;
    if (success) this.callStats.success++;
    else this.callStats.failed++;
    this.callStats.totalDurationMs += duration;
    this.callStats.totalTokensUsed += (payload.tokensUsed ?? 0);

    const avgDuration = this.callStats.total > 0
      ? Math.round(this.callStats.totalDurationMs / this.callStats.total)
      : 0;
    const successRate = this.callStats.total > 0
      ? Math.round((this.callStats.success / this.callStats.total) * 100)
      : 0;

    this.logger.info(
      `[AI] SOLO call #${this.callStats.total}: ${payload.stepName ?? 'unknown'} ` +
      `mode=${payload.callMode ?? '?'} agent=${payload.subAgentType ?? '?'} ` +
      `duration=${duration}ms success=${success} ` +
      `(avg=${avgDuration}ms, rate=${successRate}%)`,
    );

    // Emit self-awareness event
    this.eventBus.emit({
      type: 'ai.solo.performance',
      payload: {
        totalCalls: this.callStats.total,
        successRate,
        avgDurationMs: avgDuration,
        totalTokensUsed: this.callStats.totalTokensUsed,
        lastCall: {
          stepName: payload.stepName,
          callMode: payload.callMode,
          subAgentType: payload.subAgentType,
          durationMs: duration,
          success,
        },
      },
      timestamp: new Date(),
      source: 'ai-engine',
    });
  }
}
