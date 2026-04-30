import type { StepHandler, StepHandlerDeps } from '../types';
import { CreateTaskStep } from './create-task';
import { UpdateStatusStep } from './update-status';
import { AIAnalyzeStep } from './ai-analyze';
import { SendNotificationStep } from './send-notification';
import { WaitStep } from './wait';
import { ParallelGroupStep } from './parallel-group';
import { ConditionStep } from './condition';
import { InvokeAgentStep } from './invoke-agent';
import { ForEachStep } from './foreach';
import { ApprovalStep } from './approval';
import { HttpRequestStep } from './http-request';
import { TransformStep } from './transform';
import { SubWorkflowStep } from './sub-workflow';
import { DynamicStep } from './dynamic-step';

export type { StepHandlerDeps } from '../types';

class StepRegistryClass {
  private factories = new Map<string, (deps: StepHandlerDeps) => StepHandler>();

  register(type: string, factory: (deps: StepHandlerDeps) => StepHandler): void {
    this.factories.set(type, factory);
  }

  getHandler(type: string, deps: StepHandlerDeps): StepHandler | undefined {
    const factory = this.factories.get(type);
    if (!factory) return undefined;
    return factory(deps);
  }

  getRegisteredTypes(): string[] {
    return Array.from(this.factories.keys());
  }
}

export const StepRegistry = new StepRegistryClass();

// Register built-in step handlers
StepRegistry.register('create-task', (deps) => new CreateTaskStep(deps));
StepRegistry.register('update-status', (deps) => new UpdateStatusStep(deps));
StepRegistry.register('ai-analyze', (deps) => new AIAnalyzeStep(deps));
StepRegistry.register('send-notification', (deps) => new SendNotificationStep(deps));
StepRegistry.register('wait', () => new WaitStep());
StepRegistry.register('parallel-group', (deps) => new ParallelGroupStep(deps));
StepRegistry.register('condition', (deps) => new ConditionStep(deps));
StepRegistry.register('invoke-agent', (deps) => new InvokeAgentStep(deps));
StepRegistry.register('foreach', (deps) => new ForEachStep(deps));
StepRegistry.register('approval', (deps) => new ApprovalStep(deps));
StepRegistry.register('http-request', () => new HttpRequestStep());
StepRegistry.register('transform', () => new TransformStep());
StepRegistry.register('sub-workflow', (deps) => new SubWorkflowStep(deps));
StepRegistry.register('dynamic-step', (deps) => new DynamicStep(deps));
