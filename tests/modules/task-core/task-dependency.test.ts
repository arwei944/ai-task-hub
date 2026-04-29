import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { TaskDependencyRepository } from '@/lib/modules/task-core/task-dependency.repository';
import { createTestPrisma, cleanupTestPrisma, cleanDatabase } from './helpers';

describe('TaskDependencyRepository', () => {
  let prisma: any;
  let repo: TaskDependencyRepository;

  beforeAll(async () => {
    prisma = await createTestPrisma();
  });

  afterAll(async () => {
    await cleanupTestPrisma(prisma);
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    repo = new TaskDependencyRepository(prisma);
  });

  // Helper to create tasks
  async function createTask(title: string, id?: string) {
    return prisma.task.create({
      data: { id: id || `task-${Date.now()}-${Math.random().toString(36).slice(2)}`, title },
    });
  }

  // --- 依赖关系创建 ---
  describe('addDependency', () => {
    it('should create a dependency between two tasks', async () => {
      const taskA = await createTask('A');
      const taskB = await createTask('B');
      const dep = await repo.addDependency(taskA.id, taskB.id);
      expect(dep.taskId).toBe(taskA.id);
      expect(dep.dependsOnId).toBe(taskB.id);
    });

    it('should prevent self-dependency', async () => {
      const task = await createTask('Self');
      await expect(repo.addDependency(task.id, task.id)).rejects.toThrow('cannot depend on itself');
    });

    it('should return existing dependency if duplicate', async () => {
      const taskA = await createTask('A');
      const taskB = await createTask('B');
      const dep1 = await repo.addDependency(taskA.id, taskB.id);
      const dep2 = await repo.addDependency(taskA.id, taskB.id);
      expect(dep1.id).toBe(dep2.id);
    });
  });

  // --- 依赖关系查询 ---
  describe('getDependencies / getDependents', () => {
    it('should get dependencies of a task', async () => {
      const taskA = await createTask('A');
      const taskB = await createTask('B');
      const taskC = await createTask('C');
      await repo.addDependency(taskA.id, taskB.id);
      await repo.addDependency(taskA.id, taskC.id);

      const deps = await repo.getDependencies(taskA.id);
      expect(deps).toHaveLength(2);
    });

    it('should get dependents of a task', async () => {
      const taskA = await createTask('A');
      const taskB = await createTask('B');
      const taskC = await createTask('C');
      await repo.addDependency(taskB.id, taskA.id);
      await repo.addDependency(taskC.id, taskA.id);

      const dependents = await repo.getDependents(taskA.id);
      expect(dependents).toHaveLength(2);
    });
  });

  // --- 循环依赖检测 ---
  describe('wouldCreateCycle', () => {
    it('should detect direct cycle (A -> B -> A)', async () => {
      const taskA = await createTask('A');
      const taskB = await createTask('B');
      await repo.addDependency(taskA.id, taskB.id);

      const wouldCycle = await repo.wouldCreateCycle(taskB.id, taskA.id);
      expect(wouldCycle).toBe(true);
    });

    it('should detect indirect cycle (A -> B -> C -> A)', async () => {
      const taskA = await createTask('A');
      const taskB = await createTask('B');
      const taskC = await createTask('C');
      await repo.addDependency(taskA.id, taskB.id);
      await repo.addDependency(taskB.id, taskC.id);

      const wouldCycle = await repo.wouldCreateCycle(taskC.id, taskA.id);
      expect(wouldCycle).toBe(true);
    });

    it('should return false for non-cyclic dependency', async () => {
      const taskA = await createTask('A');
      const taskB = await createTask('B');
      const taskC = await createTask('C');
      await repo.addDependency(taskA.id, taskB.id);

      const wouldCycle = await repo.wouldCreateCycle(taskA.id, taskC.id);
      expect(wouldCycle).toBe(false);
    });

    it('should return false when no dependencies exist', async () => {
      const taskA = await createTask('A');
      const taskB = await createTask('B');

      const wouldCycle = await repo.wouldCreateCycle(taskA.id, taskB.id);
      expect(wouldCycle).toBe(false);
    });
  });

  // --- 移除依赖 ---
  describe('removeDependency', () => {
    it('should remove a dependency', async () => {
      const taskA = await createTask('A');
      const taskB = await createTask('B');
      await repo.addDependency(taskA.id, taskB.id);

      await repo.removeDependency(taskA.id, taskB.id);
      const deps = await repo.getDependencies(taskA.id);
      expect(deps).toHaveLength(0);
    });
  });

  // --- 级联删除 ---
  describe('removeAllForTask', () => {
    it('should remove all dependencies where task is the source', async () => {
      const taskA = await createTask('A');
      const taskB = await createTask('B');
      const taskC = await createTask('C');
      await repo.addDependency(taskA.id, taskB.id);
      await repo.addDependency(taskA.id, taskC.id);

      await repo.removeAllForTask(taskA.id);
      const deps = await repo.getDependencies(taskA.id);
      expect(deps).toHaveLength(0);
    });

    it('should remove all dependencies where task is the target', async () => {
      const taskA = await createTask('A');
      const taskB = await createTask('B');
      const taskC = await createTask('C');
      await repo.addDependency(taskB.id, taskA.id);
      await repo.addDependency(taskC.id, taskA.id);

      await repo.removeAllForTask(taskA.id);
      const dependents = await repo.getDependents(taskA.id);
      expect(dependents).toHaveLength(0);
    });

    it('should remove both incoming and outgoing dependencies', async () => {
      const taskA = await createTask('A');
      const taskB = await createTask('B');
      const taskC = await createTask('C');
      await repo.addDependency(taskA.id, taskB.id);
      await repo.addDependency(taskC.id, taskA.id);

      await repo.removeAllForTask(taskA.id);
      const deps = await repo.getDependencies(taskA.id);
      const dependents = await repo.getDependents(taskA.id);
      expect(deps).toHaveLength(0);
      expect(dependents).toHaveLength(0);
    });
  });
});
