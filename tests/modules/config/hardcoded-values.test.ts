// ============================================================
// Phase 4 - 硬编码值测试 (S-HC 精选 6 个)
// ============================================================
//
// 通过直接读取源码文件验证硬编码值是否存在
// 不修改源码，仅做静态分析断言
//

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(__dirname, '../../../src');

function readSource(relativePath: string): string {
  return readFileSync(resolve(srcRoot, relativePath), 'utf-8');
}

describe('S-HC: 硬编码值测试', () => {

  // -------------------------------------------------------
  // S-HC-04: approval.ts:13 vs feedback-module.ts:401
  // 验证两处审批超时值不一致（3000ms vs 2000ms）
  // -------------------------------------------------------
  describe('S-HC-04: 审批轮询间隔已统一', () => {
    it('approval.ts 中 pollInterval 应为 2000ms（已统一修复）', () => {
      const source = readSource('lib/modules/workflow-engine/steps/approval.ts');
      // 修复后：统一为 2000ms
      expect(source).toMatch(/const\s+pollInterval\s*=\s*2000/);
    });

    it('feedback-module.ts 中 pollInterval 应为 2000ms', () => {
      const source = readSource('lib/modules/workflow-engine/feedback/feedback-module.ts');
      expect(source).toMatch(/const\s+pollInterval\s*=\s*2000/);
    });

    it('两处 pollInterval 值已统一为 2000ms', () => {
      const approvalSource = readSource('lib/modules/workflow-engine/steps/approval.ts');
      const feedbackSource = readSource('lib/modules/workflow-engine/feedback/feedback-module.ts');

      const approvalMatch = approvalSource.match(/const\s+pollInterval\s*=\s*(\d+)/);
      const feedbackMatch = feedbackSource.match(/const\s+pollInterval\s*=\s*(\d+)/);

      expect(approvalMatch).not.toBeNull();
      expect(feedbackMatch).not.toBeNull();

      const approvalValue = Number(approvalMatch![1]);
      const feedbackValue = Number(feedbackMatch![1]);

      // 修复后：两处值已统一
      expect(approvalValue).toBe(feedbackValue);
      expect(approvalValue).toBe(2000);
    });
  });

  // -------------------------------------------------------
  // S-HC-06: solo-bridge.ts:22
  // 验证 maxRecords=1000 限制生效
  // -------------------------------------------------------
  describe('S-HC-06: SOLOBridge maxRecords=1000', () => {
    it('源码中应包含 maxRecords = 1000', () => {
      const source = readSource('lib/modules/workflow-engine/solo/solo-bridge.ts');
      expect(source).toMatch(/maxRecords\s*=\s*1000/);
    });

    it('addRecord 方法中应使用 maxRecords 做截断', () => {
      const source = readSource('lib/modules/workflow-engine/solo/solo-bridge.ts');
      // 验证截断逻辑存在: callRecords.length > this.maxRecords
      expect(source).toMatch(/callRecords\.length\s*>\s*this\.maxRecords/);
      expect(source).toMatch(/callRecords\s*=\s*this\.callRecords\.slice\(/);
    });
  });

  // -------------------------------------------------------
  // S-HC-08: observability.ts:19
  // 验证 maxEntries=10000 上限截断
  // -------------------------------------------------------
  describe('S-HC-08: Observability maxEntries=10000', () => {
    it('构造函数默认参数应为 maxEntries = 10000', () => {
      const source = readSource('lib/modules/workflow-engine/observability.ts');
      expect(source).toMatch(/maxEntries.*=\s*10000/);
    });

    it('recordStepMetrics 中应有截断逻辑', () => {
      const source = readSource('lib/modules/workflow-engine/observability.ts');
      expect(source).toMatch(/stepMetrics\.length\s*>\s*this\.maxEntries/);
      expect(source).toMatch(/stepMetrics\.shift\(\)/);
    });

    it('recordSOLOCall 中应有截断逻辑', () => {
      const source = readSource('lib/modules/workflow-engine/observability.ts');
      expect(source).toMatch(/soloCallHistory\.length\s*>\s*this\.maxEntries/);
      expect(source).toMatch(/soloCallHistory\.shift\(\)/);
    });

    it('executionHistory 中应有截断逻辑', () => {
      const source = readSource('lib/modules/workflow-engine/observability.ts');
      expect(source).toMatch(/executionHistory\.length\s*>\s*this\.maxEntries/);
      expect(source).toMatch(/executionHistory\.shift\(\)/);
    });
  });

  // -------------------------------------------------------
  // S-HC-10: schedule-advisor.ts:93
  // 验证提示词中包含硬编码日期
  // -------------------------------------------------------
  describe('S-HC-10: ScheduleAdvisor 提示词硬编码日期', () => {
    it('提示词 dailyPlan 示例中应包含硬编码日期 2026-04-28', () => {
      const source = readSource('lib/modules/ai-engine/advisors/schedule-advisor.ts');
      // 第 93 行示例中有 "date": "2026-04-28"
      expect(source).toMatch(/"date":\s*"2026-04-28"/);
    });

    it('提示词中应包含工作负载评估的硬编码阈值', () => {
      const source = readSource('lib/modules/ai-engine/advisors/schedule-advisor.ts');
      // 验证阈值: < 5, 5-15, 15-25, > 25
      expect(source).toMatch(/待办任务\s*<\s*5/);
      expect(source).toMatch(/待办任务\s*5-15/);
      expect(source).toMatch(/待办任务\s*15-25/);
      expect(source).toMatch(/待办任务\s*>\s*25/);
    });

    it('提示词中应包含 dailyPlan 最多 7 天的硬编码限制', () => {
      const source = readSource('lib/modules/ai-engine/advisors/schedule-advisor.ts');
      expect(source).toMatch(/dailyPlan\s*最多规划未来\s*7\s*天/);
    });

    it('提示词中应包含 suggestions 最多 10 条的硬编码限制', () => {
      const source = readSource('lib/modules/ai-engine/advisors/schedule-advisor.ts');
      expect(source).toMatch(/suggestions\s*最多给出\s*10\s*条/);
    });
  });

  // -------------------------------------------------------
  // S-HC-11: rate-limiter.ts:112
  // 验证速率限制配置值
  // -------------------------------------------------------
  describe('S-HC-11: 速率限制配置值', () => {
    it('api 限速器: maxRequests=100, windowMs=60000', () => {
      const source = readSource('lib/security/rate-limiter.ts');
      // 匹配 api: new RateLimiter({ maxRequests: 100, windowMs: 60 * 1000
      expect(source).toMatch(/api:\s*new\s+RateLimiter\(\s*\{[^}]*maxRequests:\s*100/);
    });

    it('auth 限速器: maxRequests=5, windowMs=60000', () => {
      const source = readSource('lib/security/rate-limiter.ts');
      expect(source).toMatch(/auth:\s*new\s+RateLimiter\(\s*\{[^}]*maxRequests:\s*5/);
    });

    it('ai 限速器: maxRequests=20, windowMs=60000', () => {
      const source = readSource('lib/security/rate-limiter.ts');
      expect(source).toMatch(/ai:\s*new\s+RateLimiter\(\s*\{[^}]*maxRequests:\s*20/);
    });

    it('webhook 限速器: maxRequests=30, windowMs=60000', () => {
      const source = readSource('lib/security/rate-limiter.ts');
      expect(source).toMatch(/webhook:\s*new\s+RateLimiter\(\s*\{[^}]*maxRequests:\s*30/);
    });

    it('general 限速器: maxRequests=200, windowMs=60000', () => {
      const source = readSource('lib/security/rate-limiter.ts');
      expect(source).toMatch(/general:\s*new\s+RateLimiter\(\s*\{[^}]*maxRequests:\s*200/);
    });
  });

  // -------------------------------------------------------
  // S-HC-01: workflow-engine.module.ts:44
  // 验证默认超时 30000ms
  // -------------------------------------------------------
  describe('S-HC-01: WorkflowEngine 默认超时 30000ms', () => {
    it('soloConfig 中 defaultTimeoutMs 应为 30000', () => {
      const source = readSource('lib/modules/workflow-engine/workflow-engine.module.ts');
      expect(source).toMatch(/defaultTimeoutMs:\s*30000/);
    });

    it('soloConfig 中 defaultMode 应为 mcp', () => {
      const source = readSource('lib/modules/workflow-engine/workflow-engine.module.ts');
      expect(source).toMatch(/defaultMode:\s*'mcp'/);
    });

    it('soloConfig 中 maxConcurrentSessions 应为 5', () => {
      const source = readSource('lib/modules/workflow-engine/workflow-engine.module.ts');
      expect(source).toMatch(/maxConcurrentSessions:\s*5/);
    });
  });
});
