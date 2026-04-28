import { TaskRepository } from './task.repository';
import type { ILogger } from '@/lib/core/types';

export class TaskProgressService {
  constructor(
    private taskRepo: TaskRepository,
    private logger: ILogger,
  ) {}

  /**
   * Recalculate parent task progress based on subtasks.
   */
  async recalculateParentProgress(parentTaskId: string): Promise<void> {
    const subTasks = await this.taskRepo.getSubTasks(parentTaskId);
    if (subTasks.length === 0) return;

    const totalProgress = subTasks.reduce((sum, task) => sum + task.progress, 0);
    const avgProgress = Math.round(totalProgress / subTasks.length);

    // Update parent progress
    const parent = await this.taskRepo.findById(parentTaskId);
    if (parent && parent.progress !== avgProgress) {
      await this.taskRepo.update(parentTaskId, { progress: avgProgress });
      this.logger.debug(`Parent task ${parentTaskId} progress updated to ${avgProgress}%`);

      // If parent has its own parent, recurse
      if (parent.parentTaskId) {
        await this.recalculateParentProgress(parent.parentTaskId);
      }
    }

    // Auto-complete parent if all subtasks are done
    const allDone = subTasks.every((t) => t.status === 'done');
    if (allDone && parent && parent.status !== 'done') {
      await this.taskRepo.update(parentTaskId, { status: 'done', progress: 100 });
      this.logger.info(`Parent task ${parentTaskId} auto-completed (all subtasks done)`);
    }
  }
}
