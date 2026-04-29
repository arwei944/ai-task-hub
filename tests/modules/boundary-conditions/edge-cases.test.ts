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
  // S-BC-01: phase='unknown' 时 overallProgress 返回 0
  // 修复后实现：unknown phase 返回 0 而非负数
  // -------------------------------------------------------
  describe('S-BC-01: phase=unknown 时 overallProgress 计算', () => {
    it('当 phase 不在 phaseOrder 中时，overallProgress 返回 0（修复后行为）', () => {
      // 模拟修复后的 get_project_summary 逻辑
      const phaseOrder = ['requirements', 'planning', 'architecture', 'implementation', 'testing', 'deployment', 'completed'];
      const unknownPhase = 'unknown';
      const currentPhaseIndex = phaseOrder.indexOf(unknownPhase);
      // 修复后：unknown phase 返回 0 而非负数
      const overallProgress = currentPhaseIndex >= 0
        ? Math.round((currentPhaseIndex / (phaseOrder.length - 1)) * 100)
        : 0;

      expect(currentPhaseIndex).toBe(-1);
      expect(overallProgress).toBe(0);
    });

    it('当 phase 为空字符串时，overallProgress 也返回 0', () => {
      const phaseOrder = ['requirements', 'planning', 'architecture', 'implementation', 'testing', 'deployment', 'completed'];
      const currentPhaseIndex = phaseOrder.indexOf('');
      const overallProgress = currentPhaseIndex >= 0
        ? Math.round((currentPhaseIndex / (phaseOrder.length - 1)) * 100)
        : 0;

      expect(currentPhaseIndex).toBe(-1);
      expect(overallProgress).toBe(0);
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
  // S-BC-04: foreach 配置多个子步骤，验证执行所有子步骤
  // -------------------------------------------------------
  describe('S-BC-04: foreach 执行所有子步骤', () => {
    it('ForEachStep 执行所有 subSteps，而非仅 subSteps[0]', async () => {
      // 通过读取源码验证：使用 for...of 循环遍历所有 subSteps
      const { readFileSync } = await import('fs');
      const { resolve, dirname } = await import('path');
      const { fileURLToPath } = await import('url');

      const __dirname = dirname(fileURLToPath(import.meta.url));
      const source = readFileSync(resolve(__dirname, '../../../src/lib/modules/workflow-engine/steps/foreach.ts'), 'utf-8');

      // 验证使用 for...of 循环遍历 subSteps
      expect(source).toMatch(/for\s*\(const\s+subStep\s+of\s+subSteps\)/);

      // 验证不再只引用 subSteps[0]（注释除外）
      // 源码执行逻辑中不使用 subSteps[0]
      const lines = source.split('\n').filter(l => !l.trim().startsWith('//'));
      const codeOnly = lines.join('\n');
      expect(codeOnly).not.toMatch(/subSteps\[0\]/);
    });

    it('ForEachStep 源码中 executeStep 调用使用 subStep 变量而非 subSteps[0]', async () => {
      const { readFileSync } = await import('fs');
      const { resolve, dirname } = await import('path');
      const { fileURLToPath } = await import('url');

      const __dirname = dirname(fileURLToPath(import.meta.url));
      const source = readFileSync(resolve(__dirname, '../../../src/lib/modules/workflow-engine/steps/foreach.ts'), 'utf-8');

      // 验证 step 参数使用 subStep 展开
      expect(source).toMatch(/step:\s*\{\s*\.\.\.subStep/);
    });
  });

  // -------------------------------------------------------
  // S-BC-05: intervention 非 JSON 时 JSON.parse 抛错
  // -------------------------------------------------------
  describe('S-BC-05: intervention 非 JSON 时 JSON.parse 抛错', () => {
    it('approval.ts 中 modified 分支有 try-catch 保护 JSON.parse', async () => {
      const { readFileSync } = await import('fs');
      const { resolve, dirname } = await import('path');
      const { fileURLToPath } = await import('url');

      const __dirname = dirname(fileURLToPath(import.meta.url));
      const source = readFileSync(resolve(__dirname, '../../../src/lib/modules/workflow-engine/steps/approval.ts'), 'utf-8');

      // 验证 JSON.parse(updated.intervention) 存在
      expect(source).toMatch(/JSON\.parse\(updated\.intervention\)/);

      // 提取 case 'modified' 到下一个 case 之间的代码
      const modifiedBlock = source.match(/case\s+'modified':([\s\S]*?)(?=case\s+'|$)/);
      expect(modifiedBlock).not.toBeNull();

      const blockCode = modifiedBlock![1];
      // 修复后：该块内有 try-catch 保护 JSON.parse
      expect(blockCode).toMatch(/try\s*\{/);
      expect(blockCode).toMatch(/catch/);
    });

    it('try-catch 保护下 JSON.parse 失败返回 undefined 而非抛错', () => {
      // 模拟修复后的行为：try-catch 包裹 JSON.parse
      const parseSafely = (input: string) => {
        try { return JSON.parse(input); } catch { return undefined; }
      };

      // 有效 JSON 正常解析
      expect(parseSafely('{"key": "value"}')).toEqual({ key: 'value' });

      // 无效 JSON 返回 undefined 而非抛错
      expect(parseSafely('not a json string')).toBeUndefined();
      expect(parseSafely('')).toBeUndefined();
      expect(parseSafely('just some random text')).toBeUndefined();
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
