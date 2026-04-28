import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IAIModelAdapter, ChatMessage } from '@/lib/modules/ai-engine/ai-model-adapter';
import type { ILogger } from '@/lib/core/types';
import { TaskExtractor } from '@/lib/modules/ai-engine/extractors/task-extractor';
import { TaskDecomposer } from '@/lib/modules/ai-engine/decomposers/task-decomposer';
import { StatusInferencer } from '@/lib/modules/ai-engine/inferencers/status-inferencer';
import { TaskAnalyzer } from '@/lib/modules/ai-engine/analyzers/task-analyzer';

// --- Mocks ---

function createMockLogger(): ILogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => createMockLogger()),
  };
}

/**
 * Creates a mock AI adapter that returns a default response.
 * The default response is returned for any chat call.
 * For tests that need the AI to fail, use a separate mock.
 */
function createMockAIAdapter(defaultResponse: string): IAIModelAdapter {
  return {
    chat: vi.fn(async () => defaultResponse),
    structured: vi.fn(),
    getModelName: () => 'mock-model',
  };
}

// --- Tests ---

describe('AIEngineModule', () => {
  let logger: ILogger;

  beforeEach(() => {
    logger = createMockLogger();
  });

  describe('TaskExtractor', () => {
    it('should extract tasks from text with valid JSON response', async () => {
      const mockAI = createMockAIAdapter(JSON.stringify({
        tasks: [
          { title: '实现用户登录', description: '使用 OAuth2.0', priority: 'high', type: 'feature', confidence: 0.95 },
          { title: '修复首页样式', priority: 'medium', confidence: 0.8 },
          { title: '编写 API 文档', dueDate: '2026-05-15', tags: ['docs'], confidence: 0.7 },
        ],
      }));

      const extractor = new TaskExtractor(mockAI, logger);
      const tasks = await extractor.extract('我们需要实现用户登录功能，修复首页样式问题，并编写 API 文档');

      expect(tasks).toHaveLength(3);
      expect(tasks[0].title).toBe('实现用户登录');
      expect(tasks[0].priority).toBe('high');
      expect(tasks[0].confidence).toBe(0.95);
      expect(tasks[1].title).toBe('修复首页样式');
      expect(tasks[1].confidence).toBe(0.8);
      expect(tasks[2].dueDate).toBe('2026-05-15');
      expect(tasks[2].tags).toEqual(['docs']);
    });

    it('should return empty array when AI response has no JSON', async () => {
      const mockAI = createMockAIAdapter('这是一段普通文本，没有 JSON 格式');

      const extractor = new TaskExtractor(mockAI, logger);
      const tasks = await extractor.extract('随便说点什么');

      expect(tasks).toEqual([]);
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should return empty array when AI call fails', async () => {
      const mockAI: IAIModelAdapter = {
        chat: vi.fn().mockRejectedValue(new Error('Network error')),
        structured: vi.fn(),
        getModelName: () => 'mock-model',
      };

      const extractor = new TaskExtractor(mockAI, logger);
      const tasks = await extractor.extract('test');

      expect(tasks).toEqual([]);
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle JSON wrapped in code blocks', async () => {
      const mockAI = createMockAIAdapter('```json\n{"tasks": [{"title": "测试任务", "confidence": 0.9}]}\n```');

      const extractor = new TaskExtractor(mockAI, logger);
      const tasks = await extractor.extract('test');

      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe('测试任务');
    });

    it('should clamp confidence to 0-1 range', async () => {
      const mockAI = createMockAIAdapter(JSON.stringify({
        tasks: [
          { title: '过高置信度', confidence: 1.5 },
          { title: '负数置信度', confidence: -0.3 },
          { title: '无置信度', confidence: undefined },
        ],
      }));

      const extractor = new TaskExtractor(mockAI, logger);
      const tasks = await extractor.extract('test');

      expect(tasks[0].confidence).toBe(1);
      expect(tasks[1].confidence).toBe(0);
      expect(tasks[2].confidence).toBe(0.5); // default
    });

    it('should apply default values for missing optional fields', async () => {
      const mockAI = createMockAIAdapter(JSON.stringify({
        tasks: [{ title: '最小任务' }],
      }));

      const extractor = new TaskExtractor(mockAI, logger);
      const tasks = await extractor.extract('test');

      expect(tasks[0].title).toBe('最小任务');
      expect(tasks[0].priority).toBe('medium');
      expect(tasks[0].type).toBe('general');
      expect(tasks[0].confidence).toBe(0.5);
    });
  });

  describe('TaskDecomposer', () => {
    it('should decompose a task into subtasks', async () => {
      const mockAI = createMockAIAdapter(JSON.stringify({
        reasoning: '这个任务需要分3步完成',
        subTasks: [
          { title: '设计数据库', description: '设计用户表和订单表', priority: 'high', order: 0, dependencies: [], estimatedEffort: 'medium' },
          { title: '实现后端 API', description: '实现 RESTful API', priority: 'high', order: 1, dependencies: [0], estimatedEffort: 'large' },
          { title: '编写单元测试', description: '测试所有 API 端点', priority: 'medium', order: 2, dependencies: [1], estimatedEffort: 'small' },
        ],
      }));

      const decomposer = new TaskDecomposer(mockAI, logger);
      const result = await decomposer.decompose('构建电商系统', '需要用户管理和订单功能');

      expect(result.reasoning).toBe('这个任务需要分3步完成');
      expect(result.subTasks).toHaveLength(3);
      expect(result.subTasks[0].title).toBe('设计数据库');
      expect(result.subTasks[1].dependencies).toEqual([0]);
      expect(result.subTasks[2].estimatedEffort).toBe('small');
    });

    it('should return empty result when AI response has no JSON', async () => {
      const mockAI = createMockAIAdapter('无法拆解这个任务');

      const decomposer = new TaskDecomposer(mockAI, logger);
      const result = await decomposer.decompose('简单任务');

      expect(result.subTasks).toEqual([]);
      expect(result.reasoning).toContain('Failed to parse');
    });

    it('should return error result when AI call fails', async () => {
      const mockAI: IAIModelAdapter = {
        chat: vi.fn().mockRejectedValue(new Error('Model unavailable')),
        structured: vi.fn(),
        getModelName: () => 'mock-model',
      };

      const decomposer = new TaskDecomposer(mockAI, logger);
      const result = await decomposer.decompose('测试任务');

      expect(result.subTasks).toEqual([]);
      expect(result.reasoning).toContain('Error');
    });

    it('should apply default values for subtask fields', async () => {
      const mockAI = createMockAIAdapter(JSON.stringify({
        reasoning: 'test',
        subTasks: [
          { title: '子任务1' },
          { title: '子任务2', description: '描述' },
        ],
      }));

      const decomposer = new TaskDecomposer(mockAI, logger);
      const result = await decomposer.decompose('测试');

      expect(result.subTasks[0].description).toBe('');
      expect(result.subTasks[0].priority).toBe('medium');
      expect(result.subTasks[0].order).toBe(0);
      expect(result.subTasks[0].dependencies).toEqual([]);
      expect(result.subTasks[0].estimatedEffort).toBe('medium');
      expect(result.subTasks[1].order).toBe(1);
    });
  });

  describe('StatusInferencer', () => {
    it('should infer task status from context', async () => {
      const mockAI = createMockAIAdapter(JSON.stringify({
        suggestedStatus: 'in_progress',
        confidence: 0.85,
        reasoning: '用户提到已经开始编码',
      }));

      const inferencer = new StatusInferencer(mockAI, logger);
      const result = await inferencer.infer('实现登录功能', 'todo', '我已经开始写登录页面的代码了，大概完成了一半');

      expect(result.suggestedStatus).toBe('in_progress');
      expect(result.confidence).toBe(0.85);
      expect(result.reasoning).toBe('用户提到已经开始编码');
    });

    it('should return current status when AI response has no JSON', async () => {
      const mockAI = createMockAIAdapter('无法判断');

      const inferencer = new StatusInferencer(mockAI, logger);
      const result = await inferencer.infer('测试任务', 'todo', '不确定');

      expect(result.suggestedStatus).toBe('todo');
      expect(result.confidence).toBe(0);
    });

    it('should return current status when AI call fails', async () => {
      const mockAI: IAIModelAdapter = {
        chat: vi.fn().mockRejectedValue(new Error('API error')),
        structured: vi.fn(),
        getModelName: () => 'mock-model',
      };

      const inferencer = new StatusInferencer(mockAI, logger);
      const result = await inferencer.infer('测试', 'in_progress', '上下文');

      expect(result.suggestedStatus).toBe('in_progress');
      expect(result.confidence).toBe(0);
      expect(result.reasoning).toContain('Error');
    });

    it('should clamp confidence to 0-1 range', async () => {
      const mockAI = createMockAIAdapter(JSON.stringify({
        suggestedStatus: 'done',
        confidence: 2.0,
        reasoning: 'test',
      }));

      const inferencer = new StatusInferencer(mockAI, logger);
      const result = await inferencer.infer('测试', 'todo', '完成了');

      expect(result.confidence).toBe(1);
    });

    it('should use current status as default when suggestedStatus is missing', async () => {
      const mockAI = createMockAIAdapter(JSON.stringify({
        confidence: 0.5,
        reasoning: '无法确定',
      }));

      const inferencer = new StatusInferencer(mockAI, logger);
      const result = await inferencer.infer('测试', 'todo', '不确定');

      expect(result.suggestedStatus).toBe('todo');
    });
  });

  describe('TaskAnalyzer', () => {
    it('should generate analysis report from task data', async () => {
      const mockAI = createMockAIAdapter(JSON.stringify({
        summary: '项目进展顺利，大部分任务按时完成',
        suggestions: ['继续保持当前节奏', '关注高优先级任务'],
        risks: ['有两个任务即将到期'],
      }));

      const analyzer = new TaskAnalyzer(mockAI, logger);
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
      expect(report.suggestions).toHaveLength(2);
      expect(report.risks).toHaveLength(1);
    });

    it('should fall back to generated report when AI fails', async () => {
      const mockAI: IAIModelAdapter = {
        chat: vi.fn().mockRejectedValue(new Error('AI unavailable')),
        structured: vi.fn(),
        getModelName: () => 'mock-model',
      };

      const analyzer = new TaskAnalyzer(mockAI, logger);
      const report = await analyzer.generateReport({
        totalTasks: 10,
        statusCounts: { todo: 3, in_progress: 4, done: 2, closed: 1 },
        recentTasks: [
          { title: '超期任务', status: 'todo', priority: 'high', dueDate: '2026-01-01', createdAt: '2026-01-01' },
        ],
      });

      // Fallback report should have computed values
      expect(report.totalTasks).toBe(10);
      expect(report.completedTasks).toBe(2);
      expect(report.inProgressTasks).toBe(4);
      expect(report.completionRate).toBe(20);
      expect(report.overdueTasks).toBe(1);
      expect(report.risks).toContain('1 个任务已超期');
      expect(report.suggestions.length).toBeGreaterThan(0);
    });

    it('should fall back when AI response has no JSON', async () => {
      const mockAI = createMockAIAdapter('无法生成报告');

      const analyzer = new TaskAnalyzer(mockAI, logger);
      const report = await analyzer.generateReport({
        totalTasks: 5,
        statusCounts: { todo: 2, in_progress: 6, done: 1 },
        recentTasks: [],
      });

      // Should use fallback
      expect(report.suggestions.length).toBeGreaterThan(0);
      expect(report.suggestions[0]).toContain('进行中的任务较多');
    });

    it('should calculate overdue tasks correctly', async () => {
      const mockAI = createMockAIAdapter(JSON.stringify({
        summary: 'test',
        suggestions: [],
        risks: [],
      }));

      const analyzer = new TaskAnalyzer(mockAI, logger);
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

      // Only the first task should be counted as overdue
      expect(report.overdueTasks).toBe(1);
    });

    it('should handle zero tasks gracefully', async () => {
      const mockAI = createMockAIAdapter(JSON.stringify({
        summary: '暂无任务',
        suggestions: [],
        risks: [],
      }));

      const analyzer = new TaskAnalyzer(mockAI, logger);
      const report = await analyzer.generateReport({
        totalTasks: 0,
        statusCounts: {},
        recentTasks: [],
      });

      expect(report.totalTasks).toBe(0);
      expect(report.completionRate).toBe(0);
      expect(report.completedTasks).toBe(0);
    });
  });
});
