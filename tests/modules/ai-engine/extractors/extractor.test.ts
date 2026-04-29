import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IAIModelAdapter } from '@/lib/modules/ai-engine/ai-model-adapter';
import type { ILogger } from '@/lib/core/types';
import { TaskExtractor } from '@/lib/modules/ai-engine/extractors/task-extractor';

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

describe('TaskExtractor', () => {
  let logger: ILogger;

  beforeEach(() => {
    logger = createMockLogger();
  });

  // --- 正常路径 ---

  it('should extract tasks from plain JSON response', async () => {
    const ai = createMockAI(JSON.stringify({
      tasks: [
        { title: '实现用户登录', description: 'OAuth2.0', priority: 'high', type: 'feature', confidence: 0.95 },
        { title: '修复首页样式', priority: 'medium', confidence: 0.8 },
      ],
    }));

    const extractor = new TaskExtractor(ai, logger);
    const tasks = await extractor.extract('需要实现用户登录和修复首页样式');

    expect(tasks).toHaveLength(2);
    expect(tasks[0].title).toBe('实现用户登录');
    expect(tasks[0].description).toBe('OAuth2.0');
    expect(tasks[0].priority).toBe('high');
    expect(tasks[0].type).toBe('feature');
    expect(tasks[0].confidence).toBe(0.95);
    expect(tasks[1].title).toBe('修复首页样式');
  });

  it('should extract tasks from JSON wrapped in code blocks', async () => {
    const ai = createMockAI('```json\n{"tasks": [{"title": "测试任务", "confidence": 0.9}]}\n```');

    const extractor = new TaskExtractor(ai, logger);
    const tasks = await extractor.extract('test');

    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('测试任务');
    expect(tasks[0].confidence).toBe(0.9);
  });

  it('should extract tasks with optional fields', async () => {
    const ai = createMockAI(JSON.stringify({
      tasks: [
        { title: '编写文档', dueDate: '2026-05-15', tags: ['docs', 'api'], confidence: 0.7 },
      ],
    }));

    const extractor = new TaskExtractor(ai, logger);
    const tasks = await extractor.extract('编写文档');

    expect(tasks[0].dueDate).toBe('2026-05-15');
    expect(tasks[0].tags).toEqual(['docs', 'api']);
  });

  it('should pass options to extraction (source, creator)', async () => {
    const ai = createMockAI(JSON.stringify({ tasks: [] }));
    const extractor = new TaskExtractor(ai, logger);

    await extractor.extract('test', { source: 'slack', creator: 'user-123' });

    // Verify the AI was called
    expect(ai.chat).toHaveBeenCalled();
  });

  // --- 边界条件 ---

  it('should return empty array when no tasks in response', async () => {
    const ai = createMockAI(JSON.stringify({ tasks: [] }));

    const extractor = new TaskExtractor(ai, logger);
    const tasks = await extractor.extract('没有任务');

    expect(tasks).toEqual([]);
  });

  it('should clamp confidence to 0-1 range', async () => {
    const ai = createMockAI(JSON.stringify({
      tasks: [
        { title: '过高', confidence: 1.5 },
        { title: '负数', confidence: -0.3 },
        { title: '无', confidence: undefined },
      ],
    }));

    const extractor = new TaskExtractor(ai, logger);
    const tasks = await extractor.extract('test');

    expect(tasks[0].confidence).toBe(1);
    expect(tasks[1].confidence).toBe(0);
    expect(tasks[2].confidence).toBe(0.5); // default
  });

  it('should apply default values for missing fields', async () => {
    const ai = createMockAI(JSON.stringify({ tasks: [{ title: '最小任务' }] }));

    const extractor = new TaskExtractor(ai, logger);
    const tasks = await extractor.extract('test');

    expect(tasks[0].title).toBe('最小任务');
    expect(tasks[0].priority).toBe('medium');
    expect(tasks[0].type).toBe('general');
    expect(tasks[0].confidence).toBe(0.5);
  });

  it('should handle empty text input', async () => {
    const ai = createMockAI(JSON.stringify({ tasks: [] }));

    const extractor = new TaskExtractor(ai, logger);
    const tasks = await extractor.extract('');

    expect(tasks).toEqual([]);
  });

  // --- 错误路径 ---

  it('should return empty array when AI response has no JSON', async () => {
    const ai = createMockAI('这是一段普通文本，没有 JSON');

    const extractor = new TaskExtractor(ai, logger);
    const tasks = await extractor.extract('随便说点什么');

    expect(tasks).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('valid JSON'));
  });

  it('should return empty array when AI call throws', async () => {
    const ai: IAIModelAdapter = {
      chat: vi.fn().mockRejectedValue(new Error('Network error')),
      structured: vi.fn(),
      getModelName: () => 'mock-model',
    };

    const extractor = new TaskExtractor(ai, logger);
    const tasks = await extractor.extract('test');

    expect(tasks).toEqual([]);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Network error'));
  });

  it('should return empty array when AI returns invalid JSON', async () => {
    const ai = createMockAI('{invalid json}');

    const extractor = new TaskExtractor(ai, logger);
    const tasks = await extractor.extract('test');

    expect(tasks).toEqual([]);
    expect(logger.error).toHaveBeenCalled();
  });

  it('should handle tasks array missing in parsed response', async () => {
    const ai = createMockAI(JSON.stringify({ other: 'data' }));

    const extractor = new TaskExtractor(ai, logger);
    const tasks = await extractor.extract('test');

    expect(tasks).toEqual([]);
  });
});
