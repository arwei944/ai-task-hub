import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IAIModelAdapter } from '@/lib/modules/ai-engine/ai-model-adapter';
import type { ILogger } from '@/lib/core/types';
import { StatusInferencer } from '@/lib/modules/ai-engine/inferencers/status-inferencer';

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

describe('StatusInferencer', () => {
  let logger: ILogger;

  beforeEach(() => {
    logger = createMockLogger();
  });

  // --- 正常路径 ---

  it('should infer status from context', async () => {
    const ai = createMockAI(JSON.stringify({
      suggestedStatus: 'in_progress',
      confidence: 0.85,
      reasoning: '用户提到已经开始编码',
    }));

    const inferencer = new StatusInferencer(ai, logger);
    const result = await inferencer.infer('实现登录功能', 'todo', '我已经开始写登录页面的代码了');

    expect(result.suggestedStatus).toBe('in_progress');
    expect(result.confidence).toBe(0.85);
    expect(result.reasoning).toBe('用户提到已经开始编码');
  });

  it('should infer done status', async () => {
    const ai = createMockAI(JSON.stringify({
      suggestedStatus: 'done',
      confidence: 0.95,
      reasoning: '用户确认已完成',
    }));

    const inferencer = new StatusInferencer(ai, logger);
    const result = await inferencer.infer('修复 Bug', 'in_progress', '已经修好了，测试通过');

    expect(result.suggestedStatus).toBe('done');
    expect(result.confidence).toBe(0.95);
  });

  it('should infer closed status', async () => {
    const ai = createMockAI(JSON.stringify({
      suggestedStatus: 'closed',
      confidence: 0.9,
      reasoning: '已关闭',
    }));

    const inferencer = new StatusInferencer(ai, logger);
    const result = await inferencer.infer('旧任务', 'done', '这个任务已经关闭了');

    expect(result.suggestedStatus).toBe('closed');
  });

  it('should handle JSON wrapped in code blocks', async () => {
    const ai = createMockAI('```json\n{"suggestedStatus": "done", "confidence": 1.0, "reasoning": "test"}\n```');

    const inferencer = new StatusInferencer(ai, logger);
    const result = await inferencer.infer('测试', 'todo', '完成了');

    expect(result.suggestedStatus).toBe('done');
    expect(result.confidence).toBe(1.0);
  });

  // --- 边界条件 ---

  it('should clamp confidence to 0-1 range', async () => {
    const ai = createMockAI(JSON.stringify({
      suggestedStatus: 'done',
      confidence: 2.0,
      reasoning: 'test',
    }));

    const inferencer = new StatusInferencer(ai, logger);
    const result = await inferencer.infer('测试', 'todo', '完成了');

    expect(result.confidence).toBe(1);
  });

  it('should clamp negative confidence to 0', async () => {
    const ai = createMockAI(JSON.stringify({
      suggestedStatus: 'todo',
      confidence: -0.5,
      reasoning: 'test',
    }));

    const inferencer = new StatusInferencer(ai, logger);
    const result = await inferencer.infer('测试', 'todo', '不确定');

    expect(result.confidence).toBe(0);
  });

  it('should use current status as default when suggestedStatus is missing', async () => {
    const ai = createMockAI(JSON.stringify({
      confidence: 0.5,
      reasoning: '无法确定',
    }));

    const inferencer = new StatusInferencer(ai, logger);
    const result = await inferencer.infer('测试', 'todo', '不确定');

    expect(result.suggestedStatus).toBe('todo');
  });

  it('should use empty reasoning when missing', async () => {
    const ai = createMockAI(JSON.stringify({
      suggestedStatus: 'in_progress',
      confidence: 0.7,
    }));

    const inferencer = new StatusInferencer(ai, logger);
    const result = await inferencer.infer('测试', 'todo', '开始了');

    expect(result.reasoning).toBe('');
  });

  it('should use 0 confidence when missing', async () => {
    const ai = createMockAI(JSON.stringify({
      suggestedStatus: 'done',
      reasoning: 'test',
    }));

    const inferencer = new StatusInferencer(ai, logger);
    const result = await inferencer.infer('测试', 'todo', '完成');

    expect(result.confidence).toBe(0);
  });

  // --- 错误路径 ---

  it('should return current status when AI response has no JSON', async () => {
    const ai = createMockAI('无法判断');

    const inferencer = new StatusInferencer(ai, logger);
    const result = await inferencer.infer('测试任务', 'todo', '不确定');

    expect(result.suggestedStatus).toBe('todo');
    expect(result.confidence).toBe(0);
    expect(result.reasoning).toContain('Failed to parse');
  });

  it('should return current status when AI call throws', async () => {
    const ai: IAIModelAdapter = {
      chat: vi.fn().mockRejectedValue(new Error('API error')),
      structured: vi.fn(),
      getModelName: () => 'mock-model',
    };

    const inferencer = new StatusInferencer(ai, logger);
    const result = await inferencer.infer('测试', 'in_progress', '上下文');

    expect(result.suggestedStatus).toBe('in_progress');
    expect(result.confidence).toBe(0);
    expect(result.reasoning).toContain('Error');
    expect(logger.error).toHaveBeenCalled();
  });

  it('should return current status when AI returns invalid JSON', async () => {
    const ai = createMockAI('{invalid}');

    const inferencer = new StatusInferencer(ai, logger);
    const result = await inferencer.infer('测试', 'todo', '上下文');

    expect(result.suggestedStatus).toBe('todo');
    expect(result.confidence).toBe(0);
  });
});
