import type { DomainEvent } from '@/lib/core/types';
import { BaseAIHandler } from './base.handler';

type ComplexityLevel = 'low' | 'medium' | 'high';

interface TaskCreatedPayload {
  id?: string;
  title?: string;
  description?: string;
  priority?: number | string;
  projectId?: string;
  [key: string]: unknown;
}

export class TaskCreatedHandler extends BaseAIHandler {
  get eventType(): string {
    return 'task.created';
  }

  async handle(event: DomainEvent): Promise<void> {
    const payload = event.payload as TaskCreatedPayload;

    this.logger.info(`[AI] Analyzing task: "${payload.title ?? 'untitled'}"`);

    const complexity = this.analyzeComplexity(payload);

    this.logger.info(
      `[AI] Task complexity: ${complexity.level} (score: ${complexity.score})`,
    );

    this.eventBus.emit({
      type: 'task.complexity.analyzed',
      payload: {
        taskId: payload.id,
        projectId: payload.projectId,
        title: payload.title,
        complexity: complexity.level,
        score: complexity.score,
        reasons: complexity.reasons,
        analyzedAt: new Date(),
      },
      timestamp: new Date(),
      source: 'ai-engine',
    });
  }

  private analyzeComplexity(payload: TaskCreatedPayload): {
    level: ComplexityLevel;
    score: number;
    reasons: string[];
  } {
    const reasons: string[] = [];
    let score = 0;

    // Normalize priority to numeric
    const priorityMap: Record<string, number> = {
      urgent: 4,
      high: 3,
      medium: 2,
      low: 1,
    };
    const numericPriority =
      typeof payload.priority === 'number'
        ? payload.priority
        : priorityMap[String(payload.priority ?? '').toLowerCase()] ?? 0;

    // Check priority
    if (numericPriority > 3) {
      score += 3;
      reasons.push(`高优先级 (${payload.priority})`);
    } else if (numericPriority > 1) {
      score += 1;
    }

    // Check description length
    const descLength = (payload.description ?? '').length;
    if (descLength > 500) {
      score += 3;
      reasons.push(`描述较长 (${descLength} 字符)`);
    } else if (descLength > 200) {
      score += 1;
    }

    // Determine level
    let level: ComplexityLevel;
    if (score >= 3) {
      level = 'high';
    } else if (score >= 1) {
      level = 'medium';
    } else {
      level = 'low';
    }

    if (reasons.length === 0) {
      reasons.push('任务简单，优先级和描述长度均在正常范围');
    }

    return { level, score, reasons };
  }
}
