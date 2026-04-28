import type { ILogger } from '@/lib/core/types';
import type { AgentData } from './agent.repository';
import { TaskRepository } from '@/lib/modules/task-core/task.repository';

export type PermissionAction = 'read' | 'create' | 'update' | 'delete' | 'status_change';

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Permission Service implementing "Creator Isolation + Global Read-Only" model.
 *
 * Rules:
 * 1. Users (permissionLevel = "user") have full access to all tasks
 * 2. Agents can read all tasks (global read-only)
 * 3. Agents can only modify tasks they created (creator isolation)
 * 4. Agents can create subtasks under any parent task
 * 5. System (no agent context) has full access
 */
export class PermissionService {
  constructor(
    private taskRepo: TaskRepository,
    private logger: ILogger,
  ) {}

  /**
   * Check if an agent/user can perform an action on a task.
   */
  async checkPermission(
    agent: AgentData | null,
    action: PermissionAction,
    taskId?: string,
    options?: { parentTaskId?: string; creator?: string },
  ): Promise<PermissionCheckResult> {
    // System access (no agent context) - full access
    if (!agent) {
      return { allowed: true };
    }

    // User-level permission - full access
    if (agent.permissionLevel === 'user') {
      return { allowed: true };
    }

    // Agent-level permission
    switch (action) {
      case 'read':
        // All agents can read all tasks
        return { allowed: true };

      case 'create':
        // Agents can always create tasks
        // They can also create subtasks under any parent
        return { allowed: true };

      case 'update':
      case 'delete':
      case 'status_change':
        // Agents can only modify their own tasks
        if (!taskId) {
          return { allowed: true }; // No specific task = creating something new
        }

        const task = await this.taskRepo.findById(taskId);
        if (!task) {
          return { allowed: false, reason: 'Task not found' };
        }

        if (task.creator === agent.id) {
          return { allowed: true };
        }

        // Allow creating subtasks under any parent (the parentTaskId case)
        if (options?.parentTaskId && !taskId) {
          return { allowed: true };
        }

        this.logger.debug(
          `Permission denied: agent ${agent.id} tried to ${action} task ${taskId} (creator: ${task.creator})`,
        );
        return {
          allowed: false,
          reason: `Agent "${agent.name}" can only modify tasks it created. Task creator: ${task.creator ?? 'unknown'}`,
        };

      default:
        return { allowed: false, reason: `Unknown action: ${action}` };
    }
  }

  /**
   * Check if an agent can perform an action (without a specific task).
   * Used for general capability checks.
   */
  checkAgentCapability(
    agent: AgentData | null,
    capability: string,
  ): PermissionCheckResult {
    if (!agent || agent.permissionLevel === 'user') {
      return { allowed: true };
    }

    const capabilities = agent.capabilities ?? [];
    if (capabilities.includes('*') || capabilities.includes(capability)) {
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: `Agent "${agent.name}" does not have capability: ${capability}`,
    };
  }
}
