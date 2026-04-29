import type { PrismaClient } from '@/generated/prisma/client';
import type { Logger } from '@/lib/core/logger';
import type { SOLOBridge } from '../solo/solo-bridge';
import type { Observability } from '../observability';
import type {
  ImprovementAnalysis,
  ImprovementRecommendation,
  ImprovementCycleResult,
  ImprovementRecord,
} from '../types';

/**
 * 反馈驱动的改进循环
 * 定期分析反馈数据，自动建议或应用工作流优化
 */
export class ImprovementLoop {
  private improvementHistory: ImprovementRecord[] = [];
  private readonly maxHistorySize = 100;

  constructor(
    private prisma: PrismaClient,
    private soloBridge: SOLOBridge,
    private observability: Observability,
    private logger?: Logger,
  ) {}

  /**
   * 分析反馈模式
   * 查询最近 N 天的反馈数据，识别问题模式
   */
  async analyzeFeedbackPatterns(params: {
    workflowId?: string;
    days?: number;
  }): Promise<ImprovementAnalysis> {
    const days = params.days ?? 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const endDate = new Date();

    this.logger?.info('Starting feedback pattern analysis', {
      workflowId: params.workflowId,
      days,
      startDate: startDate.toISOString(),
    });

    const checkpointWhere: Record<string, unknown> = {
      createdAt: { gte: startDate },
    };
    if (params.workflowId) {
      checkpointWhere.executionId = params.workflowId;
    }

    const checkpoints = await this.prisma.feedbackCheckpoint.findMany({
      where: checkpointWhere,
      orderBy: { createdAt: 'desc' },
    });

    const stepFeedbackWhere: Record<string, unknown> = {
      createdAt: { gte: startDate },
    };
    if (params.workflowId) {
      stepFeedbackWhere.executionId = params.workflowId;
    }

    const stepFeedbacks = await this.prisma.stepFeedback.findMany({
      where: stepFeedbackWhere,
      orderBy: { createdAt: 'desc' },
    });

    const allStepMetrics = this.observability.getStepMetrics();

    const totalCheckpoints = checkpoints.length;
    const approvedCount = checkpoints.filter(c => c.status === 'approved').length;
    const rejectedCount = checkpoints.filter(c => c.status === 'rejected').length;
    const timeoutCount = checkpoints.filter(c => c.status === 'timeout_expired').length;

    const approvalRate = totalCheckpoints > 0 ? approvedCount / totalCheckpoints : 0;
    const rejectionRate = totalCheckpoints > 0 ? rejectedCount / totalCheckpoints : 0;
    const timeoutRate = totalCheckpoints > 0 ? timeoutCount / totalCheckpoints : 0;

    const ratedCheckpoints = checkpoints.filter(c => c.rating != null && c.rating > 0);
    const avgRating = ratedCheckpoints.length > 0
      ? ratedCheckpoints.reduce((sum, c) => sum + (c.rating ?? 0), 0) / ratedCheckpoints.length
      : 0;

    const stepTypeMap = new Map<string, {
      count: number;
      totalDurationMs: number;
      failureCount: number;
      rejectionCount: number;
      totalTokens: number;
      tokensCount: number;
    }>();

    for (const cp of checkpoints) {
      const stepType = cp.stepType ?? 'unknown';
      if (!stepTypeMap.has(stepType)) {
        stepTypeMap.set(stepType, {
          count: 0, totalDurationMs: 0, failureCount: 0,
          rejectionCount: 0, totalTokens: 0, tokensCount: 0,
        });
      }
      const stats = stepTypeMap.get(stepType)!;
      stats.count++;
      if (cp.status === 'rejected') {
        stats.rejectionCount++;
      }
    }

    const filteredMetrics = allStepMetrics.filter(m => m.timestamp >= startDate);
    for (const metric of filteredMetrics) {
      const stepType = metric.stepType;
      if (!stepTypeMap.has(stepType)) {
        stepTypeMap.set(stepType, {
          count: 0, totalDurationMs: 0, failureCount: 0,
          rejectionCount: 0, totalTokens: 0, tokensCount: 0,
        });
      }
      const stats = stepTypeMap.get(stepType)!;
      stats.totalDurationMs += metric.durationMs;
      if (metric.status === 'failed') {
        stats.failureCount++;
      }
      if (metric.tokensUsed != null && metric.tokensUsed > 0) {
        stats.totalTokens += metric.tokensUsed;
        stats.tokensCount++;
      }
    }

    const stepTypeStats = Array.from(stepTypeMap.entries()).map(([stepType, stats]) => ({
      stepType,
      count: stats.count,
      avgDurationMs: stats.count > 0 ? stats.totalDurationMs / stats.count : 0,
      failureRate: stats.count > 0 ? stats.failureCount / stats.count : 0,
      rejectionRate: stats.count > 0 ? stats.rejectionCount / stats.count : 0,
      avgTokensUsed: stats.tokensCount > 0 ? stats.totalTokens / stats.tokensCount : 0,
    }));

    stepTypeStats.sort((a, b) => b.failureRate - a.failureRate);

    const errorPatternMap = new Map<string, number>();
    for (const metric of filteredMetrics) {
      if (metric.error) {
        const errorType = metric.error.includes(':')
          ? metric.error.split(':')[0].trim().slice(0, 80)
          : metric.error.slice(0, 80);
        errorPatternMap.set(errorType, (errorPatternMap.get(errorType) ?? 0) + 1);
      }
    }

    const topErrorPatterns = Array.from(errorPatternMap.entries())
      .map(([pattern, count]) => ({ pattern, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const highRiskSteps: Array<{ stepName: string; stepType: string; reason: string }> = [];

    for (const stat of stepTypeStats) {
      if (stat.failureRate > 0.3) {
        highRiskSteps.push({ stepName: stat.stepType, stepType: stat.stepType, reason: `High failure rate: ${(stat.failureRate * 100).toFixed(1)}%` });
      }
      if (stat.rejectionRate > 0.3) {
        highRiskSteps.push({ stepName: stat.stepType, stepType: stat.stepType, reason: `High rejection rate: ${(stat.rejectionRate * 100).toFixed(1)}%` });
      }
    }

    const rejectedCheckpoints = checkpoints.filter(c => c.status === 'rejected');
    const rejectedStepCounts = new Map<string, number>();
    for (const cp of rejectedCheckpoints) {
      const key = cp.stepName ?? cp.stepId;
      rejectedStepCounts.set(key, (rejectedStepCounts.get(key) ?? 0) + 1);
    }
    for (const [stepName, count] of rejectedStepCounts.entries()) {
      if (count >= 3) {
        const matchingCp = rejectedCheckpoints.find(c => (c.stepName ?? c.stepId) === stepName);
        if (matchingCp) {
          highRiskSteps.push({ stepName, stepType: matchingCp.stepType ?? 'unknown', reason: `Frequently rejected (${count} times in ${days} days)` });
        }
      }
    }

    const seen = new Set<string>();
    const uniqueHighRiskSteps = highRiskSteps.filter(step => {
      const key = `${step.stepName}:${step.reason}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const analysis: ImprovementAnalysis = {
      period: { start: startDate, end: endDate },
      totalCheckpoints, approvalRate, rejectionRate, timeoutRate, avgRating,
      stepTypeStats, topErrorPatterns, highRiskSteps: uniqueHighRiskSteps,
    };

    this.logger?.info('Feedback pattern analysis completed', {
      totalCheckpoints,
      approvalRate: (approvalRate * 100).toFixed(1) + '%',
      rejectionRate: (rejectionRate * 100).toFixed(1) + '%',
      highRiskStepsCount: uniqueHighRiskSteps.length,
    });

    return analysis;
  }

  /**
   * 生成改进建议
   * 调用 SOLO 分析数据并生成可操作的建议
   */
  async generateRecommendations(analysis: ImprovementAnalysis): Promise<ImprovementRecommendation[]> {
    this.logger?.info('Generating improvement recommendations via SOLO');

    const prompt = [
      `You are a workflow optimization expert. Analyze the following feedback data and generate specific, actionable improvement recommendations.`,
      ``,
      `## Analysis Period`,
      `- Start: ${analysis.period.start.toISOString()}`,
      `- End: ${analysis.period.end.toISOString()}`,
      `- Total Checkpoints: ${analysis.totalCheckpoints}`,
      ``,
      `## Rates`,
      `- Approval Rate: ${(analysis.approvalRate * 100).toFixed(1)}%`,
      `- Rejection Rate: ${(analysis.rejectionRate * 100).toFixed(1)}%`,
      `- Timeout Rate: ${(analysis.timeoutRate * 100).toFixed(1)}%`,
      `- Average Rating: ${analysis.avgRating.toFixed(2)}`,
      ``,
      `## Step Type Statistics`,
      ...analysis.stepTypeStats.map(s =>
        `- ${s.stepType}: count=${s.count}, avgDuration=${s.avgDurationMs.toFixed(0)}ms, failureRate=${(s.failureRate * 100).toFixed(1)}%, rejectionRate=${(s.rejectionRate * 100).toFixed(1)}%, avgTokens=${s.avgTokensUsed.toFixed(0)}`
      ),
      ``,
      `## Top Error Patterns`,
      ...analysis.topErrorPatterns.map(e => `- "${e.pattern}" (count: ${e.count})`),
      ``,
      `## High Risk Steps`,
      ...analysis.highRiskSteps.map(h => `- ${h.stepName} (${h.stepType}): ${h.reason}`),
      ``,
      `Generate recommendations as a JSON array. Each recommendation must have:`,
      `- type: one of "add_rule", "adjust_timeout", "add_retry", "change_feedback_mode", "optimize_prompt", "split_step"`,
      `- targetStepType: the step type this applies to (if applicable)`,
      `- description: a clear, human-readable description of the recommendation`,
      `- confidence: a number between 0 and 1 indicating how confident you are`,
      `- action: a JSON object with the specific action details`,
      `- reasoning: why you think this will help`,
      ``,
      `Respond ONLY with a valid JSON array. No explanation outside the array.`,
    ].join('\n');

    try {
      const soloResult = await this.soloBridge.call({
        prompt, stepId: 'improvement-loop', executionId: 'improvement-analysis',
        stepName: 'Improvement Analysis', callMode: 'mcp',
        subAgentType: 'general_purpose', timeoutMs: 60000,
      });

      if (!soloResult.success || !soloResult.data) {
        this.logger?.warn('SOLO call failed for recommendation generation', { error: soloResult.error });
        return [];
      }

      const rawData = typeof soloResult.data === 'string' ? soloResult.data : JSON.stringify(soloResult.data);
      let recommendations: ImprovementRecommendation[] = [];

      try {
        const parsed = JSON.parse(rawData);
        const items = Array.isArray(parsed) ? parsed : [parsed];
        recommendations = items.map((item: Record<string, unknown>, index: number) => ({
          id: Date.now().toString(36) + Math.random().toString(36).slice(2) + `-${index}`,
          type: this.validateRecommendationType(item.type as string),
          targetStepType: typeof item.targetStepType === 'string' ? item.targetStepType : undefined,
          description: typeof item.description === 'string' ? item.description : 'No description provided',
          confidence: typeof item.confidence === 'number' ? Math.min(1, Math.max(0, item.confidence)) : 0.5,
          action: item.action && typeof item.action === 'object' ? item.action as Record<string, unknown> : {},
          reasoning: typeof item.reasoning === 'string' ? item.reasoning : 'No reasoning provided',
        }));
      } catch {
        const jsonMatch = rawData.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const items = Array.isArray(parsed) ? parsed : [parsed];
          recommendations = items.map((item: Record<string, unknown>, index: number) => ({
            id: Date.now().toString(36) + Math.random().toString(36).slice(2) + `-${index}`,
            type: this.validateRecommendationType(item.type as string),
            targetStepType: typeof item.targetStepType === 'string' ? item.targetStepType : undefined,
            description: typeof item.description === 'string' ? item.description : 'No description provided',
            confidence: typeof item.confidence === 'number' ? Math.min(1, Math.max(0, item.confidence)) : 0.5,
            action: item.action && typeof item.action === 'object' ? item.action as Record<string, unknown> : {},
            reasoning: typeof item.reasoning === 'string' ? item.reasoning : 'No reasoning provided',
          }));
        }
      }

      this.logger?.info(`Generated ${recommendations.length} improvement recommendations`);
      return recommendations;
    } catch (error) {
      this.logger?.warn('Failed to generate recommendations via SOLO', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * 应用改进建议
   */
  async applyRecommendation(params: {
    workflowId: string;
    recommendation: ImprovementRecommendation;
  }): Promise<{ success: boolean; applied: string }> {
    const { workflowId, recommendation } = params;

    this.logger?.info('Applying improvement recommendation', {
      type: recommendation.type, targetStepType: recommendation.targetStepType, workflowId,
    });

    switch (recommendation.type) {
      case 'add_rule': {
        try {
          const action = recommendation.action;
          const triggerType = typeof action.triggerType === 'string' ? action.triggerType : 'error';
          const triggerConfig = action.triggerConfig ? JSON.stringify(action.triggerConfig) : '{}';
          const ruleAction = typeof action.action === 'string' ? action.action : 'notify';
          const scopeStepType = typeof action.scopeStepType === 'string' ? action.scopeStepType : null;

          await this.prisma.feedbackRule.create({
            data: {
              name: `Auto-generated: ${recommendation.description.slice(0, 100)}`,
              triggerType, triggerConfig, action: ruleAction,
              scopeWorkflowId: workflowId, scopeStepType,
              isActive: true, createdBy: 'solo',
            },
          });

          this.logger?.info('Created new feedback rule from recommendation', { triggerType, ruleAction, scopeStepType });
          return { success: true, applied: `Created feedback rule: ${recommendation.description}` };
        } catch (error) {
          this.logger?.error('Failed to create feedback rule', { error: error instanceof Error ? error.message : String(error) });
          return { success: false, applied: `Failed to create feedback rule: ${error instanceof Error ? error.message : String(error)}` };
        }
      }
      case 'adjust_timeout':
        return { success: true, applied: `Logged timeout adjustment recommendation: ${recommendation.description} (requires orchestrator to apply)` };
      case 'add_retry':
        return { success: true, applied: `Logged retry policy recommendation: ${recommendation.description} (requires orchestrator to apply)` };
      case 'change_feedback_mode':
        return { success: true, applied: `Logged feedback mode change recommendation: ${recommendation.description} (requires orchestrator to apply)` };
      case 'optimize_prompt':
        return { success: true, applied: `Logged prompt optimization recommendation: ${recommendation.description} (requires orchestrator to apply)` };
      case 'split_step':
        return { success: true, applied: `Logged step split recommendation: ${recommendation.description} (requires orchestrator to apply)` };
      default:
        return { success: false, applied: `Unknown recommendation type: ${recommendation.type}` };
    }
  }

  /**
   * 运行完整的改进周期
   */
  async runImprovementCycle(params: {
    workflowId?: string;
    days?: number;
    autoApply?: boolean;
    minConfidence?: number;
  }): Promise<ImprovementCycleResult> {
    const { workflowId, days = 7, autoApply = false, minConfidence = 0.8 } = params;

    this.logger?.info('Starting improvement cycle', { workflowId, days, autoApply, minConfidence });

    const analysis = await this.analyzeFeedbackPatterns({ workflowId, days });
    const recommendations = await this.generateRecommendations(analysis);

    let appliedCount = 0;
    let skippedCount = 0;

    if (autoApply && workflowId) {
      for (const rec of recommendations) {
        if (rec.confidence >= minConfidence) {
          const result = await this.applyRecommendation({ workflowId, recommendation: rec });
          if (result.success) { appliedCount++; } else { skippedCount++; }
        } else { skippedCount++; }
      }
    } else { skippedCount = recommendations.length; }

    const cycleResult: ImprovementCycleResult = {
      analysis, recommendations, appliedCount, skippedCount, timestamp: new Date(),
    };

    const record: ImprovementRecord = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      timestamp: new Date(), workflowId,
      analysisSummary: [
        `Checkpoints: ${analysis.totalCheckpoints}`,
        `Approval: ${(analysis.approvalRate * 100).toFixed(1)}%`,
        `Rejection: ${(analysis.rejectionRate * 100).toFixed(1)}%`,
        `High Risk: ${analysis.highRiskSteps.length} steps`,
      ].join(', '),
      recommendationsCount: recommendations.length, appliedCount,
    };

    this.addImprovementRecord(record);

    this.logger?.info('Improvement cycle completed', { recommendationsCount: recommendations.length, appliedCount, skippedCount });
    return cycleResult;
  }

  getImprovementHistory(params: { limit?: number }): ImprovementRecord[] {
    const limit = params.limit ?? 20;
    return [...this.improvementHistory].slice(-limit).reverse();
  }

  private validateRecommendationType(type: string): ImprovementRecommendation['type'] {
    const validTypes: ImprovementRecommendation['type'][] = ['add_rule', 'adjust_timeout', 'add_retry', 'change_feedback_mode', 'optimize_prompt', 'split_step'];
    return validTypes.includes(type as ImprovementRecommendation['type']) ? (type as ImprovementRecommendation['type']) : 'add_rule';
  }

  private addImprovementRecord(record: ImprovementRecord): void {
    this.improvementHistory.push(record);
    if (this.improvementHistory.length > this.maxHistorySize) {
      this.improvementHistory = this.improvementHistory.slice(-this.maxHistorySize);
    }
  }
}
