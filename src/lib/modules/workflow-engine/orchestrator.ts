import type { PrismaClient } from '@/generated/prisma/client';
import type { Logger } from '@/lib/core/logger';
import type { EventBus } from '@/lib/core/event-bus';
import type { TaskService } from '@/lib/modules/task-core/task.service';
import type { SOLOBridge } from './solo/solo-bridge';
import type { FeedbackModule } from './feedback/feedback-module';
import type { ConcurrencyController } from './concurrency';
import type { Observability } from './observability';
import type { WorkflowContextManager } from './context';
import type { WorkflowExecutor } from './executor';
import type { WorkflowStep, ExecutionStatus, RetryPolicy } from './types';

export class WorkflowOrchestrator {
  private runningExecutions = new Map<string, boolean>();
  constructor(
    private prisma: PrismaClient, private executor: WorkflowExecutor,
    private concurrencyController: ConcurrencyController, private observability: Observability,
    private logger?: Logger,
  ) {}

  async startExecution(params: {
    workflowId: string; workflowName: string; steps: WorkflowStep[];
    variables?: Record<string, unknown>; triggerType?: string; triggeredBy?: string;
    retryPolicy?: RetryPolicy; timeoutMs?: number;
  }): Promise<{ executionId: string; status: string }> {
    const { workflowId, workflowName, steps, variables, triggerType, triggeredBy, timeoutMs } = params;
    this.logger?.info(`Starting workflow execution: ${workflowName} (${workflowId})`);
    const execution = await this.prisma.workflowExecution.create({
      data: { workflowId, workflowSnapshot: JSON.stringify({ id: workflowId, name: workflowName, steps, variables }),
        status: 'running', triggerType: triggerType ?? 'manual', triggeredBy: triggeredBy ?? null,
        startedAt: new Date(), context: variables ? JSON.stringify(variables) : '{}' },
    });
    this.runningExecutions.set(execution.id, true);
    this.runExecution(execution.id, steps, variables, timeoutMs).catch((err) => {
      this.logger?.error(`Workflow execution failed: ${execution.id}`, { error: String(err) });
    });
    return { executionId: execution.id, status: 'running' };
  }

  async cancelExecution(executionId: string): Promise<{ success: boolean }> {
    const execution = await this.prisma.workflowExecution.findUnique({ where: { id: executionId } });
    if (!execution) throw new Error(`Execution not found: ${executionId}`);
    if (execution.status !== 'running' && execution.status !== 'pending') throw new Error(`Cannot cancel execution in status: ${execution.status}`);
    this.runningExecutions.set(executionId, false);
    await this.prisma.workflowExecution.update({ where: { id: executionId }, data: { status: 'cancelled', completedAt: new Date() } });
    this.logger?.info(`Workflow execution cancelled: ${executionId}`);
    this.observability.emitWorkflowEvent('execution.cancelled', { executionId });
    return { success: true };
  }

  isCancelled(executionId: string): boolean { return this.runningExecutions.get(executionId) === false; }
  getRunningCount(): number { let count = 0; for (const isRunning of this.runningExecutions.values()) { if (isRunning) count++; } return count; }

  private async runExecution(executionId: string, steps: WorkflowStep[], variables?: Record<string, unknown>, timeoutMs?: number): Promise<void> {
    await this.concurrencyController.acquire();
    try {
      const contextManager = new WorkflowContextManager(variables);
      const isCancelled = () => !this.runningExecutions.get(executionId);
      let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
      if (timeoutMs) {
        timeoutHandle = setTimeout(async () => {
          this.runningExecutions.set(executionId, false);
          await this.prisma.workflowExecution.update({ where: { id: executionId }, data: { status: 'failed', error: `Workflow timed out after ${timeoutMs}ms`, completedAt: new Date() } });
        }, timeoutMs);
      }
      const finalStatus = await this.executor.executeWorkflow({ executionId, steps, contextManager, isCancelled });
      if (timeoutHandle) clearTimeout(timeoutHandle);
      await this.prisma.workflowExecution.update({ where: { id: executionId }, data: { status: finalStatus, completedAt: new Date(), context: JSON.stringify(contextManager.getAll()) } });
      this.observability.emitWorkflowEvent(finalStatus === 'completed' ? 'execution.completed' : 'execution.failed', { executionId, status: finalStatus });
      this.logger?.info(`Workflow execution ${finalStatus}: ${executionId}`);
    } finally {
      this.runningExecutions.delete(executionId);
      this.concurrencyController.release();
    }
  }
}