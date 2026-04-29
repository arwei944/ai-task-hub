import type { PrismaClient } from '@/generated/prisma/client';
import type { WorkflowStep, WorkflowContext } from '../types';

interface RuleEvaluationResult { action: 'block' | 'notify' | 'skip' | 'proceed'; reason?: string; }

export class FeedbackRuleEngine {
  constructor(private prisma: PrismaClient) {}

  async evaluate(params: { step: WorkflowStep; context: WorkflowContext; executionId: string; }): Promise<RuleEvaluationResult> {
    const rules = await this.prisma.feedbackRule.findMany({ where: { isActive: true } });
    for (const rule of rules) { const result = this.evaluateRule(rule, params.step, params.context); if (result.action !== 'proceed') return result; }
    return { action: 'proceed' };
  }

  private evaluateRule(rule: { name: string; triggerType: string; triggerConfig: string; action: string; scopeWorkflowId: string | null; scopeStepType: string | null; }, step: WorkflowStep, context: WorkflowContext): RuleEvaluationResult {
    let config: Record<string, unknown>; try { config = JSON.parse(rule.triggerConfig); } catch { return { action: 'proceed' }; }
    if (rule.scopeStepType && rule.scopeStepType !== step.type) return { action: 'proceed' };
    switch (rule.triggerType) {
      case 'step_type': { const targetTypes = config.stepTypes as string[] | undefined; if (targetTypes && targetTypes.includes(step.type)) return { action: rule.action as RuleEvaluationResult['action'], reason: `Rule "${rule.name}" matched step type "${step.type}"` }; break; }
      case 'always': return { action: rule.action as RuleEvaluationResult['action'], reason: `Rule "${rule.name}" always triggers` };
      case 'duration': break;
      case 'token_cost': break;
    }
    return { action: 'proceed' };
  }

  private evaluateRuleWithResult(rule: { name: string; triggerType: string; triggerConfig: string; action: string; scopeWorkflowId: string | null; scopeStepType: string | null; }, step: WorkflowStep, context: WorkflowContext, durationMs: number, tokensUsed?: number, errorMessage?: string): RuleEvaluationResult {
    let config: Record<string, unknown>; try { config = JSON.parse(rule.triggerConfig); } catch { return { action: 'proceed' }; }
    if (rule.scopeStepType && rule.scopeStepType !== step.type) return { action: 'proceed' };
    switch (rule.triggerType) {
      case 'step_type': { const targetTypes = config.stepTypes as string[] | undefined; if (targetTypes && targetTypes.includes(step.type)) return { action: rule.action as RuleEvaluationResult['action'], reason: `Rule "${rule.name}" matched step type "${step.type}"` }; break; }
      case 'always': return { action: rule.action as RuleEvaluationResult['action'], reason: `Rule "${rule.name}" always triggers` };
      case 'duration': { const thresholdMs = Number(config.thresholdMs) || 30000; if (durationMs > thresholdMs) return { action: rule.action as RuleEvaluationResult['action'], reason: `Rule "${rule.name}": step "${step.name}" duration ${durationMs}ms > ${thresholdMs}ms` }; break; }
      case 'token_cost': { const thresholdTokens = Number(config.thresholdTokens) || 10000; if (tokensUsed !== undefined && tokensUsed > thresholdTokens) return { action: rule.action as RuleEvaluationResult['action'], reason: `Rule "${rule.name}": step "${step.name}" tokens ${tokensUsed} > ${thresholdTokens}` }; break; }
      case 'error': { const errorPatterns = config.errorPatterns as string[] | undefined; if (errorPatterns && errorMessage) { for (const pattern of errorPatterns) { try { if (new RegExp(pattern).test(errorMessage)) return { action: rule.action as RuleEvaluationResult['action'], reason: `Rule "${rule.name}": error matched "${pattern}"` }; } catch {} } } break; }
    }
    return { action: 'proceed' };
  }

  async evaluatePostExecute(params: { step: WorkflowStep; context: WorkflowContext; executionId: string; durationMs: number; tokensUsed?: number; errorMessage?: string; }): Promise<RuleEvaluationResult> {
    const rules = await this.prisma.feedbackRule.findMany({ where: { isActive: true } });
    for (const rule of rules) { const result = this.evaluateRuleWithResult(rule, params.step, params.context, params.durationMs, params.tokensUsed, params.errorMessage); if (result.action !== 'proceed') return result; }
    return { action: 'proceed' };
  }
}