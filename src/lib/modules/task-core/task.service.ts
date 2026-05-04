import type { IEventBus, ILogger } from '@/lib/core/types';
import type { DomainEvent } from '@/lib/core/types';
import { TaskRepository } from './task.repository';
import { TaskHistoryRepository } from './task-history.repository';
import { TaskDependencyRepository } from './task-dependency.repository';
import { TaskProgressService } from './task-progress.service';
import type {
  CreateTaskDTO,
  UpdateTaskDTO,
  TaskQuery,
  TaskStatus,
  TaskPriority,
  TaskWithRelations,
  PaginatedResult,
  VALID_TRANSITIONS,
} from './types';

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  todo: ['in_progress', 'closed'],
  in_progress: ['done', 'closed'],
  done: ['todo'],
  closed: [],
  deleted: [],
};

export class TaskService {
  constructor(
    private taskRepo: TaskRepository,
    private historyRepo: TaskHistoryRepository,
    private dependencyRepo: TaskDependencyRepository,
    private progressService: TaskProgressService,
    private eventBus: IEventBus,
    private logger: ILogger,
  ) {}

  async getTask(id: string): Promise<TaskWithRelations | null> {
    return this.taskRepo.findById(id);
  }

  async listTasks(query: TaskQuery): Promise<PaginatedResult<TaskWithRelations>> {
    return this.taskRepo.findMany(query);
  }

  async createTask(data: CreateTaskDTO, actor: string = 'system'): Promise<TaskWithRelations> {
    this.logger.info(`Creating task: ${data.title}`);
    const task = await this.taskRepo.create(data, actor);

    this.emitEvent('task.created', {
      taskId: task.id,
      projectId: task.projectId,
      title: task.title,
      priority: task.priority,
      source: task.source,
      creator: actor,
    });
    return task;
  }

  async updateTask(id: string, data: UpdateTaskDTO, actor: string = 'system'): Promise<TaskWithRelations> {
    const existing = await this.taskRepo.findById(id);
    if (!existing) throw new Error(`Task not found: ${id}`);

    this.logger.info(`Updating task ${id}`);

    // Record history for changed fields
    const trackableFields = ['title', 'description', 'status', 'priority', 'progress', 'type', 'assignee'];
    for (const field of trackableFields) {
      const key = field as keyof UpdateTaskDTO;
      if (data[key] !== undefined && data[key] !== (existing as unknown as Record<string, unknown>)[key]) {
        await this.historyRepo.create({
          taskId: id,
          field,
          oldValue: String((existing as unknown as Record<string, unknown>)[key] ?? ''),
          newValue: String(data[key] ?? ''),
          actor,
        });
      }
    }

    const updated = await this.taskRepo.update(id, data);

    if (data.status && data.status !== existing.status) {
      this.emitEvent('task.status.changed', {
        taskId: id,
        projectId: existing.projectId,
        status: data.status,
        previousStatus: existing.status,
        changedBy: actor,
      });

      if (data.status === 'done') {
        this.emitEvent('task.completed', {
          taskId: id,
          projectId: existing.projectId,
          completedBy: actor,
        });
      }

      if ((data.status as string) === 'blocked') {
        this.emitEvent('task.blocked', {
          taskId: id,
          projectId: existing.projectId,
          reason: 'Status changed to blocked',
          blockedBy: actor,
        });
      }
    }

    if (data.assignee && data.assignee !== existing.assignee) {
      this.emitEvent('task.assigned', {
        taskId: id,
        projectId: existing.projectId,
        assignee: data.assignee,
        assignedBy: actor,
      });
    }

    // Recalculate parent progress if this is a subtask
    if (existing.parentTaskId) {
      await this.progressService.recalculateParentProgress(existing.parentTaskId);
    }

    return updated;
  }

  async updateStatus(id: string, newStatus: TaskStatus, actor: string = 'system'): Promise<TaskWithRelations> {
    const existing = await this.taskRepo.findById(id);
    if (!existing) throw new Error(`Task not found: ${id}`);

    const currentStatus = existing.status as TaskStatus;
    const allowed = VALID_STATUS_TRANSITIONS[currentStatus] ?? [];

    if (!allowed.includes(newStatus)) {
      throw new Error(
        `Invalid status transition: ${currentStatus} -> ${newStatus}. Allowed: ${allowed.join(', ')}`,
      );
    }

    return this.updateTask(id, { status: newStatus }, actor);
  }

  async deleteTask(id: string, actor: string = 'system'): Promise<void> {
    this.logger.info(`Deleting task ${id}`);
    await this.taskRepo.delete(id);
    this.emitEvent('task.deleted', { taskId: id, actor });
  }

  async getTaskHistory(taskId: string) {
    return this.historyRepo.findByTaskId(taskId);
  }

  async getSubTasks(parentTaskId: string) {
    return this.taskRepo.getSubTasks(parentTaskId);
  }

  async getStatusCounts() {
    return this.taskRepo.countByStatus();
  }

  private emitEvent(type: string, payload: unknown) {
    const event: DomainEvent = {
      type,
      payload,
      timestamp: new Date(),
      source: 'task-core',
    };
    this.eventBus.emit(event);
  }
}
