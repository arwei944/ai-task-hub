import type { WorkflowContext, StepResult, IsolationLevel } from './types';

export interface WorkspaceInfo { id: string; createdAt: Date; stepCount: number; }

class IsolatedContextWrapper {
  private ownContext: WorkflowContext;
  private parentContext: WorkflowContextManager | null;
  constructor(parentContext: WorkflowContextManager | null, initialVariables?: Record<string, unknown>) { this.parentContext = parentContext; this.ownContext = { ...(initialVariables ?? {}) }; }
  get(key: string): unknown { const ownValue = this.ownContext[key]; if (ownValue !== undefined) return ownValue; if (this.parentContext) return this.parentContext.get(key); return undefined; }
  set(key: string, value: unknown): void { this.ownContext[key] = value; }
  merge(stepResult: StepResult): void { for (const [key, value] of Object.entries(stepResult)) { if (!key.startsWith('_')) this.ownContext[key] = value; } }
  getAll(): WorkflowContext { if (this.parentContext) return { ...this.parentContext.getAll(), ...this.ownContext }; return { ...this.ownContext }; }
  resolveTemplate(template: string): string { return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, path) => { const value = this.getNestedValue(path); return value !== undefined ? String(value) : ''; }); }
  resolveTemplateVars(obj: Record<string, unknown>): Record<string, unknown> { const result: Record<string, unknown> = {}; for (const [key, value] of Object.entries(obj)) { if (typeof value === 'string') result[key] = this.resolveTemplate(value); else if (typeof value === 'object' && value !== null && !Array.isArray(value)) result[key] = this.resolveTemplateVars(value as Record<string, unknown>); else result[key] = value; } return result; }
  setExecutionMeta(params: { executionId: string; stepId: string; stepName: string; stepType: string; soloSessionId?: string; parallelIndex?: number; parentStepId?: string; }): void { this.ownContext._executionId = params.executionId; this.ownContext._stepId = params.stepId; this.ownContext._stepName = params.stepName; this.ownContext._stepType = params.stepType; if (params.soloSessionId) this.ownContext._soloSessionId = params.soloSessionId; if (params.parallelIndex !== undefined) this.ownContext._parallelIndex = params.parallelIndex; if (params.parentStepId) this.ownContext._parentStepId = params.parentStepId; }
  getSoloSessionId(): string | undefined { return this.ownContext._soloSessionId as string | undefined; }
  setSoloSessionId(sessionId: string): void { this.ownContext._soloSessionId = sessionId; }
  getStepCount(): number { let count = 0; for (const key of Object.keys(this.ownContext)) { if (!key.startsWith('_')) count++; } return count; }
  private getNestedValue(path: string): unknown { const parts = path.split('.'); let current: unknown = this.get(parts[0]); for (let i = 1; i < parts.length; i++) { if (current === null || current === undefined) return undefined; if (typeof current === 'object') current = (current as Record<string, unknown>)[parts[i]]; else return undefined; } return current; }
}

export class WorkflowContextManager {
  private context: WorkflowContext;
  private workspaceId?: string;
  private isolationLevel?: IsolationLevel;
  private wrapper?: IsolatedContextWrapper;
  constructor(initialVariables?: Record<string, unknown>);
  constructor(initialVariables?: Record<string, unknown>, workspaceId?: string, isolationLevel?: IsolationLevel, wrapper?: IsolatedContextWrapper);
  constructor(initialVariables?: Record<string, unknown>, workspaceId?: string, isolationLevel?: IsolationLevel, wrapper?: IsolatedContextWrapper) { this.workspaceId = workspaceId; this.isolationLevel = isolationLevel; this.wrapper = wrapper; if (wrapper) this.context = {}; else this.context = { ...(initialVariables ?? {}) }; }
  getWorkspaceId(): string | undefined { return this.workspaceId; }
  getIsolationLevel(): IsolationLevel | undefined { return this.isolationLevel; }
  get(key: string): unknown { if (this.wrapper) return this.wrapper.get(key); return this.context[key]; }
  set(key: string, value: unknown): void { if (this.wrapper) this.wrapper.set(key, value); else this.context[key] = value; }
  merge(stepResult: StepResult): void { if (this.wrapper) this.wrapper.merge(stepResult); else { for (const [key, value] of Object.entries(stepResult)) { if (!key.startsWith('_')) this.context[key] = value; } } }
  getAll(): WorkflowContext { if (this.wrapper) return this.wrapper.getAll(); return { ...this.context }; }
  resolveTemplate(template: string): string { if (this.wrapper) return this.wrapper.resolveTemplate(template); return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, path) => { const value = this.getNestedValue(path); return value !== undefined ? String(value) : ''; }); }
  resolveTemplateVars(obj: Record<string, unknown>): Record<string, unknown> { if (this.wrapper) return this.wrapper.resolveTemplateVars(obj); const result: Record<string, unknown> = {}; for (const [key, value] of Object.entries(obj)) { if (typeof value === 'string') result[key] = this.resolveTemplate(value); else if (typeof value === 'object' && value !== null && !Array.isArray(value)) result[key] = this.resolveTemplateVars(value as Record<string, unknown>); else result[key] = value; } return result; }
  setExecutionMeta(params: { executionId: string; stepId: string; stepName: string; stepType: string; soloSessionId?: string; parallelIndex?: number; parentStepId?: string; }): void { if (this.wrapper) this.wrapper.setExecutionMeta(params); else { this.context._executionId = params.executionId; this.context._stepId = params.stepId; this.context._stepName = params.stepName; this.context._stepType = params.stepType; if (params.soloSessionId) this.context._soloSessionId = params.soloSessionId; if (params.parallelIndex !== undefined) this.context._parallelIndex = params.parallelIndex; if (params.parentStepId) this.context._parentStepId = params.parentStepId; } }
  getSoloSessionId(): string | undefined { if (this.wrapper) return this.wrapper.getSoloSessionId(); return this.context._soloSessionId as string | undefined; }
  setSoloSessionId(sessionId: string): void { if (this.wrapper) this.wrapper.setSoloSessionId(sessionId); else this.context._soloSessionId = sessionId; }
  getStepCount(): number { if (this.wrapper) return this.wrapper.getStepCount(); let count = 0; for (const key of Object.keys(this.context)) { if (!key.startsWith('_')) count++; } return count; }
  private getNestedValue(path: string): unknown { const parts = path.split('.'); let current: unknown = this.context; for (const part of parts) { if (current === null || current === undefined) return undefined; if (typeof current === 'object') current = (current as Record<string, unknown>)[part]; else return undefined; } return current; }
}

export class WorkspaceManager {
  private static workspaces = new Map<string, { context: WorkflowContextManager; createdAt: Date; isolationLevel: IsolationLevel; }>();
  static createWorkspace(workspaceId: string, isolationLevel: IsolationLevel, initialVariables?: Record<string, unknown>): WorkflowContextManager { if (WorkspaceManager.workspaces.has(workspaceId)) WorkspaceManager.destroyWorkspace(workspaceId); let context: WorkflowContextManager; if (isolationLevel === 'none') { context = new WorkflowContextManager(initialVariables, workspaceId, isolationLevel); } else if (isolationLevel === 'context') { const wrapper = new IsolatedContextWrapper(null, initialVariables); context = new WorkflowContextManager(initialVariables, workspaceId, isolationLevel, wrapper); } else { context = new WorkflowContextManager(initialVariables, workspaceId, isolationLevel); } WorkspaceManager.workspaces.set(workspaceId, { context, createdAt: new Date(), isolationLevel }); return context; }
  static getWorkspace(workspaceId: string): WorkflowContextManager | undefined { return WorkspaceManager.workspaces.get(workspaceId)?.context; }
  static destroyWorkspace(workspaceId: string): void { WorkspaceManager.workspaces.delete(workspaceId); }
  static listWorkspaces(): WorkspaceInfo[] { const result: WorkspaceInfo[] = []; for (const [id, entry] of WorkspaceManager.workspaces) { result.push({ id, createdAt: entry.createdAt, stepCount: entry.context.getStepCount() }); } return result; }
  static hasWorkspace(workspaceId: string): boolean { return WorkspaceManager.workspaces.has(workspaceId); }
  static getIsolationLevel(workspaceId: string): IsolationLevel | undefined { return WorkspaceManager.workspaces.get(workspaceId)?.isolationLevel; }
  static clearAll(): void { WorkspaceManager.workspaces.clear(); }
}