import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { TaskRepository } from '@/lib/modules/task-core/task.repository';
import { TaskProgressService } from '@/lib/modules/task-core/task-progress.service';
import { Logger } from '@/lib/core/logger';
import { createTestPrisma, cleanupTestPrisma, cleanDatabase } from './helpers';

describe('TaskProgressService', () => {
  let prisma: any;
  let taskRepo: TaskRepository;
  let progressService: TaskProgressService;
  let logger: Logger;

  beforeAll(async () => {
    prisma = await createTestPrisma();
  });

  afterAll(async () => {
    await cleanupTestPrisma(prisma);
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);

    taskRepo = new TaskRepository(prisma);
    logger = new Logger('test');
    progressService = new TaskProgressService(taskRepo, logger);
  });

  // --- 进度计算 ---
  describe('recalculateParentProgress', () => {
    it('should calculate average progress of subtasks', async () => {
      const parent = await taskRepo.create({ title: 'Parent', progress: 0 });
      await taskRepo.create({ title: 'Child 1', parentTaskId: parent.id, progress: 100 });
      await taskRepo.create({ title: 'Child 2', parentTaskId: parent.id, progress: 0 });

      await progressService.recalculateParentProgress(parent.id);
      const updated = await taskRepo.findById(parent.id);
      expect(updated!.progress).toBe(50);
    });

    it('should calculate progress with three subtasks', async () => {
      const parent = await taskRepo.create({ title: 'Parent', progress: 0 });
      await taskRepo.create({ title: 'Child 1', parentTaskId: parent.id, progress: 100 });
      await taskRepo.create({ title: 'Child 2', parentTaskId: parent.id, progress: 50 });
      await taskRepo.create({ title: 'Child 3', parentTaskId: parent.id, progress: 0 });

      await progressService.recalculateParentProgress(parent.id);
      const updated = await taskRepo.findById(parent.id);
      expect(updated!.progress).toBe(50);
    });

    it('should round progress to integer', async () => {
      const parent = await taskRepo.create({ title: 'Parent', progress: 0 });
      await taskRepo.create({ title: 'Child 1', parentTaskId: parent.id, progress: 33 });
      await taskRepo.create({ title: 'Child 2', parentTaskId: parent.id, progress: 66 });

      await progressService.recalculateParentProgress(parent.id);
      const updated = await taskRepo.findById(parent.id);
      expect(updated!.progress).toBe(50);
    });

    it('should not update parent if progress has not changed', async () => {
      const parent = await taskRepo.create({ title: 'Parent', progress: 50 });
      await taskRepo.create({ title: 'Child 1', parentTaskId: parent.id, progress: 50 });
      await taskRepo.create({ title: 'Child 2', parentTaskId: parent.id, progress: 50 });

      const debugSpy = vi.spyOn(logger, 'debug');
      await progressService.recalculateParentProgress(parent.id);
      expect(debugSpy).not.toHaveBeenCalled();
      debugSpy.mockRestore();
    });

    it('should do nothing when there are no subtasks', async () => {
      const parent = await taskRepo.create({ title: 'Parent', progress: 0 });
      await progressService.recalculateParentProgress(parent.id);
      const updated = await taskRepo.findById(parent.id);
      expect(updated!.progress).toBe(0);
    });
  });

  // --- 自动完成检测 ---
  describe('auto-complete detection', () => {
    it('should auto-complete parent when all subtasks are done', async () => {
      const parent = await taskRepo.create({ title: 'Parent', status: 'in_progress', progress: 0 });
      await taskRepo.create({ title: 'Child 1', parentTaskId: parent.id, status: 'done', progress: 100 });
      await taskRepo.create({ title: 'Child 2', parentTaskId: parent.id, status: 'done', progress: 100 });

      await progressService.recalculateParentProgress(parent.id);
      const updated = await taskRepo.findById(parent.id);
      expect(updated!.status).toBe('done');
      expect(updated!.progress).toBe(100);
    });

    it('should not auto-complete parent when not all subtasks are done', async () => {
      const parent = await taskRepo.create({ title: 'Parent', status: 'in_progress', progress: 0 });
      await taskRepo.create({ title: 'Child 1', parentTaskId: parent.id, status: 'done', progress: 100 });
      await taskRepo.create({ title: 'Child 2', parentTaskId: parent.id, status: 'in_progress', progress: 50 });

      await progressService.recalculateParentProgress(parent.id);
      const updated = await taskRepo.findById(parent.id);
      expect(updated!.status).toBe('in_progress');
    });

    it('should not change status if parent is already done', async () => {
      const parent = await taskRepo.create({ title: 'Parent', status: 'done', progress: 100 });
      await taskRepo.create({ title: 'Child 1', parentTaskId: parent.id, status: 'done', progress: 100 });

      await progressService.recalculateParentProgress(parent.id);
      const updated = await taskRepo.findById(parent.id);
      expect(updated!.status).toBe('done');
    });

    it('should log info when auto-completing', async () => {
      const parent = await taskRepo.create({ title: 'Parent', status: 'in_progress', progress: 0 });
      await taskRepo.create({ title: 'Child 1', parentTaskId: parent.id, status: 'done', progress: 100 });

      const infoSpy = vi.spyOn(logger, 'info');
      await progressService.recalculateParentProgress(parent.id);
      expect(infoSpy).toHaveBeenCalledWith(
        expect.stringContaining('auto-completed'),
      );
      infoSpy.mockRestore();
    });
  });

  // --- 递归更新 ---
  describe('recursive parent update', () => {
    it('should recursively update grandparent progress', async () => {
      const grandparent = await taskRepo.create({ title: 'Grandparent', progress: 0 });
      const parent = await taskRepo.create({ title: 'Parent', parentTaskId: grandparent.id, progress: 0 });
      await taskRepo.create({ title: 'Child 1', parentTaskId: parent.id, progress: 100 });
      await taskRepo.create({ title: 'Child 2', parentTaskId: parent.id, progress: 0 });

      await progressService.recalculateParentProgress(parent.id);

      const updatedParent = await taskRepo.findById(parent.id);
      expect(updatedParent!.progress).toBe(50);

      const updatedGrandparent = await taskRepo.findById(grandparent.id);
      expect(updatedGrandparent!.progress).toBe(50);
    });
  });
});
