import type { CreateWorkflowDTO, StepType, WorkflowStep } from '../types';

const VALID_STEP_TYPES: StepType[] = [
  'create-task', 'update-status', 'ai-analyze', 'send-notification', 'wait',
  'parallel-group', 'condition', 'foreach', 'invoke-agent', 'http-request', 'transform', 'approval',
];

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class WorkflowValidator {
  validate(dto: CreateWorkflowDTO): ValidationResult {
    const errors: string[] = [];
    if (!dto.name || dto.name.trim().length === 0) errors.push('Workflow name is required and must be non-empty');
    if (!dto.steps || dto.steps.length === 0) errors.push('Workflow must have at least one step');
    else { for (let i = 0; i < dto.steps.length; i++) { const stepErrors = this.validateStep(dto.steps[i], i); errors.push(...stepErrors); } }
    if (dto.retryPolicy) {
      if (dto.retryPolicy.max !== undefined && dto.retryPolicy.max < 0) errors.push('Retry policy max must be >= 0');
      if (dto.retryPolicy.delayMs !== undefined && dto.retryPolicy.delayMs < 0) errors.push('Retry policy delayMs must be >= 0');
    }
    if (dto.concurrencyLimit !== undefined && dto.concurrencyLimit < 1) errors.push('Concurrency limit must be >= 1');
    if (dto.timeoutMs !== undefined && dto.timeoutMs <= 0) errors.push('Timeout must be > 0');
    const circularErrors = this.detectCircularReferences(dto.steps);
    errors.push(...circularErrors);
    return { valid: errors.length === 0, errors };
  }

  private validateStep(step: WorkflowStep, index: number): string[] {
    const errors: string[] = [];
    const prefix = `Step ${index + 1} (${step.name || step.id})`;
    if (!step.type) errors.push(`${prefix}: step type is required`);
    else if (!VALID_STEP_TYPES.includes(step.type)) errors.push(`${prefix}: invalid step type '${step.type}'. Valid types: ${VALID_STEP_TYPES.join(', ')}`);
    if (!step.name || step.name.trim().length === 0) errors.push(`${prefix}: step name is required`);
    if (!step.id || step.id.trim().length === 0) errors.push(`${prefix}: step id is required`);
    if (step.condition) {
      if (step.condition.thenSteps) { for (let j = 0; j < step.condition.thenSteps.length; j++) { errors.push(...this.validateStep(step.condition.thenSteps[j], j).map(e => `${prefix} (condition.then[${j}]): ${e}`)); } }
      if (step.condition.elseSteps) { for (let j = 0; j < step.condition.elseSteps.length; j++) { errors.push(...this.validateStep(step.condition.elseSteps[j], j).map(e => `${prefix} (condition.else[${j}]): ${e}`)); } }
    }
    if (step.steps) { for (let j = 0; j < step.steps.length; j++) { errors.push(...this.validateStep(step.steps[j], j).map(e => `${prefix} (parallel[${j}]): ${e}`)); } }
    return errors;
  }

  private detectCircularReferences(steps: WorkflowStep[]): string[] {
    const errors: string[] = [];
    const stepIds = new Set(steps.map(s => s.id));
    const graph = new Map<string, Set<string>>();
    for (const step of steps) {
      const refs = new Set<string>();
      if (step.condition) { this.collectStepIds(step.condition.thenSteps, refs); this.collectStepIds(step.condition.elseSteps, refs); }
      if (step.steps) this.collectStepIds(step.steps, refs);
      graph.set(step.id, refs);
    }
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    for (const stepId of stepIds) {
      if (this.hasCycle(stepId, graph, visited, recursionStack, [])) {
        errors.push(`Circular reference detected involving step '${stepId}'`);
        break;
      }
    }
    return errors;
  }

  private collectStepIds(steps: WorkflowStep[] | undefined, ids: Set<string>): void {
    if (!steps) return;
    for (const step of steps) {
      ids.add(step.id);
      if (step.condition) { this.collectStepIds(step.condition.thenSteps, ids); this.collectStepIds(step.condition.elseSteps, ids); }
      if (step.steps) this.collectStepIds(step.steps, ids);
    }
  }

  private hasCycle(nodeId: string, graph: Map<string, Set<string>>, visited: Set<string>, recursionStack: Set<string>, path: string[]): boolean {
    if (recursionStack.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;
    visited.add(nodeId); recursionStack.add(nodeId); path.push(nodeId);
    const neighbors = graph.get(nodeId);
    if (neighbors) { for (const neighbor of neighbors) { if (this.hasCycle(neighbor, graph, visited, recursionStack, path)) return true; } }
    recursionStack.delete(nodeId); path.pop();
    return false;
  }
}

export function validateWorkflow(dto: CreateWorkflowDTO): ValidationResult {
  return new WorkflowValidator().validate(dto);
}
