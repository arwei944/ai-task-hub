import type { StepHandler, StepHandlerDeps, WorkflowStep } from '../types';
import { StepRegistry } from './index';

/**
 * Dynamic Step (v3)
 *
 * Allows runtime addition and execution of steps that are not
 * predefined in the workflow definition. Steps can be:
 * - Provided directly in config
 * - Generated from a template with variable substitution
 * - Loaded from an external source (via context data)
 *
 * Config:
 *   steps: WorkflowStep[]     - Steps to execute dynamically
 *   stepsFromContext: string  - Key in context containing steps array
 *   template: WorkflowStep    - Step template with {{var}} placeholders
 *   parallel: boolean         - Execute steps in parallel (default: false)
 *   stopOnError: boolean      - Stop on first error (default: true)
 */
export class DynamicStep implements StepHandler {
  constructor(private deps: StepHandlerDeps) {}

  async execute(config: Record<string, unknown>, context: Record<string, unknown>) {
    const explicitSteps = config.steps as WorkflowStep[] | undefined;
    const contextKey = config.stepsFromContext as string | undefined;
    const template = config.template as WorkflowStep | undefined;
    const parallel = config.parallel === true;
    const stopOnError = config.stopOnError !== false;

    // Resolve steps from different sources
    let steps: WorkflowStep[] = [];

    if (explicitSteps && Array.isArray(explicitSteps)) {
      steps = explicitSteps;
    } else if (contextKey && context[contextKey]) {
      steps = context[contextKey] as WorkflowStep[];
    } else if (template) {
      // Generate step from template with variable substitution
      const resolvedTemplate = this.resolveTemplate(template, context);
      steps = [resolvedTemplate];
    }

    if (steps.length === 0) {
      return {
        _dynamicStepsExecuted: 0,
        _dynamicResults: [],
        message: 'No dynamic steps to execute',
      };
    }

    // Execute steps
    const results: Array<{
      stepName: string;
      stepType: string;
      status: 'completed' | 'failed';
      result?: unknown;
      error?: string;
      durationMs: number;
    }> = [];

    if (parallel) {
      // Parallel execution
      const promises = steps.map(async (step) => {
        const startTime = Date.now();
        try {
          const handler = StepRegistry.getHandler(step.type, this.deps);
          if (!handler) {
            throw new Error(`Unknown step type: ${step.type}`);
          }
          const resolvedConfig = this.resolveTemplateVars(step.config, context);
          const result = await handler.execute(resolvedConfig, context);
          const durationMs = Date.now() - startTime;
          return {
            stepName: step.name,
            stepType: step.type,
            status: 'completed' as const,
            result,
            durationMs,
          };
        } catch (error) {
          const durationMs = Date.now() - startTime;
          return {
            stepName: step.name,
            stepType: step.type,
            status: 'failed' as const,
            error: error instanceof Error ? error.message : String(error),
            durationMs,
          };
        }
      });

      const parallelResults = await Promise.all(promises);
      results.push(...parallelResults);
    } else {
      // Sequential execution
      for (const step of steps) {
        const startTime = Date.now();
        try {
          const handler = StepRegistry.getHandler(step.type, this.deps);
          if (!handler) {
            throw new Error(`Unknown step type: ${step.type}`);
          }
          const resolvedConfig = this.resolveTemplateVars(step.config, context);
          const result = await handler.execute(resolvedConfig, context);
          const durationMs = Date.now() - startTime;

          // Merge result into context for subsequent steps
          for (const [key, value] of Object.entries(result)) {
            if (!key.startsWith('_')) {
              context[key] = value;
            }
          }

          results.push({
            stepName: step.name,
            stepType: step.type,
            status: 'completed',
            result,
            durationMs,
          });
        } catch (error) {
          const durationMs = Date.now() - startTime;
          const errorResult = {
            stepName: step.name,
            stepType: step.type,
            status: 'failed' as const,
            error: error instanceof Error ? error.message : String(error),
            durationMs,
          };
          results.push(errorResult);

          if (stopOnError) break;
        }
      }
    }

    const succeeded = results.filter(r => r.status === 'completed').length;
    const failed = results.filter(r => r.status === 'failed').length;

    return {
      _dynamicStepsExecuted: results.length,
      _dynamicSucceeded: succeeded,
      _dynamicFailed: failed,
      _dynamicResults: results,
    };
  }

  private resolveTemplate(template: WorkflowStep, context: Record<string, unknown>): WorkflowStep {
    const json = JSON.stringify(template);
    const resolved = json.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, path) => {
      const parts = path.split('.');
      let value: unknown = context;
      for (const part of parts) {
        if (value && typeof value === 'object') {
          value = (value as Record<string, unknown>)[part];
        } else {
          return '';
        }
      }
      return typeof value === 'string' ? value : JSON.stringify(value ?? '');
    });
    return JSON.parse(resolved);
  }

  private resolveTemplateVars(config: Record<string, unknown>, context: Record<string, unknown>): Record<string, unknown> {
    const json = JSON.stringify(config);
    const resolved = json.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, path) => {
      const parts = path.split('.');
      let value: unknown = context;
      for (const part of parts) {
        if (value && typeof value === 'object') {
          value = (value as Record<string, unknown>)[part];
        } else {
          return '';
        }
      }
      return typeof value === 'string' ? value : JSON.stringify(value ?? '');
    });
    return JSON.parse(resolved);
  }
}
