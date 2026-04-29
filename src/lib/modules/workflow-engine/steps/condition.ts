import type { StepHandler, StepHandlerDeps, WorkflowStep } from '../types';

export class ConditionStep implements StepHandler {
  constructor(private deps: StepHandlerDeps) {}

  async execute(config: Record<string, unknown>, context: Record<string, unknown>) {
    const expression = String(config.expression ?? 'true');
    const thenSteps = (config.thenSteps ?? []) as WorkflowStep[];
    const elseSteps = (config.elseSteps ?? []) as WorkflowStep[];

    const result = this.evaluateExpression(expression, context);

    const branch = result ? 'then' : 'else';
    const branchSteps = result ? thenSteps : elseSteps;

    // Phase A: 返回分支信息，由 executor 决定是否继续执行
    // Phase B: executor 将自动执行分支步骤
    return {
      conditionResult: result,
      branch,
      branchSteps,
      branchStepCount: branchSteps.length,
    };
  }

  private evaluateExpression(expression: string, context: Record<string, unknown>): boolean {
    // 替换 {{var}} 引用为实际值
    const resolved = expression.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, path) => {
      const parts = path.split('.');
      let value: unknown = context;
      for (const part of parts) {
        if (value && typeof value === 'object') {
          value = (value as Record<string, unknown>)[part];
        } else {
          return 'undefined';
        }
      }
      return JSON.stringify(value);
    });

    // 安全求值（白名单字符）
    const safeExpr = resolved.replace(/[^=!<>""'\w\d.\s_-]/g, '').trim();
    if (!safeExpr) return false;

    try {
      // Build a safe evaluation scope without using `with()` (incompatible with strict mode)
      const keys = Object.keys(context);
      const values = Object.values(context);
      const fn = new Function(...keys, `"use strict"; return !!(${safeExpr});`);
      return fn(...values) === true;
    } catch {
      return false;
    }
  }
}
