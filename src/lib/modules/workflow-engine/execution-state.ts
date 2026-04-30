// ============================================================
// AI Task Hub - Workflow Execution State Persistence (v3)
// ============================================================
// Provides checkpoint/resume capability for workflow executions.

import { getPrisma } from '@/lib/db';
import type { ILogger } from '@/lib/core/types';

export interface ExecutionCheckpoint {
  id: string;
  executionId: string;
  stepIndex: number;          // Next step to execute
  contextSnapshot: string;    // JSON-serialized context
  status: 'running' | 'paused' | 'resumed' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

export class ExecutionStateManager {
  constructor(
    private logger: ILogger,
    private prismaFn: () => ReturnType<typeof getPrisma> = getPrisma,
  ) {}

  /**
   * Save a checkpoint for the current execution state
   */
  async saveCheckpoint(params: {
    executionId: string;
    stepIndex: number;
    context: Record<string, unknown>;
  }): Promise<void> {
    const prisma = this.prismaFn();
    try {
      const { executionId, stepIndex, context } = params;

      // Use the execution's context field to store checkpoint data
      await prisma.workflowExecution.update({
        where: { id: executionId },
        data: {
          context: JSON.stringify({
            ...context,
            _checkpoint: {
              stepIndex,
              savedAt: new Date().toISOString(),
            },
          }),
        },
      });

      this.logger.debug(`Checkpoint saved for execution ${executionId} at step ${stepIndex}`);
    } finally {
      await prisma.$disconnect();
    }
  }

  /**
   * Load the last checkpoint for an execution
   */
  async loadCheckpoint(executionId: string): Promise<{
    stepIndex: number;
    context: Record<string, unknown>;
    savedAt: string;
  } | null> {
    const prisma = this.prismaFn();
    try {
      const execution = await prisma.workflowExecution.findUnique({
        where: { id: executionId },
      });

      if (!execution || !execution.context) return null;

      const context = typeof execution.context === 'string'
        ? JSON.parse(execution.context)
        : execution.context;

      const checkpoint = context._checkpoint;
      if (!checkpoint) return null;

      // Remove checkpoint metadata from context
      const { _checkpoint, ...cleanContext } = context;

      return {
        stepIndex: checkpoint.stepIndex,
        context: cleanContext,
        savedAt: checkpoint.savedAt,
      };
    } finally {
      await prisma.$disconnect();
    }
  }

  /**
   * Get all paused executions that can be resumed
   */
  async getPausedExecutions(): Promise<Array<{
    id: string;
    workflowId: string;
    workflowName: string;
    stepIndex: number;
    savedAt: string;
  }>> {
    const prisma = this.prismaFn();
    try {
      const executions = await prisma.workflowExecution.findMany({
        where: { status: 'paused' },
        orderBy: { updatedAt: 'desc' },
        include: { workflow: { select: { name: true } } },
      });

      const results: Array<{
        id: string;
        workflowId: string;
        workflowName: string;
        stepIndex: number;
        savedAt: string;
      }> = [];

      for (const exec of executions) {
        if (!exec.context) continue;
        const context = typeof exec.context === 'string' ? JSON.parse(exec.context) : exec.context;
        if (context._checkpoint) {
          results.push({
            id: exec.id,
            workflowId: exec.workflowId,
            workflowName: exec.workflow.name,
            stepIndex: context._checkpoint.stepIndex,
            savedAt: context._checkpoint.savedAt,
          });
        }
      }

      return results;
    } finally {
      await prisma.$disconnect();
    }
  }

  /**
   * Pause an execution (save checkpoint and mark as paused)
   */
  async pauseExecution(executionId: string, stepIndex: number, context: Record<string, unknown>): Promise<boolean> {
    const prisma = this.prismaFn();
    try {
      await prisma.workflowExecution.update({
        where: { id: executionId },
        data: {
          status: 'paused',
          context: JSON.stringify({
            ...context,
            _checkpoint: {
              stepIndex,
              savedAt: new Date().toISOString(),
            },
          }),
        },
      });

      this.logger.info(`Execution ${executionId} paused at step ${stepIndex}`);
      return true;
    } catch (error: any) {
      if (error.code === 'P2025') return false;
      throw error;
    } finally {
      await prisma.$disconnect();
    }
  }

  /**
   * Resume a paused execution
   */
  async resumeExecution(executionId: string): Promise<{
    stepIndex: number;
    context: Record<string, unknown>;
  } | null> {
    const prisma = this.prismaFn();
    try {
      // Mark as running
      await prisma.workflowExecution.update({
        where: { id: executionId },
        data: {
          status: 'running',
          startedAt: new Date(),
        },
      });

      // Load checkpoint
      const checkpoint = await this.loadCheckpoint(executionId);
      if (!checkpoint) return null;

      this.logger.info(`Execution ${executionId} resumed from step ${checkpoint.stepIndex}`);
      return checkpoint;
    } catch (error: any) {
      if (error.code === 'P2025') return null;
      throw error;
    } finally {
      await prisma.$disconnect();
    }
  }
}
