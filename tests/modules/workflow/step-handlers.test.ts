import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CreateTaskStep } from '@/lib/modules/workflow-engine/steps/create-task';
import { UpdateStatusStep } from '@/lib/modules/workflow-engine/steps/update-status';
import { ConditionStep } from '@/lib/modules/workflow-engine/steps/condition';
import { ForEachStep } from '@/lib/modules/workflow-engine/steps/foreach';
import { WaitStep } from '@/lib/modules/workflow-engine/steps/wait';
import { StepRegistry } from '@/lib/modules/workflow-engine/steps/index';
import type { StepHandlerDeps } from '@/lib/modules/workflow-engine/types';

describe('Step Handlers', () => {
  describe('CreateTaskStep', () => {
    it('should create a task with resolved template variables', async () => {
      const mockTaskService = {
        createTask: vi.fn().mockResolvedValue({ id: 'task-1', title: 'Hello World' }),
      };
      const deps: StepHandlerDeps = { prisma: {}, taskService: mockTaskService };
      const step = new CreateTaskStep(deps);

      const result = await step.execute(
        { task: { title: 'Hello {{name}}', description: 'Desc' } },
        { name: 'World' },
      );

      expect(mockTaskService.createTask).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Hello World', description: 'Desc' }),
        'workflow',
      );
      expect(result.lastCreatedTaskId).toBe('task-1');
      expect(result.lastCreatedTask).toEqual({ id: 'task-1', title: 'Hello World' });
    });

    it('should use default title when not provided', async () => {
      const mockTaskService = {
        createTask: vi.fn().mockResolvedValue({ id: 'task-2', title: 'Auto-created task' }),
      };
      const deps: StepHandlerDeps = { prisma: {}, taskService: mockTaskService };
      const step = new CreateTaskStep(deps);

      await step.execute({}, {});

      expect(mockTaskService.createTask).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Auto-created task' }),
        'workflow',
      );
    });

    it('should handle non-string task values', async () => {
      const mockTaskService = {
        createTask: vi.fn().mockResolvedValue({ id: 'task-3', title: 'Test' }),
      };
      const deps: StepHandlerDeps = { prisma: {}, taskService: mockTaskService };
      const step = new CreateTaskStep(deps);

      await step.execute({ task: { title: 'Test', priority: 'high', count: 5 } }, {});

      expect(mockTaskService.createTask).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Test', priority: 'high' }),
        'workflow',
      );
    });

    it('should replace undefined template variables with empty string', async () => {
      const mockTaskService = {
        createTask: vi.fn().mockResolvedValue({ id: 'task-4', title: 'Hello ' }),
      };
      const deps: StepHandlerDeps = { prisma: {}, taskService: mockTaskService };
      const step = new CreateTaskStep(deps);

      await step.execute({ task: { title: 'Hello {{nonexistent}}' } }, {});

      expect(mockTaskService.createTask).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Hello ' }),
        'workflow',
      );
    });
  });

  describe('UpdateStatusStep', () => {
    it('should update task status', async () => {
      const mockTaskService = {
        updateStatus: vi.fn().mockResolvedValue({ id: 'task-1', status: 'done' }),
      };
      const deps: StepHandlerDeps = { prisma: {}, taskService: mockTaskService };
      const step = new UpdateStatusStep(deps);

      const result = await step.execute(
        { taskId: 'task-1', status: 'done' },
        {},
      );

      expect(mockTaskService.updateStatus).toHaveBeenCalledWith('task-1', 'done', 'workflow');
      expect(result.lastUpdatedTaskId).toBe('task-1');
    });

    it('should use lastCreatedTaskId from context when taskId not in config', async () => {
      const mockTaskService = {
        updateStatus: vi.fn().mockResolvedValue({ id: 'task-2', status: 'in_progress' }),
      };
      const deps: StepHandlerDeps = { prisma: {}, taskService: mockTaskService };
      const step = new UpdateStatusStep(deps);

      await step.execute({ status: 'in_progress' }, { lastCreatedTaskId: 'task-2' });

      expect(mockTaskService.updateStatus).toHaveBeenCalledWith('task-2', 'in_progress', 'workflow');
    });

    it('should throw when taskId and status are missing', async () => {
      const deps: StepHandlerDeps = { prisma: {}, taskService: { updateStatus: vi.fn() } };
      const step = new UpdateStatusStep(deps);

      await expect(step.execute({}, {})).rejects.toThrow('update-status requires taskId and status');
    });
  });

  describe('ConditionStep', () => {
    // NOTE: ConditionStep uses `with()` in strict mode which throws a SyntaxError,
    // so evaluateExpression always returns false. This is a known source code issue.
    // Tests reflect the actual behavior.

    it('should evaluate expression correctly (with() bug fixed)', async () => {
      const deps: StepHandlerDeps = { prisma: {}, taskService: {} };
      const step = new ConditionStep(deps);

      const thenSteps = [{ id: 'then-1', name: 'Then', type: 'wait', config: {} }];
      const elseSteps = [{ id: 'else-1', name: 'Else', type: 'wait', config: {} }];

      const result = await step.execute(
        { expression: 'true', thenSteps, elseSteps },
        {},
      );

      // After fix: expression 'true' should evaluate to true
      expect(result.conditionResult).toBe(true);
      expect(result.branch).toBe('then');
      expect(result.branchSteps).toEqual(thenSteps);
    });

    it('should return false for false expression', async () => {
      const deps: StepHandlerDeps = { prisma: {}, taskService: {} };
      const step = new ConditionStep(deps);

      const thenSteps = [{ id: 'then-1', name: 'Then', type: 'wait', config: {} }];
      const elseSteps = [{ id: 'else-1', name: 'Else', type: 'wait', config: {} }];

      const result = await step.execute(
        { expression: 'false', thenSteps, elseSteps },
        {},
      );

      expect(result.conditionResult).toBe(false);
      expect(result.branch).toBe('else');
      expect(result.branchSteps).toEqual(elseSteps);
    });

    it('should evaluate template variable expressions correctly (with() bug fixed)', async () => {
      const deps: StepHandlerDeps = { prisma: {}, taskService: {} };
      const step = new ConditionStep(deps);

      const result = await step.execute(
        { expression: '{{status}} === "active"' },
        { status: 'active' },
      );

      // After fix: template variables are resolved and expression evaluates correctly
      expect(result.conditionResult).toBe(true);
    });

    it('should return false for unresolvable expressions', async () => {
      const deps: StepHandlerDeps = { prisma: {}, taskService: {} };
      const step = new ConditionStep(deps);

      const result = await step.execute(
        { expression: '!!!invalid syntax' },
        {},
      );

      expect(result.conditionResult).toBe(false);
    });

    it('should handle empty steps arrays', async () => {
      const deps: StepHandlerDeps = { prisma: {}, taskService: {} };
      const step = new ConditionStep(deps);

      const result = await step.execute(
        { expression: 'true', thenSteps: [], elseSteps: [] },
        {},
      );

      expect(result.branchStepCount).toBe(0);
    });

    it('should evaluate default expression correctly (with() bug fixed)', async () => {
      const deps: StepHandlerDeps = { prisma: {}, taskService: {} };
      const step = new ConditionStep(deps);

      const result = await step.execute({}, {});

      // Default expression is 'true', should evaluate to true after fix
      expect(result.conditionResult).toBe(true);
    });
  });

  describe('ForEachStep', () => {
    it('should iterate over items and execute sub-steps', async () => {
      const mockExecutor = {
        executeStep: vi.fn().mockResolvedValue({ status: 'completed' }),
      };
      const deps: StepHandlerDeps = { prisma: {}, taskService: {}, executor: mockExecutor };
      const step = new ForEachStep(deps);

      const items = ['a', 'b', 'c'];
      const subSteps = [{ id: 'sub-1', name: 'Sub', type: 'wait', config: {} }];

      const result = await step.execute(
        { items, steps: subSteps },
        { _executionId: 'exec-1', _stepId: 'step-1' },
      );

      expect(result.totalItems).toBe(3);
      expect(result.successCount).toBe(3);
      expect(result.failedCount).toBe(0);
      expect(result.foreachResults).toHaveLength(3);
      expect(mockExecutor.executeStep).toHaveBeenCalledTimes(3);
    });

    it('should set item and index variables in context', async () => {
      const capturedContexts: any[] = [];
      const mockExecutor = {
        executeStep: vi.fn().mockImplementation((params: any) => {
          capturedContexts.push(params.contextManager.getAll());
          return Promise.resolve({ status: 'completed' });
        }),
      };
      const deps: StepHandlerDeps = { prisma: {}, taskService: {}, executor: mockExecutor };
      const step = new ForEachStep(deps);

      await step.execute(
        { items: ['x', 'y'], steps: [{ id: 'sub-1', name: 'Sub', type: 'wait', config: {} }] },
        { _executionId: 'exec-1', _stepId: 'step-1' },
      );

      expect(capturedContexts[0].item).toBe('x');
      expect(capturedContexts[0].index).toBe(0);
      expect(capturedContexts[1].item).toBe('y');
      expect(capturedContexts[1].index).toBe(1);
    });

    it('should use custom itemVar and indexVar', async () => {
      const capturedContexts: any[] = [];
      const mockExecutor = {
        executeStep: vi.fn().mockImplementation((params: any) => {
          capturedContexts.push(params.contextManager.getAll());
          return Promise.resolve({ status: 'completed' });
        }),
      };
      const deps: StepHandlerDeps = { prisma: {}, taskService: {}, executor: mockExecutor };
      const step = new ForEachStep(deps);

      await step.execute(
        {
          items: ['a'],
          steps: [{ id: 'sub-1', name: 'Sub', type: 'wait', config: {} }],
          itemVar: 'element',
          indexVar: 'idx',
        },
        { _executionId: 'exec-1', _stepId: 'step-1' },
      );

      expect(capturedContexts[0].element).toBe('a');
      expect(capturedContexts[0].idx).toBe(0);
    });

    it('should throw when executor is not provided', async () => {
      const deps: StepHandlerDeps = { prisma: {}, taskService: {} };
      const step = new ForEachStep(deps);

      await expect(
        step.execute({ items: [1], steps: [{ id: 's', name: 'S', type: 'wait', config: {} }] }, {}),
      ).rejects.toThrow('Executor is required for foreach step');
    });

    it('should return empty results when no sub-steps', async () => {
      const deps: StepHandlerDeps = { prisma: {}, taskService: {}, executor: {} };
      const step = new ForEachStep(deps);

      const result = await step.execute({ items: [1, 2], steps: [] }, {});

      expect(result.foreachResults).toEqual([]);
      expect(result.totalItems).toBe(0);
    });

    it('should handle sub-step failures', async () => {
      const mockExecutor = {
        executeStep: vi.fn()
          .mockResolvedValueOnce({ status: 'completed' })
          .mockRejectedValueOnce(new Error('Sub-step failed')),
      };
      const deps: StepHandlerDeps = { prisma: {}, taskService: {}, executor: mockExecutor };
      const step = new ForEachStep(deps);

      const result = await step.execute(
        { items: [1, 2], steps: [{ id: 'sub-1', name: 'Sub', type: 'wait', config: {} }] },
        { _executionId: 'exec-1', _stepId: 'step-1' },
      );

      expect(result.successCount).toBe(1);
      expect(result.failedCount).toBe(1);
      expect(result.foreachResults[1].status).toBe('failed');
      expect(result.foreachResults[1].error).toBe('Sub-step failed');
    });

    it('should fail fast when configured', async () => {
      const mockExecutor = {
        executeStep: vi.fn()
          .mockResolvedValueOnce({ status: 'completed' })
          .mockRejectedValueOnce(new Error('Fail fast error')),
      };
      const deps: StepHandlerDeps = { prisma: {}, taskService: {}, executor: mockExecutor };
      const step = new ForEachStep(deps);

      await expect(
        step.execute(
          {
            items: [1, 2, 3],
            steps: [{ id: 'sub-1', name: 'Sub', type: 'wait', config: {} }],
            failFast: true,
          },
          { _executionId: 'exec-1', _stepId: 'step-1' },
        ),
      ).rejects.toThrow('ForEach failed at index 1');
    });

    it('should handle empty items array', async () => {
      const mockExecutor = { executeStep: vi.fn() };
      const deps: StepHandlerDeps = { prisma: {}, taskService: {}, executor: mockExecutor };
      const step = new ForEachStep(deps);

      const result = await step.execute(
        { items: [], steps: [{ id: 'sub-1', name: 'Sub', type: 'wait', config: {} }] },
        { _executionId: 'exec-1', _stepId: 'step-1' },
      );

      expect(result.totalItems).toBe(0);
      expect(result.foreachResults).toEqual([]);
      expect(mockExecutor.executeStep).not.toHaveBeenCalled();
    });
  });

  describe('WaitStep', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should wait for specified delayMs', async () => {
      const step = new WaitStep();
      const p = step.execute({ delayMs: 500 });
      vi.advanceTimersByTime(500);
      const result = await p;
      expect(result.waitedMs).toBe(500);
    });

    it('should wait for specified seconds', async () => {
      const step = new WaitStep();
      const p = step.execute({ seconds: 2 });
      vi.advanceTimersByTime(2000);
      const result = await p;
      expect(result.waitedMs).toBe(2000);
    });

    it('should default to 1000ms when no config provided', async () => {
      const step = new WaitStep();
      const p = step.execute({});
      vi.advanceTimersByTime(1000);
      const result = await p;
      expect(result.waitedMs).toBe(1000);
    });

    it('should prefer delayMs over seconds', async () => {
      const step = new WaitStep();
      const p = step.execute({ delayMs: 300, seconds: 10 });
      vi.advanceTimersByTime(300);
      const result = await p;
      expect(result.waitedMs).toBe(300);
    });
  });

  describe('StepRegistry', () => {
    it('should register and retrieve all built-in step types', () => {
      const types = StepRegistry.getRegisteredTypes();
      const expectedTypes = [
        'create-task', 'update-status', 'ai-analyze', 'send-notification',
        'wait', 'parallel-group', 'condition', 'invoke-agent', 'foreach', 'approval',
        'http-request', 'transform',
      ];

      for (const type of expectedTypes) {
        expect(types).toContain(type);
      }
    });

    it('should return handler for registered type', () => {
      const deps: StepHandlerDeps = { prisma: {}, taskService: {} };
      const handler = StepRegistry.getHandler('wait', deps);
      expect(handler).toBeDefined();
      expect(handler).toBeInstanceOf(WaitStep);
    });

    it('should return undefined for unregistered type', () => {
      const deps: StepHandlerDeps = { prisma: {}, taskService: {} };
      const handler = StepRegistry.getHandler('nonexistent', deps);
      expect(handler).toBeUndefined();
    });

    it('should throw for placeholder step types', async () => {
      const deps: StepHandlerDeps = { prisma: {}, taskService: {} };
      const handler = StepRegistry.getHandler('http-request', deps);
      expect(handler).toBeDefined();
      await expect(handler!.execute({}, {})).rejects.toThrow('not yet implemented');
    });

    it('should throw for transform placeholder', async () => {
      const deps: StepHandlerDeps = { prisma: {}, taskService: {} };
      const handler = StepRegistry.getHandler('transform', deps);
      expect(handler).toBeDefined();
      await expect(handler!.execute({}, {})).rejects.toThrow('not yet implemented');
    });
  });
});
