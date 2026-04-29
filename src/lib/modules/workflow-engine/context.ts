import type { WorkflowContext, StepResult, IsolationLevel } from './types';

/** 工作区元信息 */
export interface WorkspaceInfo {
  id: string;
  createdAt: Date;
  stepCount: number;
}

/** 上下文隔离包装器 - 用于 'context' 隔离级别 */
class IsolatedContextWrapper {
  private ownContext: WorkflowContext;
  private parentContext: WorkflowContextManager | null;

  constructor(parentContext: WorkflowContextManager | null, initialVariables?: Record<string, unknown>) {
    this.parentContext = parentContext;
    this.ownContext = { ...(initialVariables ?? {}) };
  }

  get(key: string): unknown {
    // Read from own context first, fall back to parent
    const ownValue = this.ownContext[key];
    if (ownValue !== undefined) return ownValue;
    if (this.parentContext) return this.parentContext.get(key);
    return undefined;
  }

  set(key: string, value: unknown): void {
    // Writes always go to own context
    this.ownContext[key] = value;
  }

  merge(stepResult: StepResult): void {
    for (const [key, value] of Object.entries(stepResult)) {
      if (!key.startsWith('_')) {
        this.ownContext[key] = value;
      }
    }
  }

  getAll(): WorkflowContext {
    // Return own context merged with parent (parent as base, own overrides)
    if (this.parentContext) {
      return { ...this.parentContext.getAll(), ...this.ownContext };
    }
    return { ...this.ownContext };
  }

  resolveTemplate(template: string): string {
    return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, path) => {
      const value = this.getNestedValue(path);
      return value !== undefined ? String(value) : '';
    });
  }

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

  setExecutionMeta(params: {
    executionId: string;
    stepId: string;
    stepName: string;
    stepType: string;
    soloSessionId?: string;
    parallelIndex?: number;
    parentStepId?: string;
  }): void {
    this.ownContext._executionId = params.executionId;
    this.ownContext._stepId = params.stepId;
    this.ownContext._stepName = params.stepName;
    this.ownContext._stepType = params.stepType;
    if (params.soloSessionId) this.ownContext._soloSessionId = params.soloSessionId;
    if (params.parallelIndex !== undefined) this.ownContext._parallelIndex = params.parallelIndex;
    if (params.parentStepId) this.ownContext._parentStepId = params.parentStepId;
  }

  getSoloSessionId(): string | undefined {
    return this.ownContext._soloSessionId as string | undefined;
  }

  setSoloSessionId(sessionId: string): void {
    this.ownContext._soloSessionId = sessionId;
  }

  getStepCount(): number {
    let count = 0;
    for (const key of Object.keys(this.ownContext)) {
      if (!key.startsWith('_')) count++;
    }
    return count;
  }

  private getNestedValue(path: string): unknown {
    const parts = path.split('.');
    let current: unknown = this.get(parts[0]);
    for (let i = 1; i < parts.length; i++) {
      if (current === null || current === undefined) return undefined;
      if (typeof current === 'object') {
        current = (current as Record<string, unknown>)[parts[i]];
      } else {
        return undefined;
      }
    }
    return current;
  }
}

/**
 * 执行上下文管理器
 * 管理工作流执行过程中的上下文数据，支持模板变量解析
 */
export class WorkflowContextManager {
  private context: WorkflowContext;
  private workspaceId?: string;
  private isolationLevel?: IsolationLevel;
  private wrapper?: IsolatedContextWrapper;

  constructor(initialVariables?: Record<string, unknown>);
  constructor(initialVariables?: Record<string, unknown>, workspaceId?: string, isolationLevel?: IsolationLevel, wrapper?: IsolatedContextWrapper);
  constructor(
    initialVariables?: Record<string, unknown>,
    workspaceId?: string,
    isolationLevel?: IsolationLevel,
    wrapper?: IsolatedContextWrapper
  ) {
    this.workspaceId = workspaceId;
    this.isolationLevel = isolationLevel;
    this.wrapper = wrapper;

    if (wrapper) {
      // For isolated contexts, the wrapper manages the data
      this.context = {};
    } else {
      this.context = { ...(initialVariables ?? {}) };
    }
  }

  /** 获取工作区 ID */
  getWorkspaceId(): string | undefined {
    return this.workspaceId;
  }

  /** 获取隔离级别 */
  getIsolationLevel(): IsolationLevel | undefined {
    return this.isolationLevel;
  }

  /** 获取上下文值 */
  get(key: string): unknown {
    if (this.wrapper) return this.wrapper.get(key);
    return this.context[key];
  }

  /** 设置上下文值 */
  set(key: string, value: unknown): void {
    if (this.wrapper) {
      this.wrapper.set(key, value);
    } else {
      this.context[key] = value;
    }
  }

  /** 合并步骤输出到上下文 */
  merge(stepResult: StepResult): void {
    if (this.wrapper) {
      this.wrapper.merge(stepResult);
    } else {
      for (const [key, value] of Object.entries(stepResult)) {
        if (!key.startsWith('_')) {
          this.context[key] = value;
        }
      }
    }
  }

  /** 获取完整上下文副本 */
  getAll(): WorkflowContext {
    if (this.wrapper) return this.wrapper.getAll();
    return { ...this.context };
  }

  /** 解析模板变量 {{varName}} */
  resolveTemplate(template: string): string {
    if (this.wrapper) return this.wrapper.resolveTemplate(template);
    return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, path) => {
      const value = this.getNestedValue(path);
      return value !== undefined ? String(value) : '';
    });
  }

  /** 解析对象中的所有模板变量 */
  resolveTemplateVars(obj: Record<string, unknown>): Record<string, unknown> {
    if (this.wrapper) return this.wrapper.resolveTemplateVars(obj);
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
    if (this.wrapper) {
      this.wrapper.setExecutionMeta(params);
    } else {
      this.context._executionId = params.executionId;
      this.context._stepId = params.stepId;
      this.context._stepName = params.stepName;
      this.context._stepType = params.stepType;
      if (params.soloSessionId) this.context._soloSessionId = params.soloSessionId;
      if (params.parallelIndex !== undefined) this.context._parallelIndex = params.parallelIndex;
      if (params.parentStepId) this.context._parentStepId = params.parentStepId;
    }
  }

  /** 获取 SOLO 会话 ID */
  getSoloSessionId(): string | undefined {
    if (this.wrapper) return this.wrapper.getSoloSessionId();
    return this.context._soloSessionId as string | undefined;
  }

  /** 设置 SOLO 会话 ID */
  setSoloSessionId(sessionId: string): void {
    if (this.wrapper) {
      this.wrapper.setSoloSessionId(sessionId);
    } else {
      this.context._soloSessionId = sessionId;
    }
  }

  /** 获取上下文中的步骤数据数量（非内部字段） */
  getStepCount(): number {
    if (this.wrapper) return this.wrapper.getStepCount();
    let count = 0;
    for (const key of Object.keys(this.context)) {
      if (!key.startsWith('_')) count++;
    }
    return count;
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

/**
 * 工作区管理器
 * 管理隔离的工作区上下文命名空间
 */
export class WorkspaceManager {
  private static workspaces = new Map<string, {
    context: WorkflowContextManager;
    createdAt: Date;
    isolationLevel: IsolationLevel;
  }>();

  /**
   * 创建一个新的隔离工作区
   */
  static createWorkspace(
    workspaceId: string,
    isolationLevel: IsolationLevel,
    initialVariables?: Record<string, unknown>
  ): WorkflowContextManager {
    // Destroy existing workspace if any
    if (WorkspaceManager.workspaces.has(workspaceId)) {
      WorkspaceManager.destroyWorkspace(workspaceId);
    }

    let context: WorkflowContextManager;

    if (isolationLevel === 'none') {
      // No isolation - standard context
      context = new WorkflowContextManager(initialVariables, workspaceId, isolationLevel);
    } else if (isolationLevel === 'context') {
      // Context isolation - shared read, scoped writes
      // For context isolation, we create a wrapper with no parent initially
      // The parent can be set later if needed
      const wrapper = new IsolatedContextWrapper(null, initialVariables);
      context = new WorkflowContextManager(initialVariables, workspaceId, isolationLevel, wrapper);
    } else {
      // Full isolation - completely independent context
      context = new WorkflowContextManager(initialVariables, workspaceId, isolationLevel);
    }

    WorkspaceManager.workspaces.set(workspaceId, {
      context,
      createdAt: new Date(),
      isolationLevel,
    });

    return context;
  }

  /**
   * 获取指定工作区的上下文管理器
   */
  static getWorkspace(workspaceId: string): WorkflowContextManager | undefined {
    const entry = WorkspaceManager.workspaces.get(workspaceId);
    return entry?.context;
  }

  /**
   * 销毁指定工作区
   */
  static destroyWorkspace(workspaceId: string): void {
    WorkspaceManager.workspaces.delete(workspaceId);
  }

  /**
   * 列出所有工作区
   */
  static listWorkspaces(): WorkspaceInfo[] {
    const result: WorkspaceInfo[] = [];
    for (const [id, entry] of WorkspaceManager.workspaces) {
      result.push({
        id,
        createdAt: entry.createdAt,
        stepCount: entry.context.getStepCount(),
      });
    }
    return result;
  }

  /**
   * 检查工作区是否存在
   */
  static hasWorkspace(workspaceId: string): boolean {
    return WorkspaceManager.workspaces.has(workspaceId);
  }

  /**
   * 获取工作区的隔离级别
   */
  static getIsolationLevel(workspaceId: string): IsolationLevel | undefined {
    const entry = WorkspaceManager.workspaces.get(workspaceId);
    return entry?.isolationLevel;
  }

  /**
   * 清除所有工作区（主要用于测试）
   */
  static clearAll(): void {
    WorkspaceManager.workspaces.clear();
  }
}
