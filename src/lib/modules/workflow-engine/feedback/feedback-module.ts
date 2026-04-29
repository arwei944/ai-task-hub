import type { PrismaClient } from '@/generated/prisma/client';
import type { Logger } from '@/lib/core/logger';
import type { EventBus } from '@/lib/core/event-bus';
import type { Observability } from '../observability';
import type { SOLOBridge } from '../solo/solo-bridge';
import type {
  WorkflowStep,
  WorkflowContext,
  FeedbackDecision,
  PostFeedbackAction,
  SoloReflection,
  FeedbackMode,
  CheckpointType,
} from '../types';
import { FeedbackRuleEngine } from './rule-engine';

/**
 * 反馈模块
 * 在工作流执行过程中嵌入检查点，支持 4 种干预模式
 */
export class FeedbackModule {
  private ruleEngine: FeedbackRuleEngine;

  constructor(
    private prisma: PrismaClient,
    private soloBridge: SOLOBridge,
    private observability: Observability,
    private eventBus?: EventBus,
    private logger?: Logger,
  ) {
    this.ruleEngine = new FeedbackRuleEngine(prisma);
  }

  /**
   * 步骤执行前检查
   * 根据反馈模式决定是否需要人工干预
   */
  async preExecuteCheck(params: {
    executionId: string;
    step: WorkflowStep;
    context: WorkflowContext;
  }): Promise<FeedbackDecision> {
    const { executionId, step, context } = params;
    const mode: FeedbackMode = (step.config.feedbackMode as FeedbackMode) ?? 'auto';

    // 1. 检查自动规则
    const ruleResult = await this.ruleEngine.evaluate({
      step,
      context,
      executionId,
    });

    if (ruleResult.action === 'block') {
      // 创建检查点记录
      const checkpoint = await this.createCheckpoint({
        executionId,
        step,
        checkpointType: 'pre_execute',
        status: 'rejected',
        approvalMode: 'auto',
        intervention: `自动规则阻断: ${ruleResult.reason}`,
        intervenedBy: 'auto_rule',
      });

      return { action: 'block', reason: ruleResult.reason, checkpointId: checkpoint.id };
    }

    if (ruleResult.action === 'skip') {
      return { action: 'skip', reason: ruleResult.reason };
    }

    // 2. SOLO 自省（仅 notify/block/smart 模式）
    let reflection: SoloReflection | undefined;
    if (mode !== 'auto') {
      reflection = await this.soloSelfReflect(params);
    }

    // 3. 根据模式决策
    switch (mode) {
      case 'auto':
        return { action: 'proceed' };

      case 'notify': {
        // 创建通知检查点，不阻塞执行
        const checkpoint = await this.createCheckpoint({
          executionId,
          step,
          checkpointType: 'pre_execute',
          status: 'approved',
          approvalMode: 'notify',
          contextSnapshot: JSON.stringify(context),
        });

        this.observability.emitFeedbackEvent('checkpoint.created', {
          checkpointId: checkpoint.id,
          executionId,
          stepId: step.id,
          stepName: step.name,
          mode: 'notify',
        });

        return { action: 'proceed', notified: true, checkpointId: checkpoint.id, soloReflection: reflection };
      }

      case 'block': {
        // 创建阻塞检查点，等待人工审批
        const checkpoint = await this.createCheckpoint({
          executionId,
          step,
          checkpointType: 'pre_execute',
          status: 'pending',
          approvalMode: 'block',
          contextSnapshot: JSON.stringify(context),
        });

        this.observability.emitFeedbackEvent('checkpoint.created', {
          checkpointId: checkpoint.id,
          executionId,
          stepId: step.id,
          stepName: step.name,
          mode: 'block',
        });

        // 等待审批（Phase A: 简单轮询，Phase B: SSE 推送）
        const decision = await this.waitForApproval(checkpoint.id, step, reflection);

        return { ...decision, checkpointId: checkpoint.id, soloReflection: reflection };
      }

      case 'smart': {
        // 智能模式：根据 SOLO 自省结果决定
        if (reflection && reflection.riskLevel === 'high') {
          const checkpoint = await this.createCheckpoint({
            executionId,
            step,
            checkpointType: 'pre_execute',
            status: 'pending',
            approvalMode: 'smart',
            contextSnapshot: JSON.stringify(context),
          });

          this.observability.emitFeedbackEvent('checkpoint.created', {
            checkpointId: checkpoint.id,
            executionId,
            stepId: step.id,
            stepName: step.name,
            mode: 'smart',
            riskLevel: reflection.riskLevel,
          });

          const decision = await this.waitForApproval(checkpoint.id, step, reflection);
          return { ...decision, checkpointId: checkpoint.id, soloReflection: reflection };
        }

        // 低风险：通知但不阻塞
        if (reflection && reflection.riskLevel === 'medium') {
          await this.createCheckpoint({
            executionId,
            step,
            checkpointType: 'pre_execute',
            status: 'approved',
            approvalMode: 'smart',
            contextSnapshot: JSON.stringify(context),
          });
          return { action: 'proceed', notified: true, soloReflection: reflection };
        }

        return { action: 'proceed', soloReflection: reflection };
      }

      default:
        return { action: 'proceed' };
    }
  }

  /**
   * 步骤执行后检查
   */
  async postExecuteCheck(params: {
    executionId: string;
    step: WorkflowStep;
    result: Record<string, unknown>;
    durationMs: number;
    stepExecutionId: string;
  }): Promise<PostFeedbackAction> {
    const { executionId, step, result, durationMs, stepExecutionId } = params;

    // 创建后置检查点
    await this.createCheckpoint({
      executionId,
      step,
      checkpointType: 'post_execute',
      status: 'approved',
      approvalMode: 'auto',
      stepOutput: JSON.stringify(result),
    });

    // 简单质量评估
    if (durationMs > 60000) {
      return {
        action: 'proceed',
        reason: `步骤执行时间较长: ${(durationMs / 1000).toFixed(1)}s`,
      };
    }

    return { action: 'proceed' };
  }

  /**
   * 处理用户审批
   */
  async handleApproval(params: {
    checkpointId: string;
    action: 'approved' | 'rejected' | 'modified' | 'skipped';
    intervention?: string;
    rating?: number;
    feedback?: string;
  }): Promise<void> {
    const { checkpointId, action, intervention, rating, feedback } = params;

    await this.prisma.feedbackCheckpoint.update({
      where: { id: checkpointId },
      data: {
        status: action,
        intervenedBy: 'user',
        intervention,
        rating,
        feedback,
        resolvedAt: new Date(),
      },
    });

    this.observability.emitFeedbackEvent('checkpoint.resolved', {
      checkpointId,
      action,
    });
  }

  /**
   * SOLO 自省
   * 让 SOLO 评估当前步骤的风险
   */
  private async soloSelfReflect(params: {
    executionId: string;
    step: WorkflowStep;
    context: WorkflowContext;
  }): Promise<SoloReflection> {
    // Phase A: 简单自省逻辑
    // Phase B: 通过 SOLO Bridge 调用 SOLO 进行深度自省

    const { step, context } = params;

    // 基于步骤类型和上下文的简单风险评估
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    let confidence = 0.8;

    if (step.type === 'invoke-agent' || step.type === 'ai-analyze') {
      riskLevel = 'medium';
      confidence = 0.7;
    }

    if (step.config.feedbackMode === 'block') {
      riskLevel = 'high';
      confidence = 0.6;
    }

    return {
      riskLevel,
      confidence,
      reasoning: `Step type "${step.type}" with mode "${step.config.feedbackMode ?? 'auto'}" assessed as ${riskLevel} risk`,
    };
  }

  /**
   * 等待人工审批
   * Phase A: 轮询数据库，超时自动批准
   * Phase B: SSE 实时推送 + 长轮询
   */
  private async waitForApproval(
    checkpointId: string,
    step: WorkflowStep,
    reflection?: SoloReflection,
  ): Promise<FeedbackDecision> {
    const timeoutMs = Number(step.config.approvalTimeoutMs ?? 300000); // 默认 5 分钟
    const startTime = Date.now();
    const pollInterval = 2000; // 2 秒轮询

    while (Date.now() - startTime < timeoutMs) {
      const checkpoint = await this.prisma.feedbackCheckpoint.findUnique({
        where: { id: checkpointId },
      });

      if (!checkpoint) {
        return { action: 'proceed', reason: 'Checkpoint not found' };
      }

      switch (checkpoint.status) {
        case 'approved':
          return { action: 'proceed' };
        case 'rejected':
          return { action: 'block', reason: checkpoint.intervention ?? 'User rejected' };
        case 'modified':
          return {
            action: 'proceed',
            reason: `User modified: ${checkpoint.intervention}`,
          };
        case 'skipped':
          return { action: 'skip', reason: 'User skipped' };
        case 'timeout_expired':
          return { action: 'proceed', reason: 'Approval timeout, auto-proceeded' };
      }

      // 等待后轮询
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    // 超时：自动批准
    await this.prisma.feedbackCheckpoint.update({
      where: { id: checkpointId },
      data: {
        status: 'timeout_expired',
        resolvedAt: new Date(),
      },
    });

    return { action: 'proceed', reason: 'Approval timeout expired, auto-proceeded' };
  }

  /**
   * 创建检查点记录
   */
  private async createCheckpoint(params: {
    executionId: string;
    step: WorkflowStep;
    checkpointType: CheckpointType;
    status: string;
    approvalMode: string;
    contextSnapshot?: string;
    stepOutput?: string;
    intervention?: string;
    intervenedBy?: string;
  }) {
    return this.prisma.feedbackCheckpoint.create({
      data: {
        executionId: params.executionId,
        stepId: params.step.id,
        stepName: params.step.name,
        stepType: params.step.type,
        checkpointType: params.checkpointType,
        status: params.status,
        approvalMode: params.approvalMode,
        contextSnapshot: params.contextSnapshot,
        stepOutput: params.stepOutput,
        intervention: params.intervention,
        intervenedBy: params.intervenedBy,
      },
    });
  }
}
