import type { DomainEvent } from '@/lib/core/types';
import { BaseAIHandler } from './base.handler';

type ComplexityLevel = 'low' | 'medium' | 'high';

interface RequirementCreatedPayload {
  id?: string;
  title?: string;
  description?: string;
  priority?: number | string;
  projectId?: string;
  category?: string;
  [key: string]: unknown;
}

/**
 * AI handler for requirement.created events.
 * Analyzes requirement complexity based on description length,
 * priority, and keyword analysis.
 */
export class RequirementCreatedHandler extends BaseAIHandler {
  get eventType(): string {
    return 'requirement.created';
  }

  async handle(event: DomainEvent): Promise<void> {
    const payload = event.payload as RequirementCreatedPayload;

    this.logger.info(
      `[AI] Analyzing requirement: "${payload.title ?? 'untitled'}"`,
    );

    const complexity = this.analyzeComplexity(payload);

    this.logger.info(
      `[AI] Requirement complexity: ${complexity.level} (score: ${complexity.score})`,
    );

    this.eventBus.emit({
      type: 'requirement.complexity.analyzed',
      payload: {
        requirementId: payload.id,
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

  /**
   * Analyze requirement complexity based on multiple factors.
   * Keywords like "security", "performance", "integration" increase score.
   */
  private analyzeComplexity(payload: RequirementCreatedPayload): {
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

    // Keyword analysis for complexity indicators
    const complexityKeywords: Record<string, number> = {
      security: 3,
      '安全': 3,
      performance: 2,
      '性能': 2,
      integration: 2,
      '集成': 2,
      migration: 2,
      '迁移': 2,
      encryption: 2,
      '加密': 2,
      'real-time': 2,
      '实时': 2,
      distributed: 2,
      '分布式': 2,
      scalability: 2,
      '扩展': 2,
      compliance: 2,
      '合规': 2,
      authentication: 2,
      '认证': 2,
      authorization: 2,
      '授权': 2,
      'multi-tenant': 3,
      '多租户': 3,
      'high-availability': 3,
      '高可用': 3,
    };

    const fullText = `${payload.title ?? ''} ${payload.description ?? ''}`.toLowerCase();
    for (const [keyword, weight] of Object.entries(complexityKeywords)) {
      if (fullText.includes(keyword.toLowerCase())) {
        score += weight;
        reasons.push(`包含复杂度关键词: "${keyword}"`);
      }
    }

    // Determine level
    let level: ComplexityLevel;
    if (score >= 5) {
      level = 'high';
    } else if (score >= 2) {
      level = 'medium';
    } else {
      level = 'low';
    }

    if (reasons.length === 0) {
      reasons.push('需求简单，优先级和描述长度均在正常范围');
    }

    return { level, score, reasons };
  }
}
