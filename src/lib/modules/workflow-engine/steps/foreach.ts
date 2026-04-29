import type { StepHandler, StepHandlerDeps, WorkflowStep } from '../types';

/**
 * foreach 步骤
 * 遍历数组，对每个元素执行子步骤
 * 支持 concurrency 配置的并行执行
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
    const concurrency = typeof config.concurrency === 'number' ? config.concurrency : 5;
    const failFast = config.failFast === true;

    if (subSteps.length === 0) {
      return { foreachResults: [], totalItems: 0 };
    }

    const results: Array<{
      index: number;
      item: unknown;
      status: string;
      error?: string;
    }> = [];

    // Execute a single item's subSteps sequentially
    const executeItem = async (i: number): Promise<{ index: number; item: unknown; status: string; error?: string }> => {
      const itemContext: Record<string, unknown> = {
        ...context,
        [itemVar]: items[i],
        [indexVar]: i,
        _foreachIndex: i,
        _foreachItem: items[i],
      };

      // Execute all subSteps sequentially for this item
      for (const subStep of subSteps) {
        await this.deps.executor!.executeStep({
          executionId: String(context._executionId ?? ''),
          step: { ...subStep, id: `foreach-${i}-${subStep.id ?? 'step'}` },
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
      }

      return { index: i, item: items[i], status: 'completed' };
    };

    // Process items in batches of `concurrency`
    const indices = items.map((_, i) => i);

    for (let batchStart = 0; batchStart < indices.length; batchStart += concurrency) {
      const batchIndices = indices.slice(batchStart, batchStart + concurrency);

      if (failFast) {
        // failFast: use Promise.all - one failure interrupts the batch
        const batchResults = await Promise.all(
          batchIndices.map(async (i) => {
            try {
              return await executeItem(i);
            } catch (err) {
              const errorMsg = err instanceof Error ? err.message : String(err);
              return { index: i, item: items[i], status: 'failed' as const, error: errorMsg };
            }
          }),
        );
        results.push(...batchResults);

        // Check if any item in this batch failed
        const firstFailure = batchResults.find(r => r.status === 'failed');
        if (firstFailure) {
          throw new Error(`ForEach failed at index ${firstFailure.index}: ${firstFailure.error}`);
        }
      } else {
        // failFast: false (default) - use Promise.allSettled to collect all results
        const batchPromises = batchIndices.map(async (i) => {
          try {
            return await executeItem(i);
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            return { index: i, item: items[i], status: 'failed' as const, error: errorMsg };
          }
        });

        const batchResults = await Promise.allSettled(batchPromises);
        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            // This should not happen since we catch errors in executeItem,
            // but handle it defensively
            const i = batchIndices[batchResults.indexOf(result)];
            const errorMsg = result.reason instanceof Error ? result.reason.message : String(result.reason);
            results.push({ index: i, item: items[i], status: 'failed', error: errorMsg });
          }
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
