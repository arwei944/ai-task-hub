import type { PrismaClient } from '@/generated/prisma/client';
import type { Logger } from '@/lib/core/logger';
import type { EventBus } from '@/lib/core/event-bus';
import type { Observability } from '../observability';
import type { SOLOBridge } from '../solo/solo-bridge';
import type { WorkflowStep, WorkflowContext, FeedbackDecision, PostFeedbackAction, SoloReflection, FeedbackMode, CheckpointType } from '../types';
import { FeedbackRuleEngine } from './rule-engine';

export class FeedbackModule {
  private ruleEngine: FeedbackRuleEngine;
  constructor(
    private prisma: PrismaClient, private soloBridge: SOLOBridge,
    private observability: Observability, private eventBus?: EventBus, private logger?: Logger,
  ) { this.ruleEngine = new FeedbackRuleEngine(prisma); }

  async preExecuteCheck(params: { executionId: string; step: WorkflowStep; context: WorkflowContext }): Promise<FeedbackDecision> {
    const { executionId, step, context } = params;
    const mode: FeedbackMode = (step.config.feedbackMode as FeedbackMode) ?? 'auto';
    const ruleResult = await this.ruleEngine.evaluate({ step, context, executionId });
    if (ruleResult.action === 'block') {
      const checkpoint = await this.createCheckpoint({ executionId, step, checkpointType: 'pre_execute', status: 'rejected', approvalMode: 'auto', intervention: `Auto rule blocked: ${ruleResult.reason}`, intervenedBy: 'auto_rule' });
      return { action: 'block', reason: ruleResult.reason, checkpointId: checkpoint.id };
    }
    if (ruleResult.action === 'skip') return { action: 'skip', reason: ruleResult.reason };
    let reflection: SoloReflection | undefined;
    if (mode !== 'auto') reflection = await this.soloSelfReflect(params);
    switch (mode) {
      case 'auto': return { action: 'proceed' };
      case 'notify': {
        const checkpoint = await this.createCheckpoint({ executionId, step, checkpointType: 'pre_execute', status: 'approved', approvalMode: 'notify', contextSnapshot: JSON.stringify(context) });
        this.observability.emitFeedbackEvent('checkpoint.created', { checkpointId: checkpoint.id, executionId, stepId: step.id, stepName: step.name, mode: 'notify' });
        return { action: 'proceed', notified: true, checkpointId: checkpoint.id, soloReflection: reflection };
      }
      case 'block': {
        const checkpoint = await this.createCheckpoint({ executionId, step, checkpointType: 'pre_execute', status: 'pending', approvalMode: 'block', contextSnapshot: JSON.stringify(context) });
        this.observability.emitFeedbackEvent('checkpoint.created', { checkpointId: checkpoint.id, executionId, stepId: step.id, stepName: step.name, mode: 'block' });
        const decision = await this.waitForApproval(checkpoint.id, step, reflection);
        return { ...decision, checkpointId: checkpoint.id, soloReflection: reflection };
      }
      case 'smart': {
        if (reflection && reflection.riskLevel === 'high') {
          const checkpoint = await this.createCheckpoint({ executionId, step, checkpointType: 'pre_execute', status: 'pending', approvalMode: 'smart', contextSnapshot: JSON.stringify(context) });
          this.observability.emitFeedbackEvent('checkpoint.created', { checkpointId: checkpoint.id, executionId, stepId: step.id, stepName: step.name, mode: 'smart', riskLevel: reflection.riskLevel });
          const decision = await this.waitForApproval(checkpoint.id, step, reflection);
          return { ...decision, checkpointId: checkpoint.id, soloReflection: reflection };
        }
        if (reflection && reflection.riskLevel === 'medium') {
          await this.createCheckpoint({ executionId, step, checkpointType: 'pre_execute', status: 'approved', approvalMode: 'smart', contextSnapshot: JSON.stringify(context) });
          return { action: 'proceed', notified: true, soloReflection: reflection };
        }
        return { action: 'proceed', soloReflection: reflection };
      }
      default: return { action: 'proceed' };
    }
  }

  async postExecuteCheck(params: { executionId: string; step: WorkflowStep; result: Record<string, unknown>; durationMs: number; stepExecutionId: string }): Promise<PostFeedbackAction> {
    await this.createCheckpoint({ executionId, step, checkpointType: 'post_execute', status: 'approved', approvalMode: 'auto', stepOutput: JSON.stringify(params.result) });
    if (params.durationMs > 60000) return { action: 'proceed', reason: `Step took ${(params.durationMs / 1000).toFixed(1)}s` };
    return { action: 'proceed' };
  }

  async handleApproval(params: { checkpointId: string; action: 'approved' | 'rejected' | 'modified' | 'skipped'; intervention?: string; rating?: number; feedback?: string }): Promise<void> {
    await this.prisma.feedbackCheckpoint.update({ where: { id: params.checkpointId }, data: { status: params.action, intervenedBy: 'user', intervention: params.intervention, rating: params.rating, feedback: params.feedback, resolvedAt: new Date() } });
    this.observability.emitFeedbackEvent('checkpoint.resolved', { checkpointId: params.checkpointId, action: params.action });
  }

  private async soloSelfReflect(params: { executionId: string; step: WorkflowStep; context: WorkflowContext }): Promise<SoloReflection> {
    const { step } = params;
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    let confidence = 0.8;
    if (step.type === 'invoke-agent' || step.type === 'ai-analyze') { riskLevel = 'medium'; confidence = 0.7; }
    if (step.config.feedbackMode === 'block') { riskLevel = 'high'; confidence = 0.6; }
    return { riskLevel, confidence, reasoning: `Step type "${step.type}" with mode "${step.config.feedbackMode ?? 'auto'}" assessed as ${riskLevel} risk` };
  }

  private async waitForApproval(checkpointId: string, step: WorkflowStep, reflection?: SoloReflection): Promise<FeedbackDecision> {
    const timeoutMs = Number(step.config.approvalTimeoutMs ?? 300000);
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      const checkpoint = await this.prisma.feedbackCheckpoint.findUnique({ where: { id: checkpointId } });
      if (!checkpoint) return { action: 'proceed', reason: 'Checkpoint not found' };
      switch (checkpoint.status) {
        case 'approved': return { action: 'proceed' };
        case 'rejected': return { action: 'block', reason: checkpoint.intervention ?? 'User rejected' };
        case 'modified': return { action: 'proceed', reason: `User modified: ${checkpoint.intervention}` };
        case 'skipped': return { action: 'skip', reason: 'User skipped' };
        case 'timeout_expired': return { action: 'proceed', reason: 'Approval timeout, auto-proceeded' };
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    await this.prisma.feedbackCheckpoint.update({ where: { id: checkpointId }, data: { status: 'timeout_expired', resolvedAt: new Date() } });
    return { action: 'proceed', reason: 'Approval timeout expired, auto-proceeded' };
  }

  private async createCheckpoint(params: { executionId: string; step: WorkflowStep; checkpointType: CheckpointType; status: string; approvalMode: string; contextSnapshot?: string; stepOutput?: string; intervention?: string; intervenedBy?: string }) {
    return this.prisma.feedbackCheckpoint.create({ data: { executionId: params.executionId, stepId: params.step.id, stepName: params.step.name, stepType: params.step.type, checkpointType: params.checkpointType, status: params.status, approvalMode: params.approvalMode, contextSnapshot: params.contextSnapshot, stepOutput: params.stepOutput, intervention: params.intervention, intervenedBy: params.intervenedBy } });
  }
}