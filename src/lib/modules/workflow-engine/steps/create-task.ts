import type { StepHandler, StepHandlerDeps } from '../types';

export class CreateTaskStep implements StepHandler {
  constructor(private deps: StepHandlerDeps) {}
  async execute(config: Record<string, unknown>, context: Record<string, unknown>) {
    const taskData = typeof config.task === 'object' ? (config.task as Record<string, unknown>) : {};
    const resolved: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(taskData)) {
      if (typeof value === 'string') {
        resolved[key] = value.replace(/\{\{(\w+)\}\}/g, (_, varName) => context[varName] !== undefined ? String(context[varName]) : '');
      } else { resolved[key] = value; }
    }
    const task = await this.deps.taskService.createTask({
      title: String(resolved.title ?? 'Auto-created task'),
      description: resolved.description ? String(resolved.description) : undefined,
      priority: resolved.priority as 'urgent' | 'high' | 'medium' | 'low' | undefined,
      type: resolved.type ? String(resolved.type) : undefined,
      assignee: resolved.assignee ? String(resolved.assignee) : undefined,
    }, String(resolved.creator ?? 'workflow'));
    return { lastCreatedTaskId: task.id, lastCreatedTask: task };
  }
}