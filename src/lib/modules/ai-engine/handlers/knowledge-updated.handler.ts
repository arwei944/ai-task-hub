import type { DomainEvent } from '@/lib/core/types';
import { BaseAIHandler } from './base.handler';

interface KnowledgeUpdatedPayload {
  id?: string;
  title?: string;
  content?: string;
  category?: string;
  projectId?: string;
  tags?: string[];
  [key: string]: unknown;
}

/**
 * AI handler for knowledge.entry.updated events.
 * Analyzes knowledge entry quality, detects duplicates,
 * and generates insights with related task/project suggestions.
 */
export class KnowledgeUpdatedHandler extends BaseAIHandler {
  private titleIndex: Map<string, string> = new Map(); // normalized title -> id

  get eventType(): string {
    return 'knowledge.entry.updated';
  }

  async handle(event: DomainEvent): Promise<void> {
    const payload = event.payload as KnowledgeUpdatedPayload;

    const title = payload.title ?? 'untitled';
    const content = payload.content ?? '';

    this.logger.info(
      `[AI] Analyzing knowledge entry: "${title}"`,
    );

    // Analyze quality
    const quality = this.analyzeQuality(payload);

    // Detect potential duplicates
    const duplicates = this.detectDuplicates(title, payload.id);

    // Generate insights
    const insights = this.generateInsights(payload, quality, duplicates);

    // Update title index
    if (payload.id && title) {
      this.titleIndex.set(this.normalizeTitle(title), payload.id);
    }

    this.logger.info(
      `[AI] Knowledge quality: ${quality.score}/100, duplicates: ${duplicates.length}`,
    );

    this.eventBus.emit({
      type: 'knowledge.insight.generated',
      payload: {
        knowledgeId: payload.id,
        title,
        quality: quality.score,
        qualityDetails: quality.details,
        duplicates,
        insights,
        suggestedCategories: this.suggestCategories(payload),
        analyzedAt: new Date(),
      },
      timestamp: new Date(),
      source: 'ai-engine',
    });
  }

  /**
   * Analyze knowledge entry quality based on content metrics.
   */
  private analyzeQuality(payload: KnowledgeUpdatedPayload): {
    score: number;
    details: Record<string, string | number>;
  } {
    const details: Record<string, string | number> = {};
    let score = 0;

    const title = payload.title ?? '';
    const content = payload.content ?? '';
    const tags = payload.tags ?? [];

    // Title quality (5-50 chars is ideal)
    if (title.length >= 5 && title.length <= 50) {
      score += 20;
      details.titleQuality = 'good';
    } else if (title.length > 0) {
      score += 10;
      details.titleQuality = title.length < 5 ? 'too_short' : 'too_long';
    }

    // Content length
    if (content.length > 100) {
      score += 30;
      details.contentLength = content.length;
    } else if (content.length > 20) {
      score += 15;
      details.contentLength = content.length;
    } else {
      details.contentLength = content.length;
      details.contentWarning = '内容过短，建议补充更多细节';
    }

    // Has tags
    if (tags.length > 0) {
      score += 15;
      details.tagCount = tags.length;
    } else {
      details.tagWarning = '缺少标签，建议添加以便检索';
    }

    // Has category
    if (payload.category) {
      score += 15;
      details.hasCategory = true;
    }

    // Content structure (has code blocks, lists, etc.)
    const hasCodeBlock = /```[\s\S]*?```/.test(content);
    const hasList = /^[\s]*[-*]\s/m.test(content) || /^\d+\.\s/m.test(content);
    const hasStructure = hasCodeBlock || hasList;
    if (hasStructure) {
      score += 20;
      details.hasStructure = true;
      details.structureTypes = [
        hasCodeBlock && 'code_block',
        hasList && 'list',
      ].filter(Boolean);
    }

    score = Math.min(100, score);
    details.finalScore = score;

    return { score, details };
  }

  /**
   * Detect potential duplicate knowledge entries based on title similarity.
   */
  private detectDuplicates(title: string, currentId?: string): Array<{
    id: string;
    title: string;
    similarity: string;
  }> {
    if (!title) return [];

    const normalized = this.normalizeTitle(title);
    const duplicates: Array<{ id: string; title: string; similarity: string }> = [];

    for (const [normTitle, id] of this.titleIndex.entries()) {
      // Skip self
      if (id === currentId) continue;

      // Exact match
      if (normTitle === normalized) {
        duplicates.push({
          id,
          title: normTitle,
          similarity: 'exact',
        });
        continue;
      }

      // Contains match
      if (normTitle.includes(normalized) || normalized.includes(normTitle)) {
        duplicates.push({
          id,
          title: normTitle,
          similarity: 'contains',
        });
      }
    }

    return duplicates.slice(0, 5); // Limit results
  }

  /**
   * Generate insights and suggestions based on analysis.
   */
  private generateInsights(
    payload: KnowledgeUpdatedPayload,
    quality: { score: number; details: Record<string, string | number> },
    duplicates: Array<{ id: string }>,
  ): string[] {
    const insights: string[] = [];

    // Quality-based insights
    if (quality.score < 40) {
      insights.push('知识条目质量较低，建议补充内容和标签');
    } else if (quality.score >= 80) {
      insights.push('知识条目质量良好，可作为团队参考');
    }

    // Duplicate warnings
    if (duplicates.length > 0) {
      insights.push(
        `检测到 ${duplicates.length} 个可能重复的条目，建议合并或关联`,
      );
    }

    // Content-based suggestions
    const content = payload.content ?? '';
    const title = payload.title ?? '';

    if (content.includes('TODO') || content.includes('FIXME')) {
      insights.push('内容中包含待办标记 (TODO/FIXME)，建议跟进');
    }

    if (content.includes('deprecated') || content.includes('废弃')) {
      insights.push('内容可能已过时，建议审核是否需要更新或归档');
    }

    // Category-based project association
    if (payload.projectId) {
      insights.push(`已关联项目 ${payload.projectId}，团队成员可直接引用`);
    } else if (payload.category) {
      insights.push(`建议关联到相关项目以便团队成员发现`);
    }

    if (insights.length === 0) {
      insights.push('知识条目正常');
    }

    return insights;
  }

  /**
   * Suggest categories based on content keywords.
   */
  private suggestCategories(payload: KnowledgeUpdatedPayload): string[] {
    const text = `${payload.title ?? ''} ${payload.content ?? ''}`.toLowerCase();
    const categoryKeywords: Record<string, string[]> = {
      'API 文档': ['api', 'endpoint', 'rest', 'graphql', '接口'],
      '部署指南': ['deploy', 'docker', 'kubernetes', 'k8s', '部署', 'ci/cd'],
      '架构设计': ['architecture', 'design', 'pattern', '架构', '设计模式'],
      '问题排查': ['troubleshoot', 'debug', 'error', 'fix', '排查', '修复'],
      '最佳实践': ['best practice', 'guideline', 'standard', '最佳实践', '规范'],
      '技术选型': ['technology', 'stack', 'framework', '技术栈', '选型'],
    };

    const suggestions: string[] = [];
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(kw => text.includes(kw))) {
        suggestions.push(category);
      }
    }

    return suggestions;
  }

  /**
   * Normalize title for comparison (lowercase, trim, collapse whitespace).
   */
  private normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ');
  }
}
