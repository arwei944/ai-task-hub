import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventBus } from '@/lib/core/event-bus';
import { Logger } from '@/lib/core/logger';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { TaskRepository } from '@/lib/modules/task-core/task.repository';
import { TaskHistoryRepository } from '@/lib/modules/task-core/task-history.repository';
import { TaskDependencyRepository } from '@/lib/modules/task-core/task-dependency.repository';
import { TaskProgressService } from '@/lib/modules/task-core/task-progress.service';
import { TaskService } from '@/lib/modules/task-core/task.service';
import { join } from 'node:path';

// Use a test database (schema must be pre-applied via: npx prisma db push --url "file:./test-db/test-task-core.db")
const TEST_DB_PATH = join(process.cwd(), 'test-db', 'test-task-core.db');

function createTestServices() {
  const adapter = new PrismaBetterSqlite3({ url: TEST_DB_PATH });
  const prisma = new PrismaClient({ adapter });
  const eventBus = new EventBus();
  const logger = new Logger('test');
  const taskRepo = new TaskRepository(prisma);
  const historyRepo = new TaskHistoryRepository(prisma);
  const depRepo = new TaskDependencyRepository(prisma);
  const progressService = new TaskProgressService(taskRepo, logger);
  const taskService = new TaskService(taskRepo, historyRepo, depRepo, progressService, eventBus, logger);

  return { prisma, eventBus, logger, taskRepo, historyRepo, depRepo, progressService, taskService };
}

describe('TaskCoreModule', () => {
  let services: ReturnType<typeof createTestServices>;

  beforeEach(async () => {
    services = createTestServices();
    // Clean up all data between tests (order matters due to foreign keys)
    await services.prisma.taskHistory.deleteMany();
    await services.prisma.taskDependency.deleteMany();
    await services.prisma.taskTag.deleteMany();
    await services.prisma.tag.deleteMany();
    await services.prisma.task.deleteMany();
  });

  afterEach(async () => {
    await services.prisma.$disconnect();
  });

  describe('TaskService', () => {
    it('should create a task', async () => {
      const task = await services.taskService.createTask({
        title: 'Test Task',
        description: 'Test description',
        priority: 'high',
      });

      expect(task).toBeDefined();
      expect(task.title).toBe('Test Task');
      expect(task.description).toBe('Test description');
      expect(task.priority).toBe('high');
      expect(task.status).toBe('todo');
      expect(task.progress).toBe(0);
    });

    it('should get a task by id', async () => {
      const created = await services.taskService.createTask({ title: 'Get Me' });
      const fetched = await services.taskService.getTask(created.id);

      expect(fetched).toBeDefined();
      expect(fetched!.title).toBe('Get Me');
    });

    it('should list tasks with filtering', async () => {
      await services.taskService.createTask({ title: 'High Priority', priority: 'high' });
      await services.taskService.createTask({ title: 'Low Priority', priority: 'low' });
      await services.taskService.createTask({ title: 'Another High', priority: 'high' });

      const result = await services.taskService.listTasks({ priority: ['high'] as any });
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should update a task', async () => {
      const created = await services.taskService.createTask({ title: 'Original' });
      const updated = await services.taskService.updateTask(created.id, {
        title: 'Updated',
        priority: 'urgent',
      });

      expect(updated.title).toBe('Updated');
      expect(updated.priority).toBe('urgent');
    });

    it('should record history on update', async () => {
      const created = await services.taskService.createTask({ title: 'Original' });
      await services.taskService.updateTask(created.id, { status: 'in_progress' });

      const history = await services.taskService.getTaskHistory(created.id);
      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history[0].field).toBe('status');
      expect(history[0].newValue).toBe('in_progress');
    });

    it('should validate status transitions', async () => {
      const created = await services.taskService.createTask({ title: 'Status Test' });

      // Valid: todo -> in_progress
      const updated = await services.taskService.updateStatus(created.id, 'in_progress');
      expect(updated.status).toBe('in_progress');

      // Valid: in_progress -> done
      const done = await services.taskService.updateStatus(updated.id, 'done');
      expect(done.status).toBe('done');

      // Valid: done -> todo (reopen)
      const reopened = await services.taskService.updateStatus(done.id, 'todo');
      expect(reopened.status).toBe('todo');

      // Invalid: todo -> done (skip in_progress)
      await expect(
        services.taskService.updateStatus(reopened.id, 'done')
      ).rejects.toThrow();
    });

    it('should soft delete a task', async () => {
      const created = await services.taskService.createTask({ title: 'Delete Me' });
      await services.taskService.deleteTask(created.id);

      // deleteTask sets status to 'deleted' via taskRepo.delete
      const fetched = await services.taskService.getTask(created.id);
      expect(fetched).toBeDefined();
      expect(fetched!.status).toBe('deleted');
    });

    it('should emit events on task operations', async () => {
      const events: any[] = [];
      services.eventBus.on('task.created', (e) => { events.push(e); });
      services.eventBus.on('task.status_changed', (e) => { events.push(e); });

      const task = await services.taskService.createTask({ title: 'Event Test' });
      await services.taskService.updateStatus(task.id, 'in_progress');

      expect(events.length).toBeGreaterThanOrEqual(2);
      expect(events[0].type).toBe('task.created');
      expect(events.some((e) => e.type === 'task.status_changed')).toBe(true);
    });

    it('should support subtasks', async () => {
      const parent = await services.taskService.createTask({ title: 'Parent Task' });
      const child1 = await services.taskService.createTask({ title: 'Child 1', parentTaskId: parent.id });
      const child2 = await services.taskService.createTask({ title: 'Child 2', parentTaskId: parent.id });

      const subTasks = await services.taskService.getSubTasks(parent.id);
      expect(subTasks).toHaveLength(2);
    });

    it('should search tasks', async () => {
      await services.taskService.createTask({ title: 'Build API endpoint' });
      await services.taskService.createTask({ title: 'Design database schema' });
      await services.taskService.createTask({ title: 'Write tests' });

      const result = await services.taskService.listTasks({ search: 'API' });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe('Build API endpoint');
    });

    it('should get status counts', async () => {
      await services.taskService.createTask({ title: 'T1' }); // todo
      await services.taskService.createTask({ title: 'T2' }); // todo
      const t3 = await services.taskService.createTask({ title: 'T3' });
      await services.taskService.updateStatus(t3.id, 'in_progress');

      const counts = await services.taskService.getStatusCounts();
      expect(counts['todo']).toBe(2);
      expect(counts['in_progress']).toBe(1);
    });
  });

  describe('TaskDependencyRepository', () => {
    it('should add and remove dependencies', async () => {
      const t1 = await services.taskService.createTask({ title: 'Task 1' });
      const t2 = await services.taskService.createTask({ title: 'Task 2' });

      await services.depRepo.addDependency(t1.id, t2.id);
      const deps = await services.depRepo.getDependencies(t1.id);
      expect(deps).toHaveLength(1);
      expect(deps[0].dependsOnId).toBe(t2.id);

      await services.depRepo.removeDependency(t1.id, t2.id);
      const depsAfter = await services.depRepo.getDependencies(t1.id);
      expect(depsAfter).toHaveLength(0);
    });

    it('should prevent self-dependency', async () => {
      const task = await services.taskService.createTask({ title: 'Self Dep' });
      await expect(services.depRepo.addDependency(task.id, task.id)).rejects.toThrow();
    });

    it('should prevent duplicate dependencies', async () => {
      const t1 = await services.taskService.createTask({ title: 'T1' });
      const t2 = await services.taskService.createTask({ title: 'T2' });

      await services.depRepo.addDependency(t1.id, t2.id);
      await services.depRepo.addDependency(t1.id, t2.id); // duplicate

      const deps = await services.depRepo.getDependencies(t1.id);
      expect(deps).toHaveLength(1);
    });

    it('should detect circular dependencies', async () => {
      const t1 = await services.taskService.createTask({ title: 'T1' });
      const t2 = await services.taskService.createTask({ title: 'T2' });
      const t3 = await services.taskService.createTask({ title: 'T3' });

      await services.depRepo.addDependency(t1.id, t2.id);
      await services.depRepo.addDependency(t2.id, t3.id);

      // Adding t3 -> t1 would create a cycle
      const wouldCycle = await services.depRepo.wouldCreateCycle(t3.id, t1.id);
      expect(wouldCycle).toBe(true);
    });
  });

  describe('TaskProgressService', () => {
    it('should recalculate parent progress from subtasks', async () => {
      const parent = await services.taskService.createTask({ title: 'Parent' });
      const c1 = await services.taskService.createTask({ title: 'Child 1', parentTaskId: parent.id });
      const c2 = await services.taskService.createTask({ title: 'Child 2', parentTaskId: parent.id });

      // Set child 1 to 50% progress
      await services.taskRepo.update(c1.id, { progress: 50 });

      // Set child 2 to 100% (done)
      await services.taskRepo.update(c2.id, { progress: 100 });

      // Recalculate
      await services.progressService.recalculateParentProgress(parent.id);

      const updated = await services.taskService.getTask(parent.id);
      expect(updated!.progress).toBe(75); // (50 + 100) / 2
    });
  });
});
