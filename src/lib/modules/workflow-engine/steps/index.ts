import type { StepHandler } from '../types';

/**
 * 步骤处理器依赖
 */
export interface StepHandlerDeps {
  prisma: any;
  taskService: any;
  soloBridge?: any;
  executor?: any;
}

/**
 * 步骤注册表
 * 管理所有步骤类型的处理器
 */
class StepRegistryClass {
  private handlers = new Map<string, (deps: StepHandlerDeps) => StepHandler>();
  private handlerCache = new Map<string, StepHandler>();

  /** 注册步骤处理器 */
  register(type: string, factory: (deps: StepHandlerDeps) => StepHandler): void {
    this.handlers.set(type, factory);
    this.handlerCache.delete(type); // 清除缓存
  }

  /** 获取步骤处理器 */
  getHandler(type: string, deps: StepHandlerDeps): StepHandler | undefined {
    // 使用缓存
    const cacheKey = type;
    if (this.handlerCache.has(cacheKey)) {
      return this.handlerCache.get(cacheKey);
    }

    const factory = this.handlers.get(type);
    if (!factory) return undefined;

    const handler = factory(deps);
    this.handlerCache.set(cacheKey, handler);
    return handler;
  }

  /** 获取所有已注册的步骤类型 */
  getRegisteredTypes(): string[] {
    return Array.from(this.handlers.keys());
  }
}

export const StepRegistry = new StepRegistryClass();

// ===== 注册内置步骤处理器 =====

// create-task
StepRegistry.register('create-task', (deps) => {
  return {
    async execute(config: Record<string, unknown>, context: Record<string, unknown>) {
      const taskData = typeof config.task === 'object' ? (config.task as Record<string, unknown>) : {};
      const resolved: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(taskData)) {
        if (typeof value === 'string') {
          resolved[key] = value.replace(/\{\{(\w+)\}\}/g, (_, varName) => {
            return context[varName] !== undefined ? String(context[varName]) : '';
          });
        } else {
          resolved[key] = value;
        }
      }
      const task = await deps.taskService.createTask({
        title: String(resolved.title ?? 'Auto-created task'),
        description: resolved.description ? String(resolved.description) : undefined,
        priority: resolved.priority as 'urgent' | 'high' | 'medium' | 'low' | undefined,
        type: resolved.type ? String(resolved.type) : undefined,
        assignee: resolved.assignee ? String(resolved.assignee) : undefined,
      }, String(resolved.creator ?? 'workflow'));
      return { lastCreatedTaskId: task.id, lastCreatedTask: task };
    },
  };
});

// update-status
StepRegistry.register('update-status', (deps) => {
  return {
    async execute(config: Record<string, unknown>, context: Record<string, unknown>) {
      const taskId = String(config.taskId ?? context.lastCreatedTaskId ?? '');
      const newStatus = String(config.status ?? '');
      if (!taskId || !newStatus) {
        throw new Error('update-status requires taskId and status');
      }
      const task = await deps.taskService.updateStatus(
        taskId,
        newStatus as 'todo' | 'in_progress' | 'done' | 'closed',
        'workflow',
      );
      return { lastUpdatedTaskId: task.id, lastUpdatedTask: task };
    },
  };
});

// wait
StepRegistry.register('wait', () => {
  return {
    async execute(config: Record<string, unknown>) {
      const delayMs = Number(config.delayMs ?? config.seconds ? Number(config.seconds) * 1000 : 1000);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return { waitedMs: delayMs };
    },
  };
});

// send-notification (Phase A: 通过 EventBus 发射事件)
StepRegistry.register('send-notification', () => {
  return {
    async execute(config: Record<string, unknown>) {
      const message = String(config.message ?? 'Workflow notification');
      const channel = String(config.channel ?? 'system');
      const title = String(config.title ?? 'Workflow Notification');
      // Phase A: 简单返回，通知由 executor 层通过 observability 发射
      return {
        lastNotification: {
          channel,
          message,
          title,
          sentAt: new Date().toISOString(),
        },
      };
    },
  };
});

// ai-analyze (Phase A: 占位，Day 3 重写)
StepRegistry.register('ai-analyze', (deps) => {
  return {
    async execute(config: Record<string, unknown>, context: Record<string, unknown>) {
      if (!deps.soloBridge) {
        throw new Error('SOLO Bridge is required for ai-analyze step');
      }
      const mode = String(config.mode ?? 'analyze');
      const prompt = String(config.prompt ?? `Analyze: ${JSON.stringify(config.input ?? context)}`);
      const subAgentMap: Record<string, string> = {
        extract: 'explore',
        decompose: 'plan',
        'infer-status': 'explore',
        analyze: 'explore',
      };

      const result = await deps.soloBridge.call({
        prompt,
        stepId: String(context._stepId ?? ''),
        executionId: String(context._executionId ?? ''),
        stepName: String(context._stepName ?? 'ai-analyze'),
        subAgentType: (subAgentMap[mode] ?? 'explore') as any,
        sessionId: context._soloSessionId as string | undefined,
        context,
      });

      if (!result.success) throw new Error(`SOLO analysis failed: ${result.error}`);
      return {
        lastAiResult: result.data,
        _soloSessionId: result.sessionId,
      };
    },
  };
});

// parallel-group (Day 3 实现详细版本)
StepRegistry.register('parallel-group', (deps) => {
  return {
    async execute(config: Record<string, unknown>, context: Record<string, unknown>) {
      if (!deps.executor) {
        throw new Error('Executor is required for parallel-group step');
      }
      const subSteps = (config.steps ?? []) as any[];
      if (subSteps.length === 0) {
        return { parallelResults: [] };
      }

      const promises = subSteps.map((step: any, index: number) =>
        deps.executor.executeStep({
          executionId: String(context._executionId ?? ''),
          step,
          contextManager: {
            getAll: () => ({ ...context, _parallelIndex: index }),
            merge: () => {},
            resolveTemplateVars: (obj: any) => obj,
            setExecutionMeta: () => {},
            getSoloSessionId: () => undefined,
            setSoloSessionId: () => {},
          },
          isCancelled: () => false,
          parentStepId: String(context._stepId ?? ''),
        })
      );

      const results = await Promise.allSettled(promises);
      const parallelResults = results.map((r, i) => ({
        index: i,
        status: r.status === 'fulfilled' ? r.value.status : 'failed',
        error: r.status === 'fulfilled' ? r.value.error : String(r.reason),
      }));

      return { parallelResults };
    },
  };
});

// condition (Day 3 实现详细版本)
StepRegistry.register('condition', (deps) => {
  return {
    async execute(config: Record<string, unknown>, context: Record<string, unknown>) {
      const expression = String(config.expression ?? 'true');

      // 安全的表达式求值（仅支持简单比较）
      let result = false;
      try {
        result = this.evaluateExpression(expression, context);
      } catch (err) {
        throw new Error(`Condition evaluation failed: ${err instanceof Error ? err.message : String(err)}`);
      }

      if (result && config.thenSteps && Array.isArray(config.thenSteps)) {
        // Phase A: 简单返回分支信息
        return { conditionResult: true, branch: 'then', steps: config.thenSteps };
      } else if (!result && config.elseSteps && Array.isArray(config.elseSteps)) {
        return { conditionResult: false, branch: 'else', steps: config.elseSteps };
      }

      return { conditionResult: result, branch: result ? 'then' : 'else' };
    },

    evaluateExpression(expression: string, context: Record<string, unknown>): boolean {
      // 替换 {{var}} 引用
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

      // 安全求值：仅支持简单比较表达式
      // 格式: value === "string" | value === true | value > 10 等
      const safeExpr = resolved
        .replace(/[^=!<>""'\w\d.\s_-]/g, '') // 移除危险字符
        .trim();

      if (!safeExpr) return false;

      // 使用 Function 构造器进行安全求值（白名单模式）
      try {
        const fn = new Function('context', `
          "use strict";
          const __result = ${safeExpr};
          return typeof __result === "boolean" ? __result : !!__result;
        `);
        return fn(context) === true;
      } catch {
        return false;
      }
    },
  };
});

// Phase A 占位步骤类型
const placeholderTypes = ['foreach', 'invoke-agent', 'http-request', 'transform', 'approval'];

for (const type of placeholderTypes) {
  StepRegistry.register(type, () => ({
    async execute() {
      throw new Error(`Step type "${type}" is not yet implemented (planned for Phase B/C)`);
    },
  }));
}
