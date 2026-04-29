import type { WorkflowContext, StepResult, SOLOSubAgentType, SOLOCallMode } from './types';

/**
 * 执行上下文管理器
 * 管理工作流执行过程中的上下文数据，支持模板变量解析
 */
export class WorkflowContextManager {
  private context: WorkflowContext;

  constructor(initialVariables?: Record<string, unknown>) {
    this.context = { ...(initialVariables ?? {}) };
  }

  /** 获取上下文值 */
  get(key: string): unknown {
    return this.context[key];
  }

  /** 设置上下文值 */
  set(key: string, value: unknown): void {
    this.context[key] = value;
  }

  /** 合并步骤输出到上下文 */
  merge(stepResult: StepResult): void {
    for (const [key, value] of Object.entries(stepResult)) {
      if (!key.startsWith('_')) {
        this.context[key] = value;
      }
    }
  }

  /** 获取完整上下文副本 */
  getAll(): WorkflowContext {
    return { ...this.context };
  }

  /** 解析模板变量 {{varName}} */
  resolveTemplate(template: string): string {
    return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, path) => {
      const value = this.getNestedValue(path);
      return value !== undefined ? String(value) : '';
    });
  }

  /** 解析对象中的所有模板变量 */
  resolveTemplateVars(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        result[key] = this.resolveTemplate(value);
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        result[key] = this.resolveTemplateVars(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  /** 设置内部执行字段 */
  setExecutionMeta(params: {
    executionId: string;
    stepId: string;
    stepName: string;
    stepType: string;
    soloSessionId?: string;
    parallelIndex?: number;
    parentStepId?: string;
  }): void {
    this.context._executionId = params.executionId;
    this.context._stepId = params.stepId;
    this.context._stepName = params.stepName;
    this.context._stepType = params.stepType;
    if (params.soloSessionId) this.context._soloSessionId = params.soloSessionId;
    if (params.parallelIndex !== undefined) this.context._parallelIndex = params.parallelIndex;
    if (params.parentStepId) this.context._parentStepId = params.parentStepId;
  }

  /** 获取 SOLO 会话 ID */
  getSoloSessionId(): string | undefined {
    return this.context._soloSessionId as string | undefined;
  }

  /** 设置 SOLO 会话 ID */
  setSoloSessionId(sessionId: string): void {
    this.context._soloSessionId = sessionId;
  }

  private getNestedValue(path: string): unknown {
    const parts = path.split('.');
    let current: unknown = this.context;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current === 'object') {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return current;
  }
}
