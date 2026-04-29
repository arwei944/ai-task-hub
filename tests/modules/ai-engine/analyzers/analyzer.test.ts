import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IAIModelAdapter } from '@/lib/modules/ai-engine/ai-model-adapter';
import type { ILogger } from '@/lib/core/types';
import { TaskAnalyzer } from '@/lib/modules/ai-engine/analyzers/task-analyzer';

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

describe('TaskAnalyzer', () => {
  let logger: ILogger;

  beforeEach(() => {
    logger = createMockLogger();
  });

  // --- 正常路径 ---

  it('should generate analysis report from AI response', async () => {
    const ai = createMockAI(JSON.stringify({
      summary: '项目进展顺利，大部分任务按时完成',
      suggestions: ['继续保持当前节奏', '关注高优先级任务'],
      risks: ['有两个任务即将到期'],
    }));

    const analyzer = new TaskAnalyzer(ai, logger);
    const report = await analyzer.generateReport({
      totalTasks: 20,
      statusCounts: { todo: 5, in_progress: 8, done: 6, closed: 1 },
      recentTasks: [
        { title: '任务1', status: 'done', priority: 'high', dueDate: '2026-05-01', createdAt: '2026-04-01' },
        { title: '任务2', status: 'in_progress', priority: 'medium', dueDate: '2026-04-20', createdAt: '2026-04-10' },
      ],
    });

    expect(report.summary).toBe('项目进展顺利，大部分任务按时完成');
    expect(report.totalTasks).toBe(20);
    expect(report.completedTasks).toBe(6);
    expect(report.inProgressTasks).toBe(8);
    expect(report.completionRate).toBe(30);
    expect(report.suggestions).toEqual(['继续保持当前节奏', '关注高优先级任务']);
    expect(report.risks).toEqual(['有两个任务即将到期']);
  });

  it('should handle JSON wrapped in code blocks', async () => {
    const ai = createMockAI('```json\n{"summary": "test", "suggestions": [], "risks": []}\n```');

    const analyzer = new TaskAnalyzer(ai, logger);
    const report = await analyzer.generateReport({
      totalTasks: 10,
      statusCounts: { done: 5 },
      recentTasks: [],
    });

    expect(report.summary).toBe('test');
    expect(report.completedTasks).toBe(5);
  });

  // --- 边界条件 ---

  it('should calculate overdue tasks correctly', async () => {
    const ai = createMockAI(JSON.stringify({
      summary: 'test',
      suggestions: [],
      risks: [],
    }));

    const analyzer = new TaskAnalyzer(ai, logger);
    const pastDate = '2020-01-01';
    const futureDate = '2030-01-01';

    const report = await analyzer.generateReport({
      totalTasks: 4,
      statusCounts: { todo: 4 },
      recentTasks: [
        { title: '超期未完成', status: 'todo', priority: 'high', dueDate: pastDate, createdAt: '2026-01-01' },
        { title: '超期已完成', status: 'done', priority: 'high', dueDate: pastDate, createdAt: '2026-01-01' },
        { title: '未到期', status: 'todo', priority: 'medium', dueDate: futureDate, createdAt: '2026-01-01' },
        { title: '无截止日期', status: 'todo', priority: 'low', dueDate: null, createdAt: '2026-01-01' },
      ],
    });

    expect(report.overdueTasks).toBe(1);
  });

  it('should handle zero tasks gracefully', async () => {
    const ai = createMockAI(JSON.stringify({
      summary: '暂无任务',
      suggestions: [],
      risks: [],
    }));

    const analyzer = new TaskAnalyzer(ai, logger);
    const report = await analyzer.generateReport({
      totalTasks: 0,
      statusCounts: {},
      recentTasks: [],
    });

    expect(report.totalTasks).toBe(0);
    expect(report.completionRate).toBe(0);
    expect(report.completedTasks).toBe(0);
    expect(report.inProgressTasks).toBe(0);
    expect(report.overdueTasks).toBe(0);
  });

  it('should use default empty arrays for missing suggestions and risks', async () => {
    const ai = createMockAI(JSON.stringify({
      summary: 'test summary',
    }));

    const analyzer = new TaskAnalyzer(ai, logger);
    const report = await analyzer.generateReport({
      totalTasks: 5,
      statusCounts: { done: 3 },
      recentTasks: [],
    });

    expect(report.suggestions).toEqual([]);
    expect(report.risks).toEqual([]);
  });

  // --- Fallback 报告 ---

  it('should generate fallback report when AI fails', async () => {
    const ai: IAIModelAdapter = {
      chat: vi.fn().mockRejectedValue(new Error('AI unavailable')),
      structured: vi.fn(),
      getModelName: () => 'mock-model',
    };

    const analyzer = new TaskAnalyzer(ai, logger);
    const report = await analyzer.generateReport({
      totalTasks: 10,
      statusCounts: { todo: 3, in_progress: 4, done: 2, closed: 1 },
      recentTasks: [
        { title: '超期任务', status: 'todo', priority: 'high', dueDate: '2026-01-01', createdAt: '2026-01-01' },
      ],
    });

    expect(report.totalTasks).toBe(10);
    expect(report.completedTasks).toBe(2);
    expect(report.inProgressTasks).toBe(4);
    expect(report.completionRate).toBe(20);
    expect(report.overdueTasks).toBe(1);
    expect(report.risks).toContain('1 个任务已超期');
    expect(report.suggestions.length).toBeGreaterThan(0);
    expect(logger.error).toHaveBeenCalled();
  });

  it('should generate fallback report when AI returns no JSON', async () => {
    const ai = createMockAI('无法生成报告');

    const analyzer = new TaskAnalyzer(ai, logger);
    const report = await analyzer.generateReport({
      totalTasks: 5,
      statusCounts: { todo: 2, in_progress: 6, done: 1 },
      recentTasks: [],
    });

    expect(report.suggestions.length).toBeGreaterThan(0);
    expect(report.suggestions[0]).toContain('进行中的任务较多');
  });

  it('fallback report should suggest splitting tasks when completion rate is low', async () => {
    const ai: IAIModelAdapter = {
      chat: vi.fn().mockRejectedValue(new Error('fail')),
      structured: vi.fn(),
      getModelName: () => 'mock-model',
    };

    const analyzer = new TaskAnalyzer(ai, logger);
    const report = await analyzer.generateReport({
      totalTasks: 10,
      statusCounts: { todo: 9, done: 1 },
      recentTasks: [],
    });

    expect(report.completionRate).toBe(10);
    expect(report.suggestions).toContain('完成率较低，建议拆分大任务为更小的子任务');
  });

  it('fallback report should not suggest splitting when few tasks', async () => {
    const ai: IAIModelAdapter = {
      chat: vi.fn().mockRejectedValue(new Error('fail')),
      structured: vi.fn(),
      getModelName: () => 'mock-model',
    };

    const analyzer = new TaskAnalyzer(ai, logger);
    const report = await analyzer.generateReport({
      totalTasks: 3,
      statusCounts: { todo: 2, done: 1 },
      recentTasks: [],
    });

    expect(report.suggestions.some(s => s.includes('拆分'))).toBe(false);
  });

  // --- 错误路径 ---

  it('should handle AI returning invalid JSON', async () => {
    const ai = createMockAI('{invalid json}');

    const analyzer = new TaskAnalyzer(ai, logger);
    const report = await analyzer.generateReport({
      totalTasks: 5,
      statusCounts: { done: 2 },
      recentTasks: [],
    });

    // Should fall back to generated report
    expect(report.totalTasks).toBe(5);
    expect(report.completedTasks).toBe(2);
  });
});
