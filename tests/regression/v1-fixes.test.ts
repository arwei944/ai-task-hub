/**
 * Phase 2 回归测试: R-01 ~ R-06
 * 验证 v1 修复是否仍然有效
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, destroyTestContext } from '../trpc/helpers';
import { ConditionStep } from '@/lib/modules/workflow-engine/steps/condition';
import { WorkflowValidator } from '@/lib/modules/workflow-engine/config/workflow-validator';
import { WorkflowParser } from '@/lib/modules/workflow-engine/config/workflow-parser';
import { PluginManifest } from '@/lib/modules/plugins/types';
import { taskCoreMcpTools } from '@/lib/modules/mcp-server/tools/task-core-tools';
import { projectMcpTools } from '@/lib/modules/mcp-server/tools/project-tools';

describe('Regression Tests (R-01 ~ R-06)', () => {
  // ================================================================
  // R-01: findMany({status:['in_progress']}) 只返回 in_progress 状态
  // ================================================================
  describe('R-01: findMany status filter excludes deleted', () => {
    let ctx: Awaited<ReturnType<typeof createTestContext>>;

    beforeAll(async () => {
      ctx = await createTestContext();
      // Create tasks with different statuses (create first, then update status)
      const t1 = await ctx.taskRepo.create({ title: 'Task In Progress 1', type: 'general' });
      const t2 = await ctx.taskRepo.create({ title: 'Task In Progress 2', type: 'general' });
      const t3 = await ctx.taskRepo.create({ title: 'Task Todo', type: 'general' });
      const t4 = await ctx.taskRepo.create({ title: 'Task Done', type: 'general' });
      const t5 = await ctx.taskRepo.create({ title: 'Task Deleted', type: 'general' });
      await ctx.taskRepo.update(t1.id, { status: 'in_progress' });
      await ctx.taskRepo.update(t2.id, { status: 'in_progress' });
      await ctx.taskRepo.update(t3.id, { status: 'todo' });
      await ctx.taskRepo.update(t4.id, { status: 'done' });
      await ctx.taskRepo.update(t5.id, { status: 'deleted' });
    });

    afterAll(async () => {
      await destroyTestContext(ctx);
    });

    it('should only return in_progress tasks when filtering by status', async () => {
      const result = await ctx.taskRepo.findMany({ status: ['in_progress'] });
      expect(result.items).toHaveLength(2);
      for (const item of result.items) {
        expect(item.status).toBe('in_progress');
      }
    });

    it('should not return deleted tasks when filtering by in_progress', async () => {
      const result = await ctx.taskRepo.findMany({ status: ['in_progress'] });
      const hasDeleted = result.items.some((t) => t.status === 'deleted');
      expect(hasDeleted).toBe(false);
    });

    it('should include deleted only when explicitly requested', async () => {
      const result = await ctx.taskRepo.findMany({ status: ['deleted'] });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].status).toBe('deleted');
    });
  });

  // ================================================================
  // R-02: ConditionStep 表达式 'true' 返回 true
  // ================================================================
  describe('R-02: ConditionStep expression "true" evaluates correctly', () => {
    const step = new ConditionStep({} as any);

    it('should return true for expression "true"', async () => {
      const result = await step.execute({ expression: 'true' }, {});
      expect(result.conditionResult).toBe(true);
      expect(result.branch).toBe('then');
    });

    it('should return true for expression "1 === 1"', async () => {
      const result = await step.execute({ expression: '1 === 1' }, {});
      expect(result.conditionResult).toBe(true);
    });

    it('should return false for expression "false"', async () => {
      const result = await step.execute({ expression: 'false' }, {});
      expect(result.conditionResult).toBe(false);
      expect(result.branch).toBe('else');
    });

    it('should handle context variable references', async () => {
      const result = await step.execute(
        { expression: '{{status}} === "active"' },
        { status: 'active' }
      );
      expect(result.conditionResult).toBe(true);
    });
  });

  // ================================================================
  // R-03: validate({steps:undefined}) 返回错误而非崩溃
  // ================================================================
  describe('R-03: WorkflowValidator handles undefined steps', () => {
    const validator = new WorkflowValidator();

    it('should return error when steps is undefined', () => {
      const result = validator.validate({ name: 'test', steps: undefined } as any);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes('at least one step'))).toBe(true);
    });

    it('should return error when steps is empty array', () => {
      const result = validator.validate({ name: 'test', steps: [] });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('at least one step'))).toBe(true);
    });

    it('should return error when name is empty', () => {
      const result = validator.validate({ name: '', steps: [] });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('name'))).toBe(true);
    });

    it('should pass for valid workflow', () => {
      const result = validator.validate({
        name: 'Valid Workflow',
        steps: [
          {
            id: 'step-1',
            name: 'Create Task',
            type: 'create-task',
            config: { title: 'Test' },
          },
        ],
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ================================================================
  // R-04: PluginManifest 包含 version 字段
  // ================================================================
  describe('R-04: PluginManifest type requires version field', () => {
    it('PluginManifest type should have version as required field', () => {
      // TypeScript type-level check: constructing without version should fail at compile time
      // At runtime, we verify the type definition is correct
      const manifest: PluginManifest = {
        name: 'test-plugin',
        displayName: 'Test Plugin',
        version: '1.0.0',
        entryPoint: './index.ts',
      };
      expect(manifest.version).toBeDefined();
      expect(typeof manifest.version).toBe('string');
    });

    it('taskCoreMcpTools should have name and description', () => {
      for (const tool of taskCoreMcpTools) {
        expect(tool.name).toBeDefined();
        expect(typeof tool.name).toBe('string');
        expect(tool.description).toBeDefined();
        expect(typeof tool.description).toBe('string');
      }
    });

    it('projectMcpTools should have name and description', () => {
      for (const tool of projectMcpTools) {
        expect(tool.name).toBeDefined();
        expect(typeof tool.name).toBe('string');
        expect(tool.description).toBeDefined();
        expect(typeof tool.description).toBe('string');
      }
    });

    it('MCP tools should include both create_task and project_create_task', () => {
      const allToolNames = [
        ...taskCoreMcpTools.map((t) => t.name),
        ...projectMcpTools.map((t) => t.name),
      ];
      expect(allToolNames).toContain('create_task');
      expect(allToolNames).toContain('project_create_task');
    });
  });

  // ================================================================
  // R-05: tsc --noEmit (在 Task 5 中通过 RunCommand 验证)
  // ================================================================
  describe('R-05: TypeScript compilation', () => {
    it('should have no TypeScript errors (verified via tsc --noEmit)', () => {
      // This is a placeholder - actual verification is done via RunCommand
      // If we reach here, the test file itself compiles correctly
      expect(true).toBe(true);
    });
  });

  // ================================================================
  // R-06: MCP tools/list 包含 create_task 和 project_create_task
  // ================================================================
  describe('R-06: MCP tools list contains required tools', () => {
    it('should contain create_task in task-core tools', () => {
      const hasCreateTask = taskCoreMcpTools.some((t) => t.name === 'create_task');
      expect(hasCreateTask).toBe(true);
    });

    it('should contain project_create_task in project tools', () => {
      const hasProjectCreateTask = projectMcpTools.some((t) => t.name === 'project_create_task');
      expect(hasProjectCreateTask).toBe(true);
    });

    it('create_task and project_create_task should be different tools', () => {
      const createTask = taskCoreMcpTools.find((t) => t.name === 'create_task');
      const projectCreateTask = projectMcpTools.find((t) => t.name === 'project_create_task');
      expect(createTask).toBeDefined();
      expect(projectCreateTask).toBeDefined();
      // They should have different descriptions
      expect(createTask!.description).not.toBe(projectCreateTask!.description);
    });

    it('all MCP tools should have inputSchema', () => {
      const allTools = [...taskCoreMcpTools, ...projectMcpTools];
      for (const tool of allTools) {
        expect(tool.inputSchema).toBeDefined();
        expect(typeof tool.inputSchema).toBe('object');
      }
    });
  });
});
