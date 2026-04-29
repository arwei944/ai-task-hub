import type { PrismaClient } from '@/generated/prisma/client';
import type { Logger } from '@/lib/core/logger';
import type { EventBus } from '@/lib/core/event-bus';
import type { TaskService } from '@/lib/modules/task-core/task.service';
import type { SOLOBridge } from './solo/solo-bridge';
import type { FeedbackModule } from './feedback/feedback-module';
import type { Observability } from './observability';
import type { WorkflowContextManager } from './context';
import type { WorkflowStep, StepResult, WorkflowContext, StepHandler, ExecutionStatus, StepExecutionStatus } from './types';
import { StepRegistry } from './steps';

export class WorkflowExecutor {
  constructor(
    private prisma: PrismaClient, private taskService: TaskService,
    private soloBridge: SOLOBridge, private feedbackModule: FeedbackModule,
    private observability: Observability, private logger?: Logger,
  ) {}

  async executeWorkflow(params: {
    executionId: string; steps: WorkflowStep[];
    contextManager: WorkflowContextManager; isCancelled: () => boolean;
  }): Promise<ExecutionStatus> {
    const { executionId, steps, contextManager, isCancelled } = params;
    for (const step of steps) {
      if (isCancelled()) { this.logger?.info(`Execution ${executionId} cancelled before step ${step.name}`); return 'cancelled'; }
      const result = await this.executeStep({ executionId, step, contextManager, isCancelled });
      if (result.status === 'failed' && step.onError !== 'continue') return 'failed';
    }
    return 'completed';
  }

  async executeStep(params: {
    executionId: string; step: WorkflowStep; contextManager: WorkflowContextManager;
    isCancelled: () => boolean; parentStepId?: string;
  }): Promise<{ status: StepExecutionStatus; result?: StepResult; error?: string }> {
    const { executionId, step, contextManager, isCancelled, parentStepId } = params;
    contextManager.setExecutionMeta({
      executionId, stepId: step.id, stepName: step.name, stepType: step.type,
      soloSessionId: contextManager.getSoloSessionId(), parentStepId,
    });
    const stepExec = await this.prisma.workflowStepExecution.create({
      data: { executionId, stepId: step.id, stepName: step.name, stepType: step.type,
        status: 'running', input: JSON.stringify({ config: step.config, context: contextManager.getAll() }),
        startedAt: new Date(), parentStepId: parentStepId ?? null },
    });
    await this.prisma.workflowExecution.update({ where: { id: executionId }, data: { currentStepId: step.id } });

    const preDecision = await this.feedbackModule.preExecuteCheck({ executionId, step, context: contextManager.getAll() });
    if (preDecision.action === 'block') { await this.completeStepExecution(stepExec.id, 'failed', undefined, preDecision.reason); return { status: 'failed', error: preDecision.reason }; }
    if (preDecision.action === 'skip') { await this.completeStepExecution(stepExec.id, 'skipped'); return { status: 'skipped' }; }

    const startTime = Date.now();
    try {
      const handler = StepRegistry.getHandler(step.type, { prisma: this.prisma, taskService: this.taskService, soloBridge: this.soloBridge, executor: this });
      if (!handler) throw new Error(`No handler registered for step type: ${step.type}`);
      const resolvedConfig = contextManager.resolveTemplateVars(step.config);
      const result = await handler.execute(resolvedConfig, contextManager.getAll());
      const durationMs = Date.now() - startTime;
      contextManager.merge(result);
      if (result._soloSessionId) contextManager.setSoloSessionId(result._soloSessionId as string);
      await this.feedbackModule.postExecuteCheck({ executionId, step, result, durationMs, stepExecutionId: stepExec.id });
      await this.completeStepExecution(stepExec.id, 'completed', result, undefined, durationMs);
      this.observability.recordStepMetrics({ executionId, stepId: step.id, stepName: step.name, stepType: step.type, durationMs, status: 'completed' });
      this.observability.emitWorkflowEvent('step.completed', { executionId, stepId: step.id, stepName: step.name, durationMs });
      return { status: 'completed', result };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger?.warn(`Step ${step.name} failed: ${errorMsg}`);
      await this.completeStepExecution(stepExec.id, 'failed', undefined, errorMsg, durationMs);
      this.observability.recordStepMetrics({ executionId, stepId: step.id, stepName: step.name, stepType: step.type, durationMs, status: 'failed', error: errorMsg });
      this.observability.emitWorkflowEvent('step.failed', { executionId, stepId: step.id, stepName: step.name, error: errorMsg });
      return { status: 'failed', error: errorMsg };
    }
  }

  private async completeStepExecution(stepExecId: string, status: StepExecutionStatus, output?: StepResult, error?: string, durationMs?: number): Promise<void> {
    await this.prisma.workflowStepExecution.update({ where: { id: stepExecId }, data: { status, output: output ? JSON.stringify(output) : undefined, error, completedAt: new Date(), durationMs } });
  }
}