import type { PrismaClient } from '@/generated/prisma/client';
import type { Logger } from '@/lib/core/logger';
import type { EventBus } from '@/lib/core/event-bus';
import type { TaskService } from '@/lib/modules/task-core/task.service';
import type { SOLOBridge } from './solo/solo-bridge';
import type { FeedbackModule } from './feedback/feedback-module';
import type { Observability } from './observability';
import type { WorkflowContextManager } from './context';
import type {
  WorkflowStep,
  StepResult,
  WorkflowContext,
  StepHandler,
  ExecutionStatus,
  StepExecutionStatus,
} from './types';
import { StepRegistry } from './steps';

/**
 * 工作流执行器
 * 负责执行单个工作流的所有步骤
 */
export class WorkflowExecutor {
  constructor(
    private prisma: PrismaClient,
    private taskService: TaskService,
    private soloBridge: SOLOBridge,
    private feedbackModule: FeedbackModule,
    private observability: Observability,
    private logger?: Logger,
  ) {}

  /**
   * 执行工作流的所有步骤
   */
  async executeWorkflow(params: {
    executionId: string;
    steps: WorkflowStep[];
    contextManager: WorkflowContextManager;
    isCancelled: () => boolean;
  }): Promise<ExecutionStatus> {
    const { executionId, steps, contextManager, isCancelled } = params;

    for (const step of steps) {
      // 检查是否已取消
      if (isCancelled()) {
        this.logger?.info(`Execution ${executionId} cancelled before step ${step.name}`);
        return 'cancelled';
      }

      const result = await this.executeStep({
        executionId,
        step,
        contextManager,
        isCancelled,
      });

      if (result.status === 'failed' && step.onError !== 'continue') {
        return 'failed';
      }
    }

    return 'completed';
  }

  /**
   * 执行单个步骤（含反馈检查点）
   */
  async executeStep(params: {
    executionId: string;
    step: WorkflowStep;
    contextManager: WorkflowContextManager;
    isCancelled: () => boolean;
    parentStepId?: string;
  }): Promise<{ status: StepExecutionStatus; result?: StepResult; error?: string }> {
    const { executionId, step, contextManager, isCancelled, parentStepId } = params;

    // 设置步骤元数据到上下文
    contextManager.setExecutionMeta({
      executionId,
      stepId: step.id,
      stepName: step.name,
      stepType: step.type,
      soloSessionId: contextManager.getSoloSessionId(),
      parentStepId,
    });

    // 创建步骤执行记录
    const stepExec = await this.prisma.workflowStepExecution.create({
      data: {
        executionId,
        stepId: step.id,
        stepName: step.name,
        stepType: step.type,
        status: 'running',
        input: JSON.stringify({ config: step.config, context: contextManager.getAll() }),
        startedAt: new Date(),
        parentStepId: parentStepId ?? null,
      },
    });

    // 更新执行记录的当前步骤
    await this.prisma.workflowExecution.update({
      where: { id: executionId },
      data: { currentStepId: step.id },
    });

    // ===== 前置反馈检查 =====
    const preDecision = await this.feedbackModule.preExecuteCheck({
      executionId,
      step,
      context: contextManager.getAll(),
    });

    if (preDecision.action === 'block') {
      await this.completeStepExecution(stepExec.id, 'failed', undefined, preDecision.reason);
      return { status: 'failed', error: preDecision.reason };
    }

    if (preDecision.action === 'skip') {
      await this.completeStepExecution(stepExec.id, 'skipped');
      return { status: 'skipped' };
    }

    // ===== 执行步骤 =====
    const startTime = Date.now();
    try {
      const handler = StepRegistry.getHandler(step.type, {
        prisma: this.prisma,
        taskService: this.taskService,
        soloBridge: this.soloBridge,
        executor: this,
      });

      if (!handler) {
        throw new Error(`No handler registered for step type: ${step.type}`);
      }

      const resolvedConfig = contextManager.resolveTemplateVars(step.config);
      const result = await handler.execute(resolvedConfig, contextManager.getAll());
      const durationMs = Date.now() - startTime;

      // 合并结果到上下文
      contextManager.merge(result);

      // 更新 SOLO 会话 ID（如果步骤返回了新的）
      if (result._soloSessionId) {
        contextManager.setSoloSessionId(result._soloSessionId as string);
      }

      // ===== 后置反馈检查 =====
      const postAction = await this.feedbackModule.postExecuteCheck({
        executionId,
        step,
        result,
        durationMs,
        stepExecutionId: stepExec.id,
      });

      await this.completeStepExecution(stepExec.id, 'completed', result, undefined, durationMs);

      // 记录指标
      this.observability.recordStepMetrics({
        executionId,
        stepId: step.id,
        stepName: step.name,
        stepType: step.type,
        durationMs,
        status: 'completed',
      });

      // 发射事件
      this.observability.emitWorkflowEvent('step.completed', {
        executionId,
        stepId: step.id,
        stepName: step.name,
        durationMs,
      });

      return { status: 'completed', result };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);

      // 重试逻辑
      const retryPolicy = step.config.retryPolicy as { max?: number; backoff?: string; delayMs?: number } | undefined;
      const maxRetries = retryPolicy?.max ?? 0;
      const currentRetry = (stepExec.retryCount ?? 0);

      if (maxRetries > 0 && currentRetry < maxRetries) {
        const backoff = retryPolicy?.backoff ?? 'exponential';
        const baseDelay = retryPolicy?.delayMs ?? 1000;
        let delay = baseDelay;

        if (backoff === 'exponential') {
          delay = baseDelay * Math.pow(2, currentRetry);
        } else if (backoff === 'linear') {
          delay = baseDelay * (currentRetry + 1);
        }

        this.logger?.info(`Retrying step ${step.name} (attempt ${currentRetry + 2}/${maxRetries + 1}) after ${delay}ms`);

        await new Promise(resolve => setTimeout(resolve, delay));

        // 更新重试计数
        await this.prisma.workflowStepExecution.update({
          where: { id: stepExec.id },
          data: { retryCount: currentRetry + 1 },
        });

        // 递归重试
        return this.executeStep({ executionId, step, contextManager, isCancelled, parentStepId });
      }

      this.logger?.warn(`Step ${step.name} failed: ${errorMsg}`);

      await this.completeStepExecution(stepExec.id, 'failed', undefined, errorMsg, durationMs);

      // 记录指标
      this.observability.recordStepMetrics({
        executionId,
        stepId: step.id,
        stepName: step.name,
        stepType: step.type,
        durationMs,
        status: 'failed',
        error: errorMsg,
      });

      // 发射事件
      this.observability.emitWorkflowEvent('step.failed', {
        executionId,
        stepId: step.id,
        stepName: step.name,
        error: errorMsg,
      });

      return { status: 'failed', error: errorMsg };
    }
  }

  private async completeStepExecution(
    stepExecId: string,
    status: StepExecutionStatus,
    output?: StepResult,
    error?: string,
    durationMs?: number,
  ): Promise<void> {
    await this.prisma.workflowStepExecution.update({
      where: { id: stepExecId },
      data: {
        status,
        output: output ? JSON.stringify(output) : undefined,
        error,
        completedAt: new Date(),
        durationMs,
      },
    });
  }
}