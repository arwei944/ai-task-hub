import type { StepHandler, StepHandlerDeps, WorkflowStep } from '../types';

/**
 * foreach 步骤
 * 遍历数组，对每个元素执行子步骤
 */
export class ForEachStep implements StepHandler {
  constructor(private deps: StepHandlerDeps) {}

  async execute(config: Record<string, unknown>, context: Record<string, unknown>) {
    if (!this.deps.executor) {
      throw new Error('Executor is required for foreach step');
    }

    const items = config.items as unknown[] ?? [];
    const subSteps = (config.steps ?? []) as WorkflowStep[];
    const itemVar = String(config.itemVar ?? 'item');
    const indexVar = String(config.indexVar ?? 'index');

    if (subSteps.length === 0) {
      return { foreachResults: [], totalItems: 0 };
    }

    const results: Array<{
      index: number;
      item: unknown;
      status: string;
      error?: string;
    }> = [];

    for (let i = 0; i < items.length; i++) {
      const itemContext: Record<string, unknown> = {
        ...context,
        [itemVar]: items[i],
        [indexVar]: i,
        _foreachIndex: i,
        _foreachItem: items[i],
      };

      try {
        const stepResult = await this.deps.executor.executeStep({
          executionId: String(context._executionId ?? ''),
          step: { ...subSteps[0], id: `foreach-${i}` },
          contextManager: {
            getAll: () => itemContext,
            merge: (result: Record<string, unknown>) => Object.assign(itemContext, result),
            resolveTemplateVars: (obj: Record<string, unknown>) => obj,
            setExecutionMeta: () => {},
            getSoloSessionId: () => itemContext._soloSessionId as string | undefined,
            setSoloSessionId: (id: string) => { itemContext._soloSessionId = id; },
          },
          isCancelled: () => false,
          parentStepId: String(context._stepId ?? ''),
        });

        results.push({ index: i, item: items[i], status: stepResult.status ?? 'completed' });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        results.push({ index: i, item: items[i], status: 'failed', error: errorMsg });

        // 如果配置了 failFast，立即中断
        if (config.failFast) {
          throw new Error(`ForEach failed at index ${i}: ${errorMsg}`);
        }
      }
    }

    const failedCount = results.filter(r => r.status === 'failed').length;
    return {
      foreachResults: results,
      totalItems: items.length,
      successCount: items.length - failedCount,
      failedCount,
    };
  }
}
