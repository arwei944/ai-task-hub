import type { DomainEvent } from '@/lib/core/types';
import { BaseAIHandler } from './base.handler';

interface TaskStatusPayload {
  id?: string;
  taskId?: string;
  status?: string;
  previousStatus?: string;
  projectId?: string;
  [key: string]: unknown;
}

export class TaskStatusHandler extends BaseAIHandler {
  get eventType(): string {
    return 'task.status.changed';
  }

  async handle(event: DomainEvent): Promise<void> {
    const payload = event.payload as TaskStatusPayload;

    const newStatus = payload.status ?? '';
    const previousStatus = payload.previousStatus ?? '';

    this.logger.info(
      `[AI] Task status changed: "${previousStatus}" -> "${newStatus}"`,
    );

    // Only emit health update when task is completed
    if (newStatus === 'done' || newStatus === 'completed') {
      await this.emitProjectHealth(payload);
    }
  }

  private async emitProjectHealth(payload: TaskStatusPayload): Promise<void> {
    const projectId = payload.projectId ?? payload.id;

    // Calculate a simple health score based on completed tasks
    // Since we don't have direct DB access here, we emit a synthetic health event
    // with the task completion info. The actual project health calculation
    // would be done by a service with DB access.
    const healthScore = this.calculateHealthScore(payload);

    this.logger.info(
      `[AI] Project health updated for project "${projectId}": score=${healthScore}`,
    );

    this.eventBus.emit({
      type: 'project.health.updated',
      payload: {
        projectId,
        taskId: payload.taskId ?? payload.id,
        completedTaskId: payload.id,
        healthScore,
        completedAt: new Date(),
      },
      timestamp: new Date(),
      source: 'ai-engine',
    });
  }

  private calculateHealthScore(payload: TaskStatusPayload): number {
    // Simplified health score calculation
    // In a real implementation, this would query the database for total/completed tasks
    // For now, we emit a basic signal that a task was completed
    // The score is a placeholder that represents task completion contribution
    const status = payload.status ?? '';
    if (status === 'done' || status === 'completed') {
      return 100; // Signal full completion of this task
    }
    return 0;
  }
}
