import type { WorkflowContext, StepResult, SOLOSubAgentType, SOLOCallMode } from './types';

export class WorkflowContextManager {
  private context: WorkflowContext;

  constructor(initialVariables?: Record<string, unknown>) {
    this.context = { ...(initialVariables ?? {}) };
  }

  get(key: string): unknown { return this.context[key]; }
  set(key: string, value: unknown): void { this.context[key] = value; }

  merge(stepResult: StepResult): void {
    for (const [key, value] of Object.entries(stepResult)) {
      if (!key.startsWith('_')) this.context[key] = value;
    }
  }

  getAll(): WorkflowContext { return { ...this.context }; }

  resolveTemplate(template: string): string {
    return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, path) => {
      const value = this.getNestedValue(path);
      return value !== undefined ? String(value) : '';
    });
  }

  resolveTemplateVars(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') result[key] = this.resolveTemplate(value);
      else if (typeof value === 'object' && value !== null && !Array.isArray(value))
        result[key] = this.resolveTemplateVars(value as Record<string, unknown>);
      else result[key] = value;
    }
    return result;
  }

  setExecutionMeta(params: {
    executionId: string; stepId: string; stepName: string; stepType: string;
    soloSessionId?: string; parallelIndex?: number; parentStepId?: string;
  }): void {
    this.context._executionId = params.executionId;
    this.context._stepId = params.stepId;
    this.context._stepName = params.stepName;
    this.context._stepType = params.stepType;
    if (params.soloSessionId) this.context._soloSessionId = params.soloSessionId;
    if (params.parallelIndex !== undefined) this.context._parallelIndex = params.parallelIndex;
    if (params.parentStepId) this.context._parentStepId = params.parentStepId;
  }

  getSoloSessionId(): string | undefined { return this.context._soloSessionId as string | undefined; }
  setSoloSessionId(sessionId: string): void { this.context._soloSessionId = sessionId; }

  private getNestedValue(path: string): unknown {
    const parts = path.split('.');
    let current: unknown = this.context;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current === 'object') current = (current as Record<string, unknown>)[part];
      else return undefined;
    }
    return current;
  }
}