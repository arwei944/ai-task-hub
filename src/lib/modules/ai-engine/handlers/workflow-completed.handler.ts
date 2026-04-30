import type { DomainEvent } from '@/lib/core/types';
import { BaseAIHandler } from './base.handler';

interface WorkflowCompletedPayload {
  id?: string;
  workflowId?: string;
  executionId?: string;
  status?: string;
  duration?: number;
  stepCount?: number;
  errorCount?: number;
  projectId?: string;
  steps?: Array<{
    name?: string;
    status?: string;
    duration?: number;
  }>;
  [key: string]: unknown;
}

/**
 * AI handler for workflow.completed events.
 * Analyzes workflow execution metrics and suggests optimizations.
 */
export class WorkflowCompletedHandler extends BaseAIHandler {
  private durationHistory: Array<{ workflowId: string; duration: number; timestamp: Date }> = [];

  get eventType(): string {
    return 'workflow.completed';
  }

  async handle(event: DomainEvent): Promise<void> {
    const payload = event.payload as WorkflowCompletedPayload;

    const workflowId = payload.workflowId ?? payload.id ?? 'unknown';
    const duration = payload.duration ?? 0;
    const stepCount = payload.stepCount ?? 0;
    const errorCount = payload.errorCount ?? 0;

    this.logger.info(
      `[AI] Workflow completed: ${workflowId} (duration: ${duration}ms, steps: ${stepCount}, errors: ${errorCount})`,
    );

    // Record duration for trend analysis
    this.durationHistory.push({
      workflowId: workflowId as string,
      duration,
      timestamp: new Date(),
    });

    // Keep only last 100 entries to prevent memory growth
    if (this.durationHistory.length > 100) {
      this.durationHistory = this.durationHistory.slice(-100);
    }

    // Calculate efficiency score
    const efficiency = this.calculateEfficiency(payload);

    this.logger.info(
      `[AI] Workflow efficiency: ${efficiency.score}/100 for ${workflowId}`,
    );

    // Check for optimization suggestions
    const optimizations = this.suggestOptimizations(payload, efficiency);

    this.eventBus.emit({
      type: 'workflow.efficiency.report',
      payload: {
        workflowId,
        executionId: payload.executionId,
        projectId: payload.projectId,
        status: payload.status,
        duration,
        stepCount,
        errorCount,
        efficiency: efficiency.score,
        efficiencyDetails: efficiency.details,
        optimizations,
        analyzedAt: new Date(),
      },
      timestamp: new Date(),
      source: 'ai-engine',
    });
  }

  /**
   * Calculate workflow efficiency score (0-100).
   */
  private calculateEfficiency(payload: WorkflowCompletedPayload): {
    score: number;
    details: Record<string, number>;
  } {
    const details: Record<string, number> = {};
    let score = 100;

    // Error penalty
    const errorCount = payload.errorCount ?? 0;
    if (errorCount > 0) {
      const errorPenalty = Math.min(errorCount * 15, 50);
      score -= errorPenalty;
      details.errorPenalty = -errorPenalty;
    }

    // Step efficiency (fewer steps for same work = more efficient)
    const stepCount = payload.stepCount ?? 0;
    if (stepCount > 20) {
      const stepPenalty = Math.min((stepCount - 20) * 2, 20);
      score -= stepPenalty;
      details.stepPenalty = -stepPenalty;
    }

    // Duration comparison with historical average
    const workflowId = payload.workflowId ?? payload.id ?? '';
    const history = this.durationHistory.filter(h => h.workflowId === workflowId);
    if (history.length > 1) {
      const avgDuration = history.reduce((sum, h) => sum + h.duration, 0) / history.length;
      const currentDuration = payload.duration ?? 0;
      if (avgDuration > 0) {
        const ratio = currentDuration / avgDuration;
        if (ratio > 2) {
          const durationPenalty = Math.min((ratio - 2) * 10, 30);
          score -= durationPenalty;
          details.durationPenalty = -durationPenalty;
          details.durationRatio = Math.round(ratio * 100) / 100;
        } else if (ratio < 0.5) {
          // Faster than average is good
          details.durationImprovement = Math.round((1 - ratio) * 100);
        }
      }
      details.avgDuration = Math.round(avgDuration);
    }

    // Status bonus
    if (payload.status === 'success' || payload.status === 'completed') {
      details.statusBonus = 0;
    } else if (payload.status === 'partial') {
      score -= 10;
      details.statusPenalty = -10;
    }

    score = Math.max(0, Math.min(100, score));
    details.finalScore = score;

    return { score, details };
  }

  /**
   * Suggest optimizations for workflows with low efficiency or slow execution.
   */
  private suggestOptimizations(
    payload: WorkflowCompletedPayload,
    efficiency: { score: number; details: Record<string, number> },
  ): string[] {
    const suggestions: string[] = [];

    // Low efficiency suggestions
    if (efficiency.score < 50) {
      suggestions.push('工作流效率较低，建议审查整体流程设计');
    }

    // Error-related suggestions
    const errorCount = payload.errorCount ?? 0;
    if (errorCount > 0) {
      suggestions.push(`${errorCount} 个步骤出错，建议增加错误处理和重试机制`);
    }

    // Duration-related suggestions
    if (efficiency.details.durationRatio && efficiency.details.durationRatio > 2) {
      suggestions.push(
        `执行时间超过平均 ${Math.round(efficiency.details.durationRatio * 100)}%，建议检查是否有步骤耗时异常`,
      );
    }

    // Step count suggestions
    const stepCount = payload.stepCount ?? 0;
    if (stepCount > 20) {
      suggestions.push(
        `步骤数量较多 (${stepCount})，考虑合并并行步骤以提高效率`,
      );
    }

    // Analyze individual steps if available
    const steps = payload.steps ?? [];
    if (steps.length > 0) {
      const slowSteps = steps
        .filter(s => s.duration && s.duration > 10000)
        .sort((a, b) => (b.duration ?? 0) - (a.duration ?? 0))
        .slice(0, 3);

      if (slowSteps.length > 0) {
        for (const step of slowSteps) {
          suggestions.push(
            `步骤 "${step.name}" 耗时 ${Math.round((step.duration ?? 0) / 1000)}s，考虑优化或缓存`,
          );
        }
      }

      // Failed steps
      const failedSteps = steps.filter(s => s.status === 'failed' || s.status === 'error');
      if (failedSteps.length > 0) {
        suggestions.push(
          `失败步骤: ${failedSteps.map(s => `"${s.name}"`).join(', ')}`,
        );
      }
    }

    if (suggestions.length === 0) {
      suggestions.push('工作流执行正常，无需优化');
    }

    return suggestions;
  }
}
