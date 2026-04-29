import type { StepHandler, StepHandlerDeps, WorkflowStep, StepResult } from '../types';
import type { WorkflowContextManager } from '../context';
import type { WorkflowExecutor } from '../executor';

export class ParallelGroupStep implements StepHandler {
  constructor(private deps: StepHandlerDeps) {}
  async execute(config: Record<string, unknown>, context: Record<string, unknown>) {
    if (!this.deps.executor) throw new Error('Executor is required for parallel-group step');
    const subSteps = (config.steps ?? []) as WorkflowStep[];
    if (subSteps.length === 0) return { parallelResults: [] };
    const executionId = String(context._executionId ?? '');
    const parentStepId = String(context._stepId ?? '');
    const promises = subSteps.map((step, index) => {
      const subContext: Record<string, unknown> = { ...context, _parallelIndex: index, _soloSessionId: undefined, _parentStepId: parentStepId };
      return this.deps.executor.executeStep({
        executionId, step,
        contextManager: {
          getAll: () => subContext, merge: (result: StepResult) => { Object.assign(subContext, result); },
          resolveTemplateVars: (obj: Record<string, unknown>) => obj, setExecutionMeta: () => {},
          getSoloSessionId: () => subContext._soloSessionId as string | undefined,
          setSoloSessionId: (id: string) => { subContext._soloSessionId = id; },
        }, isCancelled: () => false, parentStepId,
      });
    });
    const results = await Promise.allSettled(promises);
    const parallelResults = results.map((r, i) => ({ index: i, stepName: subSteps[i]?.name ?? `parallel-${i}`, status: r.status === 'fulfilled' ? r.value.status : 'failed', error: r.status === 'fulfilled' ? r.value.error : String(r.reason) }));
    const allSuccess = results.every(r => r.status === 'fulfilled' && r.value.status === 'completed');
    if (!allSuccess) { const failedCount = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.status !== 'completed')).length; throw new Error(`Parallel group: ${failedCount}/${subSteps.length} sub-steps failed`); }
    return { parallelResults };
  }
}