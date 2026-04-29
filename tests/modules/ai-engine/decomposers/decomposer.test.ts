import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IAIModelAdapter } from '@/lib/modules/ai-engine/ai-model-adapter';
import type { ILogger } from '@/lib/core/types';
import { TaskDecomposer } from '@/lib/modules/ai-engine/decomposers/task-decomposer';

function createMockLogger(): ILogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => createMockLogger()),
  };
}

function createMockAI(defaultResponse: string): IAIModelAdapter {
  return {
    chat: vi.fn(async () => defaultResponse),
    structured: vi.fn(),
    getModelName: () => 'mock-model',
  };
}

describe('TaskDecomposer', () => {
  let logger: ILogger;

  beforeEach(() => {
    logger = createMockLogger();
  });

  // --- 正常路径 ---

  it('should decompose a task into subtasks', async () => {
    const ai = createMockAI(JSON.stringify({
      reasoning: '这个任务需要分3步完成',
      subTasks: [
        { title: '设计数据库', description: '设计用户表和订单表', priority: 'high', order: 0, dependencies: [], estimatedEffort: 'medium' },
        { title: '实现后端 API', description: '实现 RESTful API', priority: 'high', order: 1, dependencies: [0], estimatedEffort: 'large' },
        { title: '编写单元测试', description: '测试所有 API 端点', priority: 'medium', order: 2, dependencies: [1], estimatedEffort: 'small' },
      ],
    }));

    const decomposer = new TaskDecomposer(ai, logger);
    const result = await decomposer.decompose('构建电商系统', '需要用户管理和订单功能');

    expect(result.reasoning).toBe('这个任务需要分3步完成');
    expect(result.subTasks).toHaveLength(3);
    expect(result.subTasks[0].title).toBe('设计数据库');
    expect(result.subTasks[0].description).toBe('设计用户表和订单表');
    expect(result.subTasks[0].priority).toBe('high');
    expect(result.subTasks[0].order).toBe(0);
    expect(result.subTasks[0].dependencies).toEqual([]);
    expect(result.subTasks[0].estimatedEffort).toBe('medium');
    expect(result.subTasks[1].dependencies).toEqual([0]);
    expect(result.subTasks[2].estimatedEffort).toBe('small');
  });

  it('should decompose task with only title (no description)', async () => {
    const ai = createMockAI(JSON.stringify({
      reasoning: '简单拆解',
      subTasks: [{ title: '子任务1', description: 'desc', order: 0 }],
    }));

    const decomposer = new TaskDecomposer(ai, logger);
    const result = await decomposer.decompose('简单任务');

    expect(result.subTasks).toHaveLength(1);
    expect(result.subTasks[0].title).toBe('子任务1');
  });

  it('should handle JSON wrapped in code blocks', async () => {
    const ai = createMockAI('```json\n{"reasoning": "test", "subTasks": [{"title": "子任务"}]}\n```');

    const decomposer = new TaskDecomposer(ai, logger);
    const result = await decomposer.decompose('测试');

    expect(result.subTasks).toHaveLength(1);
  });

  // --- 边界条件 ---

  it('should apply default values for missing subtask fields', async () => {
    const ai = createMockAI(JSON.stringify({
      reasoning: 'test',
      subTasks: [
        { title: '子任务1' },
        { title: '子任务2', description: '描述' },
      ],
    }));

    const decomposer = new TaskDecomposer(ai, logger);
    const result = await decomposer.decompose('测试');

    expect(result.subTasks[0].description).toBe('');
    expect(result.subTasks[0].priority).toBe('medium');
    expect(result.subTasks[0].order).toBe(0);
    expect(result.subTasks[0].dependencies).toEqual([]);
    expect(result.subTasks[0].estimatedEffort).toBe('medium');
    expect(result.subTasks[1].order).toBe(1);
  });

  it('should return empty subtasks when AI returns empty array', async () => {
    const ai = createMockAI(JSON.stringify({ reasoning: '无法拆解', subTasks: [] }));

    const decomposer = new TaskDecomposer(ai, logger);
    const result = await decomposer.decompose('简单任务');

    expect(result.subTasks).toEqual([]);
    expect(result.reasoning).toBe('无法拆解');
  });

  it('should use default reasoning when missing', async () => {
    const ai = createMockAI(JSON.stringify({ subTasks: [{ title: '子任务' }] }));

    const decomposer = new TaskDecomposer(ai, logger);
    const result = await decomposer.decompose('测试');

    expect(result.reasoning).toBe('');
  });

  // --- 错误路径 ---

  it('should return error result when AI response has no JSON', async () => {
    const ai = createMockAI('无法拆解这个任务');

    const decomposer = new TaskDecomposer(ai, logger);
    const result = await decomposer.decompose('简单任务');

    expect(result.subTasks).toEqual([]);
    expect(result.reasoning).toContain('Failed to parse');
    expect(logger.warn).toHaveBeenCalled();
  });

  it('should return error result when AI call throws', async () => {
    const ai: IAIModelAdapter = {
      chat: vi.fn().mockRejectedValue(new Error('Model unavailable')),
      structured: vi.fn(),
      getModelName: () => 'mock-model',
    };

    const decomposer = new TaskDecomposer(ai, logger);
    const result = await decomposer.decompose('测试任务');

    expect(result.subTasks).toEqual([]);
    expect(result.reasoning).toContain('Error');
    expect(logger.error).toHaveBeenCalled();
  });

  it('should return error result when AI returns invalid JSON', async () => {
    const ai = createMockAI('{not valid json}');

    const decomposer = new TaskDecomposer(ai, logger);
    const result = await decomposer.decompose('测试');

    expect(result.subTasks).toEqual([]);
    expect(result.reasoning).toContain('Error');
  });
});
