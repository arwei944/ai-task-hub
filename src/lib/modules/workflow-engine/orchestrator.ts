import type { PrismaClient } from '@/generated/prisma/client';
import type { Logger } from '@/lib/core/logger';
import type { EventBus } from '@/lib/core/event-bus';
import type { TaskService } from '@/lib/modules/task-core/task.service';
import type { SOLOBridge } from './solo/solo-bridge';
import type { FeedbackModule } from './feedback/feedback-module';
import type { ConcurrencyController } from './concurrency';
import type { Observability } from './observability';
import type { WorkflowContextManager } from './context';
import { WorkflowContextManager as WCM } from './context';
import type { WorkflowExecutor } from './executor';
import type { WorkflowStep, ExecutionStatus, RetryPolicy } from './types';

/**
 * 工作流编排器
 * 管理工作流执行的生命周期：创建执行记录、调度执行、处理结果
 */
export class WorkflowOrchestrator {
  private runningExecutions = new Map<string, boolean>();
  private triggerDispatcher?: any;

  constructor(
    private prisma: PrismaClient,
    private executor: WorkflowExecutor,
    private concurrencyController: ConcurrencyController,
    private observability: Observability,
    private logger?: Logger,
  ) {}

  /**
   * 启动工作流执行
   */
  async startExecution(params: {
    workflowId: string;
    workflowName: string;
    steps: WorkflowStep[];
    variables?: Record<string, unknown>;
    triggerType?: string;
    triggeredBy?: string;
    retryPolicy?: RetryPolicy;
    timeoutMs?: number;
  }): Promise<{ executionId: string; status: string }> {
    const {
      workflowId,
      workflowName,
      steps,
      variables,
      triggerType,
      triggeredBy,
      timeoutMs,
    } = params;

    this.logger?.info(`Starting workflow execution: ${workflowName} (${workflowId})`);

    // 创建执行记录
    const execution = await this.prisma.workflowExecution.create({
      data: {
        workflowId,
        workflowSnapshot: JSON.stringify({
          id: workflowId,
          name: workflowName,
          steps,
          variables,
        }),
        status: 'running',
        triggerType: triggerType ?? 'manual',
        triggeredBy: triggeredBy ?? null,
        startedAt: new Date(),
        context: variables ? JSON.stringify(variables) : '{}',
      },
    });

    // 标记为运行中
    this.runningExecutions.set(execution.id, true);

    // Emit workflow.triggered event
    this.observability.emitWorkflowEvent('triggered', {
      workflowId,
      executionId: execution.id,
      triggerType: triggerType ?? 'manual',
      triggeredBy: triggeredBy ?? null,
    });

    // 后台异步执行
    this.runExecution(execution.id, steps, variables, timeoutMs).catch((err) => {
      this.logger?.error(`Workflow execution failed: ${execution.id}`, {
        error: String(err),
      });
    });

    return { executionId: execution.id, status: 'running' };
  }

  /**
   * 取消执行
   */
  async cancelExecution(executionId: string): Promise<{ success: boolean }> {
    const execution = await this.prisma.workflowExecution.findUnique({
      where: { id: executionId },
    });

    if (!execution) throw new Error(`Execution not found: ${executionId}`);
    if (execution.status !== 'running' && execution.status !== 'pending') {
      throw new Error(`Cannot cancel execution in status: ${execution.status}`);
    }

    this.runningExecutions.set(executionId, false);

    await this.prisma.workflowExecution.update({
      where: { id: executionId },
      data: { status: 'cancelled', completedAt: new Date() },
    });

    this.logger?.info(`Workflow execution cancelled: ${executionId}`);
    this.observability.emitWorkflowEvent('execution.cancelled', { executionId });

    return { success: true };
  }

  /**
   * 检查执行是否已取消
   */
  isCancelled(executionId: string): boolean {
    return this.runningExecutions.get(executionId) === false;
  }

  /**
   * 获取运行中的执行数量
   */
  getRunningCount(): number {
    let count = 0;
    for (const isRunning of this.runningExecutions.values()) {
      if (isRunning) count++;
    }
    return count;
  }

  setTriggerDispatcher(dispatcher: any): void {
    this.triggerDispatcher = dispatcher;
  }

  /**
   * 内部：运行执行
   */
  private async runExecution(
    executionId: string,
    steps: WorkflowStep[],
    variables?: Record<string, unknown>,
    timeoutMs?: number,
  ): Promise<void> {
    await this.concurrencyController.acquire();

    try {
      const contextManager = new WCM(variables);
      const isCancelled = () => !this.runningExecutions.get(executionId);

      // 设置超时
      let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
      if (timeoutMs) {
        timeoutHandle = setTimeout(async () => {
          this.runningExecutions.set(executionId, false);
          await this.prisma.workflowExecution.update({
            where: { id: executionId },
            data: {
              status: 'failed',
              error: `Workflow timed out after ${timeoutMs}ms`,
              completedAt: new Date(),
            },
          });
        }, timeoutMs);
      }

      const finalStatus = await this.executor.executeWorkflow({
        executionId,
        steps,
        contextManager,
        isCancelled,
      });

      if (timeoutHandle) clearTimeout(timeoutHandle);

      // 更新执行记录
      await this.prisma.workflowExecution.update({
        where: { id: executionId },
        data: {
          status: finalStatus,
          completedAt: new Date(),
          context: JSON.stringify(contextManager.getAll()),
        },
      });

      // 发射事件 (catalog-matched types) — enriched payload
      const executionRecord = await this.prisma.workflowExecution.findUnique({
        where: { id: executionId },
      });
      const workflowId = executionRecord?.workflowId ?? '';
      const startedAt = executionRecord?.startedAt ?? new Date();
      const duration = Date.now() - startedAt.getTime();

      const stepExecutions = await this.prisma.workflowStepExecution.findMany({
        where: { executionId },
      });
      const stepCount = stepExecutions.length;
      const errorCount = stepExecutions.filter(s => s.status === 'failed').length;
      const stepSummaries = stepExecutions.map(s => ({
        name: s.stepName,
        status: s.status,
        duration: s.durationMs ?? 0,
      }));

      this.observability.emitWorkflowEvent(
        finalStatus === 'completed' ? 'completed' : 'failed',
        {
          workflowId,
          executionId,
          status: finalStatus,
          duration,
          stepCount,
          errorCount,
          steps: stepSummaries,
        },
      );

      // Also emit the execution-scoped events for backward compatibility
      this.observability.emitWorkflowEvent(
        finalStatus === 'completed' ? 'execution.completed' : 'execution.failed',
        { executionId, status: finalStatus },
      );

      this.logger?.info(`Workflow execution ${finalStatus}: ${executionId}`);
    } finally {
      this.runningExecutions.delete(executionId);
      this.concurrencyController.release();
    }
  }
}
