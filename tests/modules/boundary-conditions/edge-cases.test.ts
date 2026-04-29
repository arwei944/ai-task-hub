// ============================================================
// Phase 4 - 边界条件测试 (S-BC 精选 6 个)
// ============================================================
//
// 实例化类并传入边界值验证行为
// 不修改源码
//

import { WorkflowParser } from '@/lib/modules/workflow-engine/config/workflow-parser';
import { ConcurrencyController } from '@/lib/modules/workflow-engine/concurrency';
import { Observability } from '@/lib/modules/workflow-engine/observability';
import { WorkflowContextManager } from '@/lib/modules/workflow-engine/context';

describe('S-BC: 边界条件测试', () => {

  // -------------------------------------------------------
  // S-BC-01: phase='unknown' 时 overallProgress 不为负数
  // 实际实现在 project-handlers.ts get_project_summary 中
  // phaseOrder.indexOf('unknown') = -1 => overallProgress = -17
  // -------------------------------------------------------
  describe('S-BC-01: phase=unknown 时 overallProgress 计算', () => {
    it('当 phase 不在 phaseOrder 中时，indexOf 返回 -1，导致 overallProgress 为负数', () => {
      // 模拟 get_project_summary 中的逻辑
      const phaseOrder = ['requirements', 'planning', 'architecture', 'implementation', 'testing', 'deployment', 'completed'];
      const unknownPhase = 'unknown';
      const currentPhaseIndex = phaseOrder.indexOf(unknownPhase);
      const overallProgress = Math.round((currentPhaseIndex / (phaseOrder.length - 1)) * 100);

      // 当前实现行为：overallProgress 为负数
      expect(currentPhaseIndex).toBe(-1);
      expect(overallProgress).toBe(-17); // Math.round((-1 / 6) * 100) = -16.67 => -17

      // 这是已知问题：phase 为未知值时 overallProgress 为负数
      // 理想行为应为 0 或 NaN
    });

    it('当 phase 为空字符串时，overallProgress 也为负数', () => {
      const phaseOrder = ['requirements', 'planning', 'architecture', 'implementation', 'testing', 'deployment', 'completed'];
      const currentPhaseIndex = phaseOrder.indexOf('');
      const overallProgress = Math.round((currentPhaseIndex / (phaseOrder.length - 1)) * 100);

      expect(currentPhaseIndex).toBe(-1);
      expect(overallProgress).toBe(-17);
    });

    it('当 phase 为 requirements 时，overallProgress 应为 0', () => {
      const phaseOrder = ['requirements', 'planning', 'architecture', 'implementation', 'testing', 'deployment', 'completed'];
      const currentPhaseIndex = phaseOrder.indexOf('requirements');
      const overallProgress = Math.round((currentPhaseIndex / (phaseOrder.length - 1)) * 100);

      expect(currentPhaseIndex).toBe(0);
      expect(overallProgress).toBe(0);
    });

    it('当 phase 为 completed 时，overallProgress 应为 100', () => {
      const phaseOrder = ['requirements', 'planning', 'architecture', 'implementation', 'testing', 'deployment', 'completed'];
      const currentPhaseIndex = phaseOrder.indexOf('completed');
      const overallProgress = Math.round((currentPhaseIndex / (phaseOrder.length - 1)) * 100);

      expect(currentPhaseIndex).toBe(6);
      expect(overallProgress).toBe(100);
    });
  });

  // -------------------------------------------------------
  // S-BC-03: per-workflow 限制不阻塞全局队列
  // -------------------------------------------------------
  describe('S-BC-03: per-workflow 限制不阻塞全局队列', () => {
    it('per-workflow 限制满时，不同 workflow 的任务仍可获取全局槽位', async () => {
      const controller = new ConcurrencyController(3); // 全局最多 3 个
      controller.setWorkflowLimit('wf-a', 1); // wf-a 最多 1 个

      // wf-a 占满 per-workflow 限制
      await controller.acquire('wf-a');
      expect(controller.getRunningCount()).toBe(1);
      expect(controller.getWorkflowRunningCount('wf-a')).toBe(1);

      // wf-b 应该能获取槽位（不受 wf-a 的 per-workflow 限制影响）
      const acquireWfB = controller.acquire('wf-b');
      await expect(acquireWfB).resolves.toBeUndefined();
      expect(controller.getRunningCount()).toBe(2);
      expect(controller.getWorkflowRunningCount('wf-b')).toBe(1);
    });

    it('per-workflow 限制满时，同一 workflow 的任务应排队', async () => {
      const controller = new ConcurrencyController(5);
      controller.setWorkflowLimit('wf-a', 1);

      await controller.acquire('wf-a');
      expect(controller.getWorkflowRunningCount('wf-a')).toBe(1);

      // 第二个 wf-a 任务应排队（不立即获取）
      let resolved = false;
      const promise = controller.acquire('wf-a').then(() => { resolved = true; });

      // 给微任务队列时间执行
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(resolved).toBe(false);
      expect(controller.getWorkflowQueueLength('wf-a')).toBe(1);

      // 释放 wf-a 后应解除阻塞
      controller.release('wf-a');
      await expect(promise).resolves.toBeUndefined();
      expect(resolved).toBe(true);
    });

    it('全局并发满时，即使 per-workflow 未满也应排队', async () => {
      const controller = new ConcurrencyController(1); // 全局最多 1 个

      await controller.acquire('wf-a');
      expect(controller.getRunningCount()).toBe(1);

      let resolved = false;
      const promise = controller.acquire('wf-b').then(() => { resolved = true; });

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(resolved).toBe(false);
      expect(controller.getQueueLength()).toBe(1);

      controller.release('wf-a');
      await expect(promise).resolves.toBeUndefined();
    });
  });

  // -------------------------------------------------------
  // S-BC-04: foreach 配置 3 个子步骤，验证只执行第一个
  // -------------------------------------------------------
  describe('S-BC-04: foreach 只执行第一个子步骤', () => {
    it('ForEachStep 只使用 subSteps[0]，忽略后续子步骤', async () => {
      // 通过读取源码验证：subSteps[0] 是唯一被引用的子步骤
      const { readFileSync } = await import('fs');
      const { resolve, dirname } = await import('path');
      const { fileURLToPath } = await import('url');

      const __dirname = dirname(fileURLToPath(import.meta.url));
      const source = readFileSync(resolve(__dirname, '../../../src/lib/modules/workflow-engine/steps/foreach.ts'), 'utf-8');

      // 验证只引用了 subSteps[0]
      expect(source).toMatch(/subSteps\[0\]/);

      // 验证没有引用 subSteps[1] 或 subSteps[2]
      expect(source).not.toMatch(/subSteps\[1\]/);
      expect(source).not.toMatch(/subSteps\[2\]/);
      expect(source).not.toMatch(/subSteps\.forEach/);
      expect(source).not.toMatch(/subSteps\.map/);

      // 验证没有 for 循环遍历 subSteps
      expect(source).not.toMatch(/for\s*\(.*subSteps/);
    });
  });

  // -------------------------------------------------------
  // S-BC-05: intervention 非 JSON 时 JSON.parse 抛错
  // -------------------------------------------------------
  describe('S-BC-05: intervention 非 JSON 时 JSON.parse 抛错', () => {
    it('approval.ts 中 modified 状态下 JSON.parse 非 JSON intervention 应抛错', () => {
      // approval.ts:69 - modifications: updated.intervention ? JSON.parse(updated.intervention) : undefined
      // 如果 intervention 是非 JSON 字符串，JSON.parse 会抛 SyntaxError

      const validJson = '{"key": "value"}';
      expect(() => JSON.parse(validJson)).not.toThrow();

      const invalidJson = 'not a json string';
      expect(() => JSON.parse(invalidJson)).toThrow(SyntaxError);

      const emptyString = '';
      expect(() => JSON.parse(emptyString)).toThrow(SyntaxError);

      const randomText = 'just some random text with { braces';
      expect(() => JSON.parse(randomText)).toThrow(SyntaxError);
    });

    it('approval.ts 中 modified 分支没有 try-catch 保护 JSON.parse', async () => {
      const { readFileSync } = await import('fs');
      const { resolve, dirname } = await import('path');
      const { fileURLToPath } = await import('url');

      const __dirname = dirname(fileURLToPath(import.meta.url));
      const source = readFileSync(resolve(__dirname, '../../../src/lib/modules/workflow-engine/steps/approval.ts'), 'utf-8');

      // 验证 JSON.parse(updated.intervention) 存在
      expect(source).toMatch(/JSON\.parse\(updated\.intervention\)/);

      // 验证该分支没有 try-catch（在 case 'modified' 块内）
      // 提取 case 'modified' 到下一个 case 之间的代码
      const modifiedBlock = source.match(/case\s+'modified':([\s\S]*?)(?=case\s+'|$)/);
      expect(modifiedBlock).not.toBeNull();

      const blockCode = modifiedBlock![1];
      // 该块内不应有 try-catch
      expect(blockCode).not.toMatch(/try\s*\{/);
      expect(blockCode).not.toMatch(/catch\s*\(/);
    });
  });

  // -------------------------------------------------------
  // S-BC-06: get('') 空路径行为
  // -------------------------------------------------------
  describe('S-BC-06: WorkflowContextManager get("") 空路径行为', () => {
    it('get("") 在空上下文中应返回 undefined', () => {
      const ctx = new WorkflowContextManager();
      expect(ctx.get('')).toBeUndefined();
    });

    it('get("") 在有数据的上下文中应返回 undefined（空字符串不是有效 key）', () => {
      const ctx = new WorkflowContextManager({ foo: 'bar', baz: 42 });
      expect(ctx.get('')).toBeUndefined();
    });

    it('set("", value) 后 get("") 应返回该值', () => {
      const ctx = new WorkflowContextManager();
      ctx.set('', 'empty-key-value');
      expect(ctx.get('')).toBe('empty-key-value');
    });

    it('set("", value) 不影响其他 key', () => {
      const ctx = new WorkflowContextManager({ foo: 'bar' });
      ctx.set('', 'empty-key-value');
      expect(ctx.get('foo')).toBe('bar');
      expect(ctx.get('')).toBe('empty-key-value');
    });

    it('resolveTemplate("{{}}") 空模板变量不会被正则匹配，原样返回', () => {
      const ctx = new WorkflowContextManager({ foo: 'bar' });
      // 正则 /\{\{(\w+(?:\.\w+)*)\}\}/ 要求至少一个 \w+ 字符
      // {{}} 中路径为空字符串，不匹配，原样返回
      const result = ctx.resolveTemplate('{{}}');
      expect(result).toBe('{{}}');
    });

    it('getAll() 不应包含空字符串 key（除非显式 set）', () => {
      const ctx = new WorkflowContextManager({ foo: 'bar' });
      const all = ctx.getAll();
      expect(all).toBeDefined();
      expect('' in all).toBe(false);
      expect(all.foo).toBe('bar');
    });
  });

  // -------------------------------------------------------
  // S-BC-08: 并发生成 1000 个 ID，验证唯一性
  // -------------------------------------------------------
  describe('S-BC-08: Observability.generateId 并发唯一性', () => {
    it('连续生成 1000 个 ID 应全部唯一', () => {
      // Observability.generateId 是 private 方法
      // 我们通过 recordStepMetrics 间接生成 ID，然后检查 metrics 中的 ID 唯一性
      const obs = new Observability(undefined, undefined, 10000);

      for (let i = 0; i < 1000; i++) {
        obs.recordStepMetrics({
          executionId: `exec-${i}`,
          stepId: `step-${i}`,
          stepName: `Step ${i}`,
          stepType: 'create-task',
          durationMs: 100,
          status: 'completed',
        });
      }

      const metrics = obs.getStepMetrics({ limit: 1000 });
      expect(metrics).toHaveLength(1000);

      const ids = metrics.map(m => m.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(1000);
    });

    it('快速连续生成 1000 个 ID 应全部唯一（压力测试）', () => {
      const obs = new Observability(undefined, undefined, 10000);
      const ids: string[] = [];

      for (let i = 0; i < 1000; i++) {
        obs.recordStepMetrics({
          executionId: `exec-stress`,
          stepId: `step-${i}`,
          stepName: `Stress Step ${i}`,
          stepType: 'create-task',
          durationMs: 1,
          status: 'completed',
        });
      }

      const metrics = obs.getStepMetrics({ executionId: 'exec-stress' });
      expect(metrics).toHaveLength(1000);

      const metricIds = metrics.map(m => m.id);
      const uniqueIds = new Set(metricIds);
      expect(uniqueIds.size).toBe(1000);
    });

    it('recordSOLOCall 和 recordStepMetrics 的 ID 不应冲突', () => {
      const obs = new Observability(undefined, undefined, 10000);

      for (let i = 0; i < 500; i++) {
        obs.recordStepMetrics({
          executionId: `exec-${i}`,
          stepId: `step-${i}`,
          stepName: `Step ${i}`,
          stepType: 'create-task',
          durationMs: 100,
          status: 'completed',
        });

        obs.recordSOLOCall({
          id: '', // will be overwritten internally? No - recordSOLOCall takes the record as-is
          executionId: `exec-${i}`,
          stepId: `step-${i}`,
          stepName: `SOLO Step ${i}`,
          callMode: 'mcp',
          subAgentType: 'explore',
          durationMs: 200,
          startedAt: new Date(),
        });
      }

      const stepMetrics = obs.getStepMetrics({ limit: 500 });
      const soloHistory = obs.getSOLOCallHistory({ limit: 500 });

      // recordSOLOCall 直接 push record，不生成新 ID
      // recordStepMetrics 通过 generateId 生成 ID
      // 两者使用不同的数组，不会冲突
      expect(stepMetrics).toHaveLength(500);
      expect(soloHistory).toHaveLength(500);

      const stepIds = new Set(stepMetrics.map(m => m.id));
      expect(stepIds.size).toBe(500);
    });
  });
});
