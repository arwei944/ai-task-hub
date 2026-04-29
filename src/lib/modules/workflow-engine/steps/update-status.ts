import type { StepHandler, StepHandlerDeps } from '../types';

export class UpdateStatusStep implements StepHandler {
  constructor(private deps: StepHandlerDeps) {}

  async execute(config: Record<string, unknown>, context: Record<string, unknown>) {
    const taskId = String(config.taskId ?? context.lastCreatedTaskId ?? '');
    const newStatus = String(config.status ?? '');
    if (!taskId || !newStatus) throw new Error('update-status requires taskId and status');
    const task = await this.deps.taskService.updateStatus(
      taskId,
      newStatus as 'todo' | 'in_progress' | 'done' | 'closed',
      'workflow',
    );
    return { lastUpdatedTaskId: task.id, lastUpdatedTask: task };
  }
}
