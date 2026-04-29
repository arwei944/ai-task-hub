import { describe, it, expect, beforeEach } from 'vitest';
import {
  WorkflowContextManager,
  WorkspaceManager,
} from '@/lib/modules/workflow-engine/context';

describe('WorkflowContextManager', () => {
  describe('get / set', () => {
    it('should get and set values', () => {
      const ctx = new WorkflowContextManager();
      ctx.set('name', 'test');
      expect(ctx.get('name')).toBe('test');
    });

    it('should return undefined for non-existent key', () => {
      const ctx = new WorkflowContextManager();
      expect(ctx.get('nonexistent')).toBeUndefined();
    });

    it('should initialize with variables', () => {
      const ctx = new WorkflowContextManager({ foo: 'bar', num: 42 });
      expect(ctx.get('foo')).toBe('bar');
      expect(ctx.get('num')).toBe(42);
    });
  });

  describe('merge', () => {
    it('should merge step results into context', () => {
      const ctx = new WorkflowContextManager();
      ctx.merge({ result: 'success', count: 5 });
      expect(ctx.get('result')).toBe('success');
      expect(ctx.get('count')).toBe(5);
    });

    it('should not merge keys starting with underscore', () => {
      const ctx = new WorkflowContextManager();
      ctx.merge({ _internal: 'value', normal: 'value' });
      expect(ctx.get('_internal')).toBeUndefined();
      expect(ctx.get('normal')).toBe('value');
    });

    it('should overwrite existing values on merge', () => {
      const ctx = new WorkflowContextManager({ key: 'old' });
      ctx.merge({ key: 'new' });
      expect(ctx.get('key')).toBe('new');
    });
  });

  describe('getAll', () => {
    it('should return a copy of the context', () => {
      const ctx = new WorkflowContextManager({ a: 1, b: 2 });
      const all = ctx.getAll();
      expect(all).toEqual({ a: 1, b: 2 });
    });

    it('should not be affected by external mutations', () => {
      const ctx = new WorkflowContextManager({ a: 1 });
      const all = ctx.getAll() as any;
      all.a = 999;
      expect(ctx.get('a')).toBe(1);
    });
  });

  describe('resolveTemplate', () => {
    it('should replace {{var}} placeholders', () => {
      const ctx = new WorkflowContextManager({ name: 'World', count: 42 });
      expect(ctx.resolveTemplate('Hello {{name}}!')).toBe('Hello World!');
    });

    it('should replace multiple placeholders', () => {
      const ctx = new WorkflowContextManager({ a: 'A', b: 'B' });
      expect(ctx.resolveTemplate('{{a}}-{{b}}')).toBe('A-B');
    });

    it('should resolve nested paths', () => {
      const ctx = new WorkflowContextManager({ obj: { nested: { val: 'deep' } } });
      expect(ctx.resolveTemplate('{{obj.nested.val}}')).toBe('deep');
    });

    it('should return empty string for undefined variables', () => {
      const ctx = new WorkflowContextManager();
      expect(ctx.resolveTemplate('{{nonexistent}}')).toBe('');
    });

    it('should handle mixed defined and undefined variables', () => {
      const ctx = new WorkflowContextManager({ known: 'yes' });
      expect(ctx.resolveTemplate('{{known}} {{unknown}}')).toBe('yes ');
    });
  });

  describe('resolveTemplateVars', () => {
    it('should resolve templates in object values', () => {
      const ctx = new WorkflowContextManager({ name: 'Test' });
      const result = ctx.resolveTemplateVars({
        greeting: 'Hello {{name}}',
        count: 42,
        nested: { msg: 'Hi {{name}}' },
      });
      expect(result.greeting).toBe('Hello Test');
      expect(result.count).toBe(42);
      expect((result.nested as any).msg).toBe('Hi Test');
    });

    it('should not modify non-string values', () => {
      const ctx = new WorkflowContextManager({ x: 1 });
      const result = ctx.resolveTemplateVars({ arr: [1, 2, 3], num: 42 });
      expect(result.arr).toEqual([1, 2, 3]);
      expect(result.num).toBe(42);
    });
  });

  describe('setExecutionMeta', () => {
    it('should set execution metadata fields', () => {
      const ctx = new WorkflowContextManager();
      ctx.setExecutionMeta({
        executionId: 'exec-1',
        stepId: 'step-1',
        stepName: 'Test Step',
        stepType: 'create-task',
        soloSessionId: 'sess-1',
        parallelIndex: 2,
        parentStepId: 'parent-1',
      });

      expect(ctx.get('_executionId')).toBe('exec-1');
      expect(ctx.get('_stepId')).toBe('step-1');
      expect(ctx.get('_stepName')).toBe('Test Step');
      expect(ctx.get('_stepType')).toBe('create-task');
      expect(ctx.get('_soloSessionId')).toBe('sess-1');
      expect(ctx.get('_parallelIndex')).toBe(2);
      expect(ctx.get('_parentStepId')).toBe('parent-1');
    });

    it('should not set optional fields when not provided', () => {
      const ctx = new WorkflowContextManager();
      ctx.setExecutionMeta({
        executionId: 'exec-1',
        stepId: 'step-1',
        stepName: 'Test',
        stepType: 'wait',
      });

      expect(ctx.get('_soloSessionId')).toBeUndefined();
      expect(ctx.get('_parallelIndex')).toBeUndefined();
      expect(ctx.get('_parentStepId')).toBeUndefined();
    });
  });

  describe('getSoloSessionId / setSoloSessionId', () => {
    it('should get and set solo session ID', () => {
      const ctx = new WorkflowContextManager();
      expect(ctx.getSoloSessionId()).toBeUndefined();
      ctx.setSoloSessionId('sess-123');
      expect(ctx.getSoloSessionId()).toBe('sess-123');
    });
  });

  describe('getStepCount', () => {
    it('should count non-internal fields', () => {
      const ctx = new WorkflowContextManager({ a: 1, b: 2 });
      ctx.set('_executionId', 'exec-1');
      expect(ctx.getStepCount()).toBe(2);
    });

    it('should return 0 for empty context', () => {
      const ctx = new WorkflowContextManager();
      expect(ctx.getStepCount()).toBe(0);
    });
  });
});

describe('WorkspaceManager', () => {
  beforeEach(() => {
    WorkspaceManager.clearAll();
  });

  describe('createWorkspace', () => {
    it('should create a workspace with none isolation', () => {
      const ctx = WorkspaceManager.createWorkspace('ws-1', 'none', { key: 'value' });
      expect(ctx).toBeDefined();
      expect(ctx.getWorkspaceId()).toBe('ws-1');
      expect(ctx.getIsolationLevel()).toBe('none');
      expect(ctx.get('key')).toBe('value');
    });

    it('should create a workspace with context isolation', () => {
      const ctx = WorkspaceManager.createWorkspace('ws-2', 'context', { key: 'value' });
      expect(ctx).toBeDefined();
      expect(ctx.getIsolationLevel()).toBe('context');
      expect(ctx.get('key')).toBe('value');
    });

    it('should create a workspace with full isolation', () => {
      const ctx = WorkspaceManager.createWorkspace('ws-3', 'full', { key: 'value' });
      expect(ctx).toBeDefined();
      expect(ctx.getIsolationLevel()).toBe('full');
      expect(ctx.get('key')).toBe('value');
    });

    it('should destroy existing workspace when creating with same ID', () => {
      WorkspaceManager.createWorkspace('ws-1', 'none', { old: 'data' });
      const ctx = WorkspaceManager.createWorkspace('ws-1', 'full', { new: 'data' });
      expect(ctx.get('new')).toBe('data');
      expect(ctx.get('old')).toBeUndefined();
    });
  });

  describe('getWorkspace', () => {
    it('should return workspace context if exists', () => {
      WorkspaceManager.createWorkspace('ws-1', 'none');
      const ctx = WorkspaceManager.getWorkspace('ws-1');
      expect(ctx).toBeDefined();
    });

    it('should return undefined for non-existent workspace', () => {
      expect(WorkspaceManager.getWorkspace('nonexistent')).toBeUndefined();
    });
  });

  describe('destroyWorkspace', () => {
    it('should remove a workspace', () => {
      WorkspaceManager.createWorkspace('ws-1', 'none');
      expect(WorkspaceManager.hasWorkspace('ws-1')).toBe(true);
      WorkspaceManager.destroyWorkspace('ws-1');
      expect(WorkspaceManager.hasWorkspace('ws-1')).toBe(false);
    });

    it('should not throw when destroying non-existent workspace', () => {
      expect(() => WorkspaceManager.destroyWorkspace('nonexistent')).not.toThrow();
    });
  });

  describe('listWorkspaces', () => {
    it('should list all workspaces', () => {
      WorkspaceManager.createWorkspace('ws-1', 'none', { a: 1 });
      WorkspaceManager.createWorkspace('ws-2', 'full', { b: 2, c: 3 });

      const list = WorkspaceManager.listWorkspaces();
      expect(list).toHaveLength(2);
      expect(list.map(w => w.id).sort()).toEqual(['ws-1', 'ws-2']);
    });

    it('should return empty array when no workspaces', () => {
      expect(WorkspaceManager.listWorkspaces()).toHaveLength(0);
    });
  });

  describe('hasWorkspace', () => {
    it('should return true for existing workspace', () => {
      WorkspaceManager.createWorkspace('ws-1', 'none');
      expect(WorkspaceManager.hasWorkspace('ws-1')).toBe(true);
    });

    it('should return false for non-existent workspace', () => {
      expect(WorkspaceManager.hasWorkspace('nonexistent')).toBe(false);
    });
  });

  describe('getIsolationLevel', () => {
    it('should return the isolation level of a workspace', () => {
      WorkspaceManager.createWorkspace('ws-1', 'context');
      expect(WorkspaceManager.getIsolationLevel('ws-1')).toBe('context');
    });

    it('should return undefined for non-existent workspace', () => {
      expect(WorkspaceManager.getIsolationLevel('nonexistent')).toBeUndefined();
    });
  });

  describe('clearAll', () => {
    it('should remove all workspaces', () => {
      WorkspaceManager.createWorkspace('ws-1', 'none');
      WorkspaceManager.createWorkspace('ws-2', 'full');
      WorkspaceManager.clearAll();
      expect(WorkspaceManager.listWorkspaces()).toHaveLength(0);
    });
  });

  describe('isolation - context level', () => {
    it('should scope writes to isolated context', () => {
      const ctx = WorkspaceManager.createWorkspace('ws-1', 'context', { shared: 'value' });

      ctx.set('local', 'only-in-this-context');
      expect(ctx.get('local')).toBe('only-in-this-context');
      expect(ctx.get('shared')).toBe('value');
    });

    it('should not share writes between different workspaces', () => {
      const ctx1 = WorkspaceManager.createWorkspace('ws-1', 'full', { key: 'original' });
      const ctx2 = WorkspaceManager.createWorkspace('ws-2', 'full', { key: 'original' });

      ctx1.set('key', 'modified-by-ws1');
      expect(ctx1.get('key')).toBe('modified-by-ws1');
      expect(ctx2.get('key')).toBe('original');
    });
  });
});
