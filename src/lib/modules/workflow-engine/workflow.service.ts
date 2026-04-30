import type { PrismaClient } from '@/generated/prisma/client';
import { Logger } from '@/lib/core/logger';
import type { TaskService } from '@/lib/modules/task-core/task.service';

// ==================== Types ====================

export interface WorkflowStep {
  id: string;
  name: string;
  type: 'create-task' | 'update-status' | 'ai-analyze' | 'send-notification' | 'wait';
  config: Record<string, unknown>;
  onError?: 'continue' | 'fail';
}

export interface CreateWorkflowDTO {
  name: string;
  description?: string;
  trigger?: string;
  triggerConfig?: string;
  steps: WorkflowStep[];
  variables?: Record<string, unknown>;
  createdBy?: string;
}

export interface UpdateWorkflowDTO {
  name?: string;
  description?: string;
  trigger?: string;
  triggerConfig?: string;
  steps?: WorkflowStep[];
  variables?: Record<string, unknown>;
  isActive?: boolean;
}

export interface ListWorkflowsOptions {
  page?: number;
  pageSize?: number;
  isActive?: boolean;
  createdBy?: string;
}

export interface ListExecutionsOptions {
  page?: number;
  pageSize?: number;
  status?: string;
}

// ==================== Service ====================

export class WorkflowService {
  private logger: Logger;
  private runningExecutions = new Map<string, boolean>();

  constructor(
    private prisma: PrismaClient,
    private taskService: TaskService,
    logger?: Logger,
  ) {
    this.logger = logger ?? new Logger('workflow-engine');
  }

  // --- CRUD ---

  async createWorkflow(dto: CreateWorkflowDTO) {
    this.logger.info(`Creating workflow: ${dto.name}`);
    return this.prisma.workflow.create({
      data: {
        name: dto.name,
        description: dto.description,
        trigger: dto.trigger ?? 'manual',
        triggerConfig: dto.triggerConfig,
        steps: JSON.stringify(dto.steps),
        variables: dto.variables ? JSON.stringify(dto.variables) : null,
        createdBy: dto.createdBy,
      },
    });
  }

  async updateWorkflow(id: string, dto: UpdateWorkflowDTO) {
    const existing = await this.prisma.workflow.findUnique({ where: { id } });
    if (!existing) throw new Error(`Workflow not found: ${id}`);

    this.logger.info(`Updating workflow ${id}`);
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.trigger !== undefined) data.trigger = dto.trigger;
    if (dto.triggerConfig !== undefined) data.triggerConfig = dto.triggerConfig;
    if (dto.steps !== undefined) data.steps = JSON.stringify(dto.steps);
    if (dto.variables !== undefined) data.variables = JSON.stringify(dto.variables);
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    return this.prisma.workflow.update({ where: { id }, data });
  }

  async deleteWorkflow(id: string) {
    const existing = await this.prisma.workflow.findUnique({ where: { id } });
    if (!existing) throw new Error(`Workflow not found: ${id}`);

    this.logger.info(`Deleting workflow ${id}`);
    await this.prisma.workflow.delete({ where: { id } });
    return { success: true };
  }

  async getWorkflow(id: string) {
    const workflow = await this.prisma.workflow.findUnique({ where: { id } });
    if (!workflow) throw new Error(`Workflow not found: ${id}`);
    return this.formatWorkflow(workflow);
  }

  async listWorkflows(options: ListWorkflowsOptions = {}) {
    const page = options.page ?? 1;
    const pageSize = options.pageSize ?? 20;

    const where: Record<string, unknown> = {};
    if (options.isActive !== undefined) where.isActive = options.isActive;
    if (options.createdBy) where.createdBy = options.createdBy;

    const [items, total] = await Promise.all([
      this.prisma.workflow.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.workflow.count({ where }),
    ]);

    return {
      items: items.map(this.formatWorkflow),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // --- Execution ---

  async runWorkflow(workflowId: string, triggeredBy?: string) {
    const workflow = await this.prisma.workflow.findUnique({ where: { id: workflowId } });
    if (!workflow) throw new Error(`Workflow not found: ${workflowId}`);
    if (!workflow.isActive) throw new Error(`Workflow is not active: ${workflowId}`);

    this.logger.info(`Starting workflow execution: ${workflowId}`);

    const steps: WorkflowStep[] = JSON.parse(workflow.steps);
    const execution = await this.prisma.workflowExecution.create({
      data: {
        workflowId,
        workflowSnapshot: JSON.stringify({
          id: workflow.id,
          name: workflow.name,
          steps: workflow.steps,
          variables: workflow.variables,
        }),
        status: 'running',
        triggerType: workflow.trigger,
        triggeredBy: triggeredBy ?? null,
        startedAt: new Date(),
        context: workflow.variables ?? '{}',
      },
    });

    // Run in background (fire-and-forget with error capture)
    this.executeSteps(execution.id, steps, workflow.variables).catch((err) => {
      this.logger.error(`Workflow execution failed: ${execution.id}`, { error: String(err) });
    });

    return execution;
  }

  private async executeSteps(
    executionId: string,
    steps: WorkflowStep[],
    initialVariables?: string | null,
  ) {
    this.runningExecutions.set(executionId, true);
    let context: Record<string, unknown> = initialVariables
      ? JSON.parse(initialVariables)
      : {};

    try {
      for (const step of steps) {
        // Check if execution was cancelled
        if (!this.runningExecutions.get(executionId)) {
          await this.prisma.workflowExecution.update({
            where: { id: executionId },
            data: { status: 'cancelled', completedAt: new Date() },
          });
          return;
        }

        const stepExec = await this.prisma.workflowStepExecution.create({
          data: {
            executionId,
            stepId: step.id,
            stepName: step.name,
            stepType: step.type,
            status: 'running',
            input: JSON.stringify({ config: step.config, context }),
            startedAt: new Date(),
          },
        });

        await this.prisma.workflowExecution.update({
          where: { id: executionId },
          data: { currentStepId: step.id },
        });

        const startTime = Date.now();
        try {
          const output = await this.executeStep(step, context);
          const durationMs = Date.now() - startTime;

          // Merge output into context
          if (output && typeof output === 'object') {
            context = { ...context, ...output };
          }

          await this.prisma.workflowStepExecution.update({
            where: { id: stepExec.id },
            data: {
              status: 'completed',
              output: JSON.stringify(output),
              completedAt: new Date(),
              durationMs,
            },
          });
        } catch (stepError) {
          const durationMs = Date.now() - startTime;
          const errorMsg = stepError instanceof Error ? stepError.message : String(stepError);

          await this.prisma.workflowStepExecution.update({
            where: { id: stepExec.id },
            data: {
              status: 'failed',
              error: errorMsg,
              completedAt: new Date(),
              durationMs,
            },
          });

          this.logger.warn(`Step ${step.name} failed: ${errorMsg}`);

          if (step.onError === 'continue') {
            context = { ...context, [`_error_${step.id}`]: errorMsg };
            continue;
          } else {
            await this.prisma.workflowExecution.update({
              where: { id: executionId },
              data: {
                status: 'failed',
                error: `Step "${step.name}" failed: ${errorMsg}`,
                completedAt: new Date(),
              },
            });
            return;
          }
        }
      }

      // All steps completed
      await this.prisma.workflowExecution.update({
        where: { id: executionId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          context: JSON.stringify(context),
        },
      });

      this.logger.info(`Workflow execution completed: ${executionId}`);
    } finally {
      this.runningExecutions.delete(executionId);
    }
  }

  private async executeStep(
    step: WorkflowStep,
    context: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const config = step.config;

    switch (step.type) {
      case 'create-task': {
        const taskData = typeof config.task === 'object' ? (config.task as Record<string, unknown>) : {};
        // Resolve template variables in task data
        const resolved = this.resolveTemplateVars(taskData, context);
        const task = await this.taskService.createTask({
          title: String(resolved.title ?? 'Auto-created task'),
          description: resolved.description ? String(resolved.description) : undefined,
          priority: resolved.priority as 'urgent' | 'high' | 'medium' | 'low' | undefined,
          type: resolved.type ? String(resolved.type) : undefined,
          assignee: resolved.assignee ? String(resolved.assignee) : undefined,
        }, String(resolved.creator ?? 'workflow'));
        return { lastCreatedTaskId: task.id, lastCreatedTask: task };
      }

      case 'update-status': {
        const taskId = String(config.taskId ?? context.lastCreatedTaskId ?? '');
        const newStatus = String(config.status ?? '');
        if (!taskId || !newStatus) {
          throw new Error('update-status requires taskId and status');
        }
        const task = await this.taskService.updateStatus(
          taskId,
          newStatus as 'todo' | 'in_progress' | 'done' | 'closed',
          'workflow',
        );
        return { lastUpdatedTaskId: task.id, lastUpdatedTask: task };
      }

      case 'ai-analyze': {
        // 尝试通过 SOLO Bridge 执行 AI 分析，不可用时降级到占位实现
        this.logger.info(`AI analyze step: ${step.name}`);

        try {
          // 尝试从 DI 容器获取 SOLOBridge
          const { getContainer } = await import('@/lib/core/di-container');
          const container = getContainer();
          const soloBridge = container?.resolve('SOLOBridge') as any;

          if (soloBridge && typeof soloBridge.call === 'function') {
            const soloResult = await soloBridge.call({
              prompt: String(config.prompt ?? `Analyze: ${step.name}`),
              stepId: step.id,
              executionId: context._executionId as string ?? 'unknown',
              stepName: step.name,
              subAgentType: config.subAgentType as any,
              callMode: config.callMode as any,
              context: config.context as Record<string, unknown> | undefined,
            });

            if (soloResult.success) {
              return {
                lastAiResult: {
                  analysis: soloResult.data,
                  sessionId: soloResult.sessionId,
                  durationMs: soloResult.durationMs,
                  tokensUsed: soloResult.tokensUsed,
                  timestamp: new Date().toISOString(),
                  source: 'solo-bridge',
                },
              };
            }

            // SOLO Bridge 调用失败，降级到 AI Model Adapter
            this.logger.warn(`SOLO Bridge call failed for step ${step.name}: ${soloResult.error}, falling back to AI Model Adapter`);
          }
        } catch (diError) {
          this.logger.debug(`SOLO Bridge not available for step ${step.name}: ${diError instanceof Error ? diError.message : String(diError)}`);
        }

        // 降级：尝试使用 AI Model Adapter
        try {
          const { getContainer } = await import('@/lib/core/di-container');
          const container = getContainer();
          const aiModel = container?.resolve('OpenAICompatibleAdapter') as any;

          if (aiModel && typeof aiModel.complete === 'function') {
            const prompt = String(config.prompt ?? `Analyze: ${step.name}`);
            const aiResponse = await aiModel.complete(prompt);
            return {
              lastAiResult: {
                analysis: aiResponse,
                timestamp: new Date().toISOString(),
                source: 'ai-model-adapter',
              },
            };
          }
        } catch (aiError) {
          this.logger.debug(`AI Model Adapter not available for step ${step.name}: ${aiError instanceof Error ? aiError.message : String(aiError)}`);
        }

        // 最终降级：占位实现
        this.logger.info(`AI analyze step (placeholder fallback): ${step.name}`);
        const result = {
          analysis: `AI analysis placeholder for: ${step.name}`,
          timestamp: new Date().toISOString(),
          input: config,
          source: 'placeholder',
        };
        return { lastAiResult: result };
      }

      case 'send-notification': {
        // Placeholder: log notification
        const message = String(config.message ?? 'Workflow notification');
        const channel = String(config.channel ?? 'system');
        this.logger.info(`Notification (${channel}): ${message}`);
        return { lastNotification: { channel, message, sentAt: new Date().toISOString() } };
      }

      case 'wait': {
        const delayMs = Number(config.delayMs ?? config.seconds ? Number(config.seconds) * 1000 : 1000);
        this.logger.info(`Waiting ${delayMs}ms (step: ${step.name})`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return { waitedMs: delayMs };
      }

      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  }

  private resolveTemplateVars(
    obj: Record<string, unknown>,
    context: Record<string, unknown>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        result[key] = value.replace(/\{\{(\w+)\}\}/g, (_, varName) => {
          return context[varName] !== undefined ? String(context[varName]) : '';
        });
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        result[key] = this.resolveTemplateVars(value as Record<string, unknown>, context);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  // --- Execution queries ---

  async getExecution(executionId: string) {
    const execution = await this.prisma.workflowExecution.findUnique({
      where: { id: executionId },
      include: {
        stepExecutions: { orderBy: { createdAt: 'asc' } },
        workflow: { select: { id: true, name: true } },
      },
    });
    if (!execution) throw new Error(`Execution not found: ${executionId}`);
    return {
      ...execution,
      workflowSnapshot: JSON.parse(execution.workflowSnapshot),
      context: execution.context ? JSON.parse(execution.context) : null,
    };
  }

  async listExecutions(workflowId: string, options: ListExecutionsOptions = {}) {
    const page = options.page ?? 1;
    const pageSize = options.pageSize ?? 20;

    const where: Record<string, unknown> = { workflowId };
    if (options.status) where.status = options.status;

    const [items, total] = await Promise.all([
      this.prisma.workflowExecution.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          workflow: { select: { id: true, name: true } },
        },
      }),
      this.prisma.workflowExecution.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async cancelExecution(executionId: string) {
    const execution = await this.prisma.workflowExecution.findUnique({
      where: { id: executionId },
    });
    if (!execution) throw new Error(`Execution not found: ${executionId}`);
    if (execution.status !== 'running' && execution.status !== 'pending') {
      throw new Error(`Cannot cancel execution in status: ${execution.status}`);
    }

    this.runningExecutions.set(executionId, false);
    await this.prisma.workflowExecution.update({
      where: { id: executionId },
      data: { status: 'cancelled', completedAt: new Date() },
    });

    this.logger.info(`Workflow execution cancelled: ${executionId}`);
    return { success: true };
  }

  // --- Helpers ---

  private formatWorkflow(workflow: any) {
    return {
      ...workflow,
      steps: JSON.parse(workflow.steps),
      variables: workflow.variables ? JSON.parse(workflow.variables) : null,
    };
  }
}
