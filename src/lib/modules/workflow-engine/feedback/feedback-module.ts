import type { PrismaClient } from '@/generated/prisma/client';
import type { Logger } from '@/lib/core/logger';
import type { EventBus } from '@/lib/core/event-bus';
import type { Observability } from '../observability';
import type { SOLOBridge } from '../solo/solo-bridge';
import type { WorkflowStep, WorkflowContext, FeedbackDecision, PostFeedbackAction, SoloReflection, FeedbackMode, CheckpointType } from '../types';
import { FeedbackRuleEngine } from './rule-engine';
import { getSSEService } from '@/lib/modules/realtime/sse.service';

export class FeedbackModule {
  private ruleEngine: FeedbackRuleEngine;
  constructor(private prisma: PrismaClient, private soloBridge: SOLOBridge, private observability: Observability, private eventBus?: EventBus, private logger?: Logger) { this.ruleEngine = new FeedbackRuleEngine(prisma); }

  async preExecuteCheck(params: { executionId: string; step: WorkflowStep; context: WorkflowContext; }): Promise<FeedbackDecision> {
    const { executionId, step, context } = params;
    const mode: FeedbackMode = (step.config.feedbackMode as FeedbackMode) ?? 'auto';
    const ruleResult = await this.ruleEngine.evaluate({ step, context, executionId });
    if (ruleResult.action === 'block') { const checkpoint = await this.createCheckpoint({ executionId, step, checkpointType: 'pre_execute', status: 'rejected', approvalMode: 'auto', intervention: `Auto rule block: ${ruleResult.reason}`, intervenedBy: 'auto_rule' }); return { action: 'block', reason: ruleResult.reason, checkpointId: checkpoint.id }; }
    if (ruleResult.action === 'skip') return { action: 'skip', reason: ruleResult.reason };
    let reflection: SoloReflection | undefined;
    if (mode !== 'auto') reflection = await this.soloSelfReflect(params);
    switch (mode) {
      case 'auto': return { action: 'proceed' };
      case 'notify': { const checkpoint = await this.createCheckpoint({ executionId, step, checkpointType: 'pre_execute', status: 'approved', approvalMode: 'notify', contextSnapshot: JSON.stringify(context) }); this.observability.emitFeedbackEvent('checkpoint.created', { checkpointId: checkpoint.id, executionId, stepId: step.id, stepName: step.name, mode: 'notify' }); return { action: 'proceed', notified: true, checkpointId: checkpoint.id, soloReflection: reflection }; }
      case 'block': { const checkpoint = await this.createCheckpoint({ executionId, step, checkpointType: 'pre_execute', status: 'pending', approvalMode: 'block', contextSnapshot: JSON.stringify(context) }); this.observability.emitFeedbackEvent('checkpoint.created', { checkpointId: checkpoint.id, executionId, stepId: step.id, stepName: step.name, mode: 'block' }); const decision = await this.waitForApproval(checkpoint.id, step, reflection); return { ...decision, checkpointId: checkpoint.id, soloReflection: reflection }; }
      case 'smart': { if (reflection && reflection.riskLevel === 'high') { const checkpoint = await this.createCheckpoint({ executionId, step, checkpointType: 'pre_execute', status: 'pending', approvalMode: 'smart', contextSnapshot: JSON.stringify(context) }); this.observability.emitFeedbackEvent('checkpoint.created', { checkpointId: checkpoint.id, executionId, stepId: step.id, stepName: step.name, mode: 'smart', riskLevel: reflection.riskLevel }); const decision = await this.waitForApproval(checkpoint.id, step, reflection); return { ...decision, checkpointId: checkpoint.id, soloReflection: reflection }; } if (reflection && reflection.riskLevel === 'medium') { await this.createCheckpoint({ executionId, step, checkpointType: 'pre_execute', status: 'approved', approvalMode: 'smart', contextSnapshot: JSON.stringify(context) }); return { action: 'proceed', notified: true, soloReflection: reflection }; } return { action: 'proceed', soloReflection: reflection }; }
      default: return { action: 'proceed' };
    }
  }

  async postExecuteCheck(params: { executionId: string; step: WorkflowStep; result: Record<string, unknown>; durationMs: number; stepExecutionId: string; }): Promise<PostFeedbackAction> {
    const { executionId, step, result, durationMs } = params;
    const tokensUsed = result._tokensUsed !== undefined ? Number(result._tokensUsed) : undefined;
    const ruleResult = await this.ruleEngine.evaluatePostExecute({ step, context: {}, executionId, durationMs, tokensUsed });
    if (ruleResult.action === 'block') { const checkpoint = await this.createCheckpoint({ executionId, step, checkpointType: 'post_execute', status: 'pending', approvalMode: 'auto', stepOutput: JSON.stringify(result), intervention: ruleResult.reason, intervenedBy: 'auto_rule' }); return { action: 'block', reason: ruleResult.reason, suggestions: ['Rule engine blocked, awaiting approval'] }; }
    if (ruleResult.action === 'notify') { const checkpoint = await this.createCheckpoint({ executionId, step, checkpointType: 'post_execute', status: 'approved', approvalMode: 'auto', stepOutput: JSON.stringify(result), intervention: ruleResult.reason, intervenedBy: 'auto_rule' }); try { getSSEService().broadcast('feedback', { type: 'checkpoint.created', data: { checkpointId: checkpoint.id, executionId, stepId: step.id, stepName: step.name, checkpointType: 'post_execute', reason: ruleResult.reason } }); } catch {} return { action: 'proceed', reason: ruleResult.reason }; }
    await this.createCheckpoint({ executionId, step, checkpointType: 'post_execute', status: 'approved', approvalMode: 'auto', stepOutput: JSON.stringify(result) });
    if (ruleResult.action === 'skip') return { action: 'proceed', reason: ruleResult.reason };
    return { action: 'proceed' };
  }

  async handleApproval(params: { checkpointId: string; action: 'approved' | 'rejected' | 'modified' | 'skipped'; intervention?: string; rating?: number; feedback?: string; }): Promise<void> {
    await this.prisma.feedbackCheckpoint.update({ where: { id: params.checkpointId }, data: { status: params.action, intervenedBy: 'user', intervention: params.intervention, rating: params.rating, feedback: params.feedback, resolvedAt: new Date() } });
    this.observability.emitFeedbackEvent('checkpoint.resolved', { checkpointId: params.checkpointId, action: params.action });
  }

  private async soloSelfReflect(params: { executionId: string; step: WorkflowStep; context: WorkflowContext; }): Promise<SoloReflection> {
    const { step, context, executionId } = params;
    const reflectionPrompt = [`You are performing a risk assessment for a workflow step.`, `Step ID: ${step.id}`, `Step Name: ${step.name}`, `Step Type: ${step.type}`, `Feedback Mode: ${step.config.feedbackMode ?? 'auto'}`, `Context keys: ${Object.keys(context).join(', ')}`, ``, `Please assess the risk level.`, `Respond in JSON:`, `- riskLevel: "low", "medium", or "high"`, `- confidence: 0-1`, `- reasoning: brief explanation`].join('\n');
    try { const soloResult = await this.soloBridge.call({ prompt: reflectionPrompt, stepId: step.id, executionId, stepName: step.name, callMode: step.soloCallMode, subAgentType: step.soloSubAgent ?? 'explore', context: { ...context, _reflection: true }, timeoutMs: 30000 }); if (soloResult.success && soloResult.data) { const data = typeof soloResult.data === 'string' ? JSON.parse(soloResult.data) : soloResult.data; const riskLevel = ['low', 'medium', 'high'].includes(data.riskLevel) ? data.riskLevel as 'low' | 'medium' | 'high' : 'low'; const confidence = typeof data.confidence === 'number' ? Math.min(1, Math.max(0, data.confidence)) : 0.5; const reasoning = typeof data.reasoning === 'string' ? data.reasoning : 'SOLO reflection completed'; return { riskLevel, confidence, reasoning }; } } catch (error) { this.logger?.warn('SOLO Bridge reflection failed, using fallback', { error: error instanceof Error ? error.message : String(error) }); }
    let riskLevel: 'low' | 'medium' | 'high' = 'low'; let confidence = 0.8;
    if (step.type === 'invoke-agent' || step.type === 'ai-analyze') { riskLevel = 'medium'; confidence = 0.7; }
    if (step.config.feedbackMode === 'block') { riskLevel = 'high'; confidence = 0.6; }
    return { riskLevel, confidence, reasoning: `Step "${step.type}" mode "${step.config.feedbackMode ?? 'auto'}" assessed as ${riskLevel} risk (fallback)` };
  }

  private async waitForApproval(checkpointId: string, step: WorkflowStep): Promise<FeedbackDecision> {
    const timeoutMs = Number(step.config.approvalTimeoutMs ?? 300000); const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) { const checkpoint = await this.prisma.feedbackCheckpoint.findUnique({ where: { id: checkpointId } }); if (!checkpoint) return { action: 'proceed', reason: 'Checkpoint not found' }; switch (checkpoint.status) { case 'approved': return { action: 'proceed' }; case 'rejected': return { action: 'block', reason: checkpoint.intervention ?? 'User rejected' }; case 'modified': return { action: 'proceed', reason: `User modified: ${checkpoint.intervention}` }; case 'skipped': return { action: 'skip', reason: 'User skipped' }; case 'timeout_expired': return { action: 'proceed', reason: 'Approval timeout, auto-proceeded' }; } await new Promise(r => setTimeout(r, 2000)); }
    await this.prisma.feedbackCheckpoint.update({ where: { id: checkpointId }, data: { status: 'timeout_expired', resolvedAt: new Date() } });
    return { action: 'proceed', reason: 'Approval timeout expired' };
  }

  private async createCheckpoint(params: { executionId: string; step: WorkflowStep; checkpointType: CheckpointType; status: string; approvalMode: string; contextSnapshot?: string; stepOutput?: string; intervention?: string; intervenedBy?: string; }) {
    const checkpoint = await this.prisma.feedbackCheckpoint.create({ data: { executionId: params.executionId, stepId: params.step.id, stepName: params.step.name, stepType: params.step.type, checkpointType: params.checkpointType, status: params.status, approvalMode: params.approvalMode, contextSnapshot: params.contextSnapshot, stepOutput: params.stepOutput, intervention: params.intervention, intervenedBy: params.intervenedBy } });
    try { const sseService = getSSEService(); const eventType = params.checkpointType === 'pre_execute' ? 'checkpoint.created' : 'checkpoint.completed'; sseService.broadcast('feedback', { type: eventType, data: { checkpointId: checkpoint.id, executionId: params.executionId, stepId: params.step.id, stepName: params.step.name, stepType: params.step.type, checkpointType: params.checkpointType, status: params.status, approvalMode: params.approvalMode, intervention: params.intervention } }); } catch {}
    return checkpoint;
  }
}