import type { PrismaClient } from '@/generated/prisma/client';
import type { WorkflowStep, WorkflowContext } from '../types';

interface RuleEvaluationResult {
  action: 'block' | 'notify' | 'skip' | 'proceed';
  reason?: string;
}

/**
 * 反馈规则引擎
 * 根据预定义的规则自动评估步骤是否需要干预
 */
export class FeedbackRuleEngine {
  constructor(private prisma: PrismaClient) {}

  /**
   * 评估所有活跃规则
   */
  async evaluate(params: {
    step: WorkflowStep;
    context: WorkflowContext;
    executionId: string;
  }): Promise<RuleEvaluationResult> {
    const rules = await this.prisma.feedbackRule.findMany({
      where: { isActive: true },
    });

    for (const rule of rules) {
      const result = this.evaluateRule(rule, params.step, params.context);
      if (result.action !== 'proceed') {
        return result;
      }
    }

    return { action: 'proceed' };
  }

  /**
   * 评估单条规则
   */
  private evaluateRule(
    rule: {
      name: string;
      triggerType: string;
      triggerConfig: string;
      action: string;
      scopeWorkflowId: string | null;
      scopeStepType: string | null;
    },
    step: WorkflowStep,
    context: WorkflowContext,
  ): RuleEvaluationResult {
    let config: Record<string, unknown>;
    try {
      config = JSON.parse(rule.triggerConfig);
    } catch {
      return { action: 'proceed' };
    }

    // 检查作用域
    if (rule.scopeStepType && rule.scopeStepType !== step.type) {
      return { action: 'proceed' };
    }

    switch (rule.triggerType) {
      case 'step_type': {
        const targetTypes = config.stepTypes as string[] | undefined;
        if (targetTypes && targetTypes.includes(step.type)) {
          return {
            action: rule.action as RuleEvaluationResult['action'],
            reason: `Rule "${rule.name}" matched step type "${step.type}"`,
          };
        }
        break;
      }

      case 'always': {
        return {
          action: rule.action as RuleEvaluationResult['action'],
          reason: `Rule "${rule.name}" always triggers`,
        };
      }

      case 'duration': {
        // 需要执行后才能评估，跳过前置检查
        break;
      }

      case 'token_cost': {
        // 需要执行后才能评估，跳过前置检查
        break;
      }
    }

    return { action: 'proceed' };
  }

  /**
   * 评估单条规则（带执行结果，用于 post-execute 评估）
   */
  private evaluateRuleWithResult(
    rule: {
      name: string;
      triggerType: string;
      triggerConfig: string;
      action: string;
      scopeWorkflowId: string | null;
      scopeStepType: string | null;
    },
    step: WorkflowStep,
    context: WorkflowContext,
    durationMs: number,
    tokensUsed?: number,
    errorMessage?: string,
  ): RuleEvaluationResult {
    let config: Record<string, unknown>;
    try {
      config = JSON.parse(rule.triggerConfig);
    } catch {
      return { action: 'proceed' };
    }

    // 检查作用域
    if (rule.scopeStepType && rule.scopeStepType !== step.type) {
      return { action: 'proceed' };
    }

    switch (rule.triggerType) {
      case 'step_type': {
        const targetTypes = config.stepTypes as string[] | undefined;
        if (targetTypes && targetTypes.includes(step.type)) {
          return {
            action: rule.action as RuleEvaluationResult['action'],
            reason: `Rule "${rule.name}" matched step type "${step.type}"`,
          };
        }
        break;
      }

      case 'always': {
        return {
          action: rule.action as RuleEvaluationResult['action'],
          reason: `Rule "${rule.name}" always triggers`,
        };
      }

      case 'duration': {
        const thresholdMs = Number(config.thresholdMs) || 30000;
        if (durationMs > thresholdMs) {
          return {
            action: rule.action as RuleEvaluationResult['action'],
            reason: `Rule "${rule.name}" triggered: step "${step.name}" duration ${durationMs}ms exceeded threshold ${thresholdMs}ms`,
          };
        }
        break;
      }

      case 'token_cost': {
        const thresholdTokens = Number(config.thresholdTokens) || 10000;
        if (tokensUsed !== undefined && tokensUsed > thresholdTokens) {
          return {
            action: rule.action as RuleEvaluationResult['action'],
            reason: `Rule "${rule.name}" triggered: step "${step.name}" token cost ${tokensUsed} exceeded threshold ${thresholdTokens}`,
          };
        }
        break;
      }

      case 'error': {
        const errorPatterns = config.errorPatterns as string[] | undefined;
        if (errorPatterns && errorMessage) {
          for (const pattern of errorPatterns) {
            try {
              const regex = new RegExp(pattern);
              if (regex.test(errorMessage)) {
                return {
                  action: rule.action as RuleEvaluationResult['action'],
                  reason: `Rule "${rule.name}" triggered: error message matched pattern "${pattern}"`,
                };
              }
            } catch {
              // Invalid regex pattern, skip
            }
          }
        }
        break;
      }
    }

    return { action: 'proceed' };
  }

  /**
   * 执行后评估（基于执行结果）
   */
  async evaluatePostExecute(params: {
    step: WorkflowStep;
    context: WorkflowContext;
    executionId: string;
    durationMs: number;
    tokensUsed?: number;
    errorMessage?: string;
  }): Promise<RuleEvaluationResult> {
    const rules = await this.prisma.feedbackRule.findMany({
      where: { isActive: true },
    });

    for (const rule of rules) {
      const result = this.evaluateRuleWithResult(
        rule,
        params.step,
        params.context,
        params.durationMs,
        params.tokensUsed,
        params.errorMessage,
      );
      if (result.action !== 'proceed') {
        return result;
      }
    }

    return { action: 'proceed' };
  }
}
