// ============================================================
// Task-Core Event Emission Tests (Phase 2 - v2.0.0-alpha.2)
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskService } from '@/lib/modules/task-core/task.service';
import type { IEventBus, ILogger } from '@/lib/core/types';

// --- Mocks ---

function createMockEventBus(): IEventBus {
  return {
    emit: vi.fn(),
    emitAsync: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    off: vi.fn(),
    removeAllListeners: vi.fn(),
  };
}

function createMockLogger(): ILogger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => createMockLogger()),
  };
}

function createMockTaskRepo() {
  return {
    findById: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getSubTasks: vi.fn(),
    countByStatus: vi.fn(),
  };
}

function createMockHistoryRepo() {
  return {
    findByTaskId: vi.fn(),
    create: vi.fn(),
  };
}

function createMockDependencyRepo() {
  return {};
}

function createMockProgressService() {
  return {
    recalculateParentProgress: vi.fn(),
  };
}

// --- Test Data ---

const mockTask = {
  id: 'task-001',
  title: 'Test Task',
  description: null,
  status: 'todo',
  priority: 'medium',
  progress: 0,
  type: 'general',
  source: 'manual',
  sourceRef: null,
  assignee: null,
  creator: 'system',
  parentTaskId: null,
  projectId: 'proj-001',
  dueDate: null,
  startedAt: null,
  completedAt: null,
  metadata: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// --- Tests ---

describe('TaskService Event Emission', () => {
  let eventBus: IEventBus;
  let logger: ILogger;
  let taskRepo: ReturnType<typeof createMockTaskRepo>;
  let historyRepo: ReturnType<typeof createMockHistoryRepo>;
  let progressService: ReturnType<typeof createMockProgressService>;
  let service: TaskService;

  beforeEach(() => {
    eventBus = createMockEventBus();
    logger = createMockLogger();
    taskRepo = createMockTaskRepo();
    historyRepo = createMockHistoryRepo();
    progressService = createMockProgressService();
    service = new TaskService(
      taskRepo as any,
      historyRepo as any,
      createMockDependencyRepo() as any,
      progressService as any,
      eventBus,
      logger,
    );
  });

  describe('task.created event', () => {
    it('should emit task.created when a new task is created', async () => {
      taskRepo.create.mockResolvedValue(mockTask);

      await service.createTask({
        title: 'Test Task',
        priority: 'medium',
      }, 'user-1');

      expect(eventBus.emit).toHaveBeenCalledTimes(1);
      const call = (eventBus.emit as any).mock.calls[0][0];
      expect(call.type).toBe('task.created');
      expect(call.source).toBe('task-core');
      expect(call.payload).toMatchObject({
        taskId: 'task-001',
        projectId: 'proj-001',
        title: 'Test Task',
        priority: 'medium',
        creator: 'user-1',
      });
      expect(call.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('task.status.changed event', () => {
    it('should emit task.status.changed when task status changes', async () => {
      const existingTask = { ...mockTask, status: 'todo' };
      const updatedTask = { ...mockTask, status: 'in_progress' };
      taskRepo.findById.mockResolvedValue(existingTask);
      taskRepo.update.mockResolvedValue(updatedTask);

      await service.updateTask('task-001', { status: 'in_progress' }, 'user-1');

      const calls = (eventBus.emit as any).mock.calls;
      const statusChangedCall = calls.find((c: any) => c[0].type === 'task.status.changed');
      expect(statusChangedCall).toBeDefined();
      expect(statusChangedCall[0].payload).toMatchObject({
        taskId: 'task-001',
        projectId: 'proj-001',
        status: 'in_progress',
        previousStatus: 'todo',
        changedBy: 'user-1',
      });
    });
  });

  describe('task.completed event', () => {
    it('should emit task.completed when task status becomes done', async () => {
      const existingTask = { ...mockTask, status: 'in_progress' };
      const updatedTask = { ...mockTask, status: 'done' };
      taskRepo.findById.mockResolvedValue(existingTask);
      taskRepo.update.mockResolvedValue(updatedTask);

      await service.updateTask('task-001', { status: 'done' }, 'user-1');

      const calls = (eventBus.emit as any).mock.calls;
      const completedCall = calls.find((c: any) => c[0].type === 'task.completed');
      expect(completedCall).toBeDefined();
      expect(completedCall[0].payload).toMatchObject({
        taskId: 'task-001',
        projectId: 'proj-001',
        completedBy: 'user-1',
      });
    });
  });

  describe('task.assigned event', () => {
    it('should emit task.assigned when task assignee changes', async () => {
      const existingTask = { ...mockTask, assignee: null };
      const updatedTask = { ...mockTask, assignee: 'agent-001' };
      taskRepo.findById.mockResolvedValue(existingTask);
      taskRepo.update.mockResolvedValue(updatedTask);

      await service.updateTask('task-001', { assignee: 'agent-001' }, 'user-1');

      const calls = (eventBus.emit as any).mock.calls;
      const assignedCall = calls.find((c: any) => c[0].type === 'task.assigned');
      expect(assignedCall).toBeDefined();
      expect(assignedCall[0].payload).toMatchObject({
        taskId: 'task-001',
        projectId: 'proj-001',
        assignee: 'agent-001',
        assignedBy: 'user-1',
      });
    });

    it('should not emit task.assigned when assignee does not change', async () => {
      const existingTask = { ...mockTask, assignee: 'agent-001' };
      const updatedTask = { ...existingTask };
      taskRepo.findById.mockResolvedValue(existingTask);
      taskRepo.update.mockResolvedValue(updatedTask);

      await service.updateTask('task-001', { assignee: 'agent-001' }, 'user-1');

      const calls = (eventBus.emit as any).mock.calls;
      const assignedCall = calls.find((c: any) => c[0].type === 'task.assigned');
      expect(assignedCall).toBeUndefined();
    });
  });

  describe('task.blocked event', () => {
    it('should emit task.blocked when task status becomes blocked', async () => {
      const existingTask = { ...mockTask, status: 'in_progress' };
      const updatedTask = { ...mockTask, status: 'blocked' };
      taskRepo.findById.mockResolvedValue(existingTask);
      taskRepo.update.mockResolvedValue(updatedTask);

      await service.updateTask('task-001', { status: 'blocked' as any }, 'user-1');

      const calls = (eventBus.emit as any).mock.calls;
      const blockedCall = calls.find((c: any) => c[0].type === 'task.blocked');
      expect(blockedCall).toBeDefined();
      expect(blockedCall[0].payload).toMatchObject({
        taskId: 'task-001',
        projectId: 'proj-001',
        reason: 'Status changed to blocked',
        blockedBy: 'user-1',
      });
    });
  });

  describe('no event on non-status update', () => {
    it('should not emit status events when only title changes', async () => {
      const existingTask = { ...mockTask };
      const updatedTask = { ...mockTask, title: 'Updated Title' };
      taskRepo.findById.mockResolvedValue(existingTask);
      taskRepo.update.mockResolvedValue(updatedTask);

      await service.updateTask('task-001', { title: 'Updated Title' }, 'user-1');

      const calls = (eventBus.emit as any).mock.calls;
      const statusChangedCall = calls.find((c: any) => c[0].type === 'task.status.changed');
      expect(statusChangedCall).toBeUndefined();
    });
  });

  describe('event source', () => {
    it('should always set source to task-core', async () => {
      taskRepo.create.mockResolvedValue(mockTask);

      await service.createTask({ title: 'Test' });

      const call = (eventBus.emit as any).mock.calls[0][0];
      expect(call.source).toBe('task-core');
    });
  });
});
