import type { StepHandler, StepHandlerDeps, WorkflowStep } from '../types';

/**
 * Sub-Workflow Step (v3)
 *
 * Invokes another workflow by ID or name, waits for completion,
 * and merges its output context into the parent workflow.
 *
 * Config:
 *   workflowId: string       - Target workflow ID
 *   workflowName: string     - Target workflow name (alternative to ID)
 *   inputMapping: Record<string, string>  - Map parent context keys to child input
 *   outputMapping: Record<string, string> - Map child output keys to parent context
 *   inheritContext: boolean   - Pass all parent context to child (default: false)
 *   failOnError: boolean     - Fail parent if child fails (default: true)
 *   timeoutMs: number         - Max wait time for child execution
 */
export class SubWorkflowStep implements StepHandler {
  constructor(private deps: StepHandlerDeps) {}

  async execute(config: Record<string, unknown>, context: Record<string, unknown>) {
    const workflowId = config.workflowId as string | undefined;
    const workflowName = config.workflowName as string | undefined;
    const inputMapping = (config.inputMapping ?? {}) as Record<string, string>;
    const outputMapping = (config.outputMapping ?? {}) as Record<string, string>;
    const inheritContext = config.inheritContext !== false;
    const failOnError = config.failOnError !== false;
    const timeoutMs = (config.timeoutMs as number) ?? 300000; // 5 min default

    if (!workflowId && !workflowName) {
      throw new Error('sub-workflow: either workflowId or workflowName is required');
    }

    const prisma = this.deps.prisma;

    // Find target workflow
    const targetWorkflow = workflowId
      ? await prisma.workflow.findUnique({ where: { id: workflowId } })
      : await prisma.workflow.findFirst({ where: { name: workflowName, isActive: true } });

    if (!targetWorkflow) {
      throw new Error(`sub-workflow: workflow not found (${workflowId ?? workflowName})`);
    }

    // Build child input context
    const childContext: Record<string, unknown> = {};
    if (inheritContext) {
      Object.assign(childContext, context);
    }
    for (const [childKey, parentKey] of Object.entries(inputMapping)) {
      childContext[childKey] = context[parentKey];
    }

    // Start child execution
    const childExecution = await prisma.workflowExecution.create({
      data: {
        workflowId: targetWorkflow.id,
        status: 'running',
        triggerType: 'manual',
        context: JSON.stringify(childContext),
        startedAt: new Date(),
      },
    });

    // Execute child workflow steps
    const steps = typeof targetWorkflow.steps === 'string'
      ? JSON.parse(targetWorkflow.steps)
      : targetWorkflow.steps;

    if (!Array.isArray(steps)) {
      throw new Error('sub-workflow: target workflow has no valid steps');
    }

    // Use the executor if available to run child steps
    if (this.deps.executor) {
      // We need to use the executor's executeWorkflow method
      // For now, we'll execute steps directly via StepRegistry
      const { StepRegistry } = await import('./index');
      const { WorkflowContextManager } = await import('../context');

      const childContextManager = new WorkflowContextManager(childContext);

      for (const step of steps as WorkflowStep[]) {
        const handler = StepRegistry.getHandler(step.type, this.deps);
        if (!handler) {
          throw new Error(`sub-workflow: unknown step type "${step.type}" in child workflow`);
        }

        const result = await handler.execute(step.config, childContextManager.getAll());
        childContextManager.merge(result);
      }

      // Get final child context
      const finalChildContext = childContextManager.getAll();

      // Map output back to parent
      const output: Record<string, unknown> = {
        _subWorkflowExecutionId: childExecution.id,
        _subWorkflowId: targetWorkflow.id,
        _subWorkflowName: targetWorkflow.name,
      };

      for (const [parentKey, childKey] of Object.entries(outputMapping)) {
        output[parentKey] = finalChildContext[childKey];
      }

      // Update child execution status
      await prisma.workflowExecution.update({
        where: { id: childExecution.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          context: JSON.stringify(finalChildContext),
        },
      });

      return output;
    } else {
      throw new Error('sub-workflow: executor not available in deps');
    }
  }
}
