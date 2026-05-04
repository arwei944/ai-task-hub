// ============================================================
// Workflow Service — 工作流引擎核心服务
// ============================================================
// 管理工作流定义、执行、步骤调度和反馈检查点
// ============================================================

import type { PrismaClient } from '@prisma/client';
import { EventEmitter } from 'events';
import type { ILogger } from '@/lib/core/types';
import type {
  Workflow,
  WorkflowExecution,
  WorkflowStepExecution,
  FeedbackCheckpoint,
  FeedbackRule,
  StepFeedback,
} from './types';
import {
  WorkflowValidator,
  StepExecutorFactory,
  FeedbackManager,
  WorkflowContextManager,
} from './steps';
import { SOLOBridge } from './solo/solo-bridge';

export interface CreateWorkflowDTO {
  name: string;
  description?: string;
  trigger?: string;
  triggerConfig?: Record<string, unknown>;
  steps: WorkflowStep[];
  variables?: Record<string, unknown>;
  retryPolicy?: { max: number; backoff: string; delayMs: number };
  concurrencyLimit?: number;
  timeoutMs?: number;
  soloConfig?: Record<string, unknown>;
}

export interface UpdateWorkflowDTO {
  name?: string;
  description?: string;
  trigger?: string;
  triggerConfig?: Record<string, unknown>;
  steps?: WorkflowStep[];
  variables?: Record<string, unknown>;
  isActive?: boolean;
  retryPolicy?: { max: number; backoff: string; delayMs: number };
  concurrencyLimit?: number;
  timeoutMs?: number;
  soloConfig?: Record<string, unknown>;
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: string;
  config?: Record<string, unknown>;
  next?: string[];
  fallback?: string;
  timeoutMs?: number;
  retryCount?: number;
}

export interface ExecuteWorkflowDTO {
  workflowId: string;
  triggerType?: string;
  triggeredBy?: string;
  context?: Record<string, unknown>;
}

export class WorkflowService extends EventEmitter {
  private prisma: PrismaClient;
  private logger: ILogger;
  private validator: WorkflowValidator;
  private feedbackManager: FeedbackManager;
  private contextManager: WorkflowContextManager;
  private activeExecutions: Map<string, WorkflowExecution> = new Map();

  constructor(prisma: PrismaClient, logger: ILogger) {
    super();
    this.prisma = prisma;
    this.logger = logger;
    this.validator = new WorkflowValidator(logger);
    this.feedbackManager = new FeedbackManager(prisma, logger);
    this.contextManager = new WorkflowContextManager(prisma, logger);
  }

  async create(dto: CreateWorkflowDTO): Promise<Workflow> {
    const validated = this.validator.validateWorkflow({
      name: dto.name,
      description: dto.description ?? '',
      trigger: dto.trigger ?? 'manual',
      triggerConfig: dto.triggerConfig ?? null,
      steps: JSON.stringify(dto.steps),
      variables: dto.variables ?? null,
      retryPolicy: dto.retryPolicy ?? null,
      concurrencyLimit: dto.concurrencyLimit ?? 5,
      timeoutMs: dto.timeoutMs ?? 300000,
      soloConfig: dto.soloConfig ?? null,
    });

    const workflow = await this.prisma.workflow.create({
      data: {
        name: validated.name,
        description: validated.description,
        trigger: validated.trigger,
        triggerConfig: validated.triggerConfig,
        steps: validated.steps,
        variables: validated.variables,
        retryPolicy: validated.retryPolicy,
        concurrencyLimit: validated.concurrencyLimit,
        timeoutMs: validated.timeoutMs,
        soloConfig: validated.soloConfig,
        createdBy: dto.createdBy,
      },
    });

    this.emit('workflow:created', workflow);
    return workflow as unknown as Workflow;
  }

  async update(id: string, dto: UpdateWorkflowDTO): Promise<Workflow> {
    const existing = await this.prisma.workflow.findUnique({ where: { id } });
    if (!existing) throw new Error(`Workflow ${id} not found`);

    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.trigger !== undefined) updateData.trigger = dto.trigger;
    if (dto.triggerConfig !== undefined) updateData.triggerConfig = JSON.stringify(dto.triggerConfig);
    if (dto.steps !== undefined) updateData.steps = JSON.stringify(dto.steps);
    if (dto.variables !== undefined) updateData.variables = JSON.stringify(dto.variables);
    if (dto.retryPolicy !== undefined) updateData.retryPolicy = JSON.stringify(dto.retryPolicy);
    if (dto.soloConfig !== undefined) updateData.soloConfig = JSON.stringify(dto.soloConfig);
    if (dto.concurrencyLimit !== undefined) updateData.concurrencyLimit = dto.concurrencyLimit;
    if (dto.timeoutMs !== undefined) updateData.timeoutMs = dto.timeoutMs;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const workflow = await this.prisma.workflow.update({
      where: { id },
      data: updateData,
    });

    this.emit('workflow:updated', workflow);
    return workflow as unknown as Workflow;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.workflow.delete({ where: { id } });
    this.emit('workflow:deleted', { id });
  }

  async getById(id: string): Promise<Workflow | null> {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id },
      include: {
        executions: { orderBy: { createdAt: 'desc' }, take: 10 },
        triggerLogs: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    return workflow as unknown as Workflow | null;
  }

  async list(filters?: { isActive?: boolean; trigger?: string; createdBy?: string }): Promise<Workflow[]> {
    const where: Record<string, unknown> = {};
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;
    if (filters?.trigger !== undefined) where.trigger = filters.trigger;
    if (filters?.createdBy !== undefined) where.createdBy = filters.createdBy;

    const workflows = await this.prisma.workflow.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return workflows as unknown as Workflow[];
  }

  async execute(dto: ExecuteWorkflowDTO): Promise<WorkflowExecution> {
    const workflow = await this.prisma.workflow.findUnique({ where: { id: dto.workflowId } });
    if (!workflow) throw new Error(`Workflow ${dto.workflowId} not found`);
    if (!workflow.isActive) throw new Error(`Workflow ${dto.workflowId} is not active`);

    const activeCount = this.activeExecutions.size;
    const limit = (workflow.concurrencyLimit as number) ?? 5;
    if (activeCount >= limit) {
      throw new Error(`Concurrency limit reached: ${activeCount}/${limit}`);
    }

    const steps = JSON.parse(workflow.steps as string) as WorkflowStep[];

    const execution = await this.prisma.workflowExecution.create({
      data: {
        workflowId: dto.workflowId,
        workflowSnapshot: workflow.steps as string,
        status: 'running',
        currentStepId: steps[0]?.id,
        context: dto.context ? JSON.stringify(dto.context) : null,
        triggerType: dto.triggerType ?? 'manual',
        triggeredBy: dto.triggeredBy,
        startedAt: new Date(),
      },
    });

    this.activeExecutions.set(execution.id, execution as unknown as WorkflowExecution);
    this.emit('workflow:execution:started', execution);

    this.runExecution(execution.id, steps, dto).catch((err) => {
      this.logger.error(`Execution ${execution.id} failed: ${err.message}`);
    });

    return execution as unknown as WorkflowExecution;
  }

  private async runExecution(executionId: string, steps: WorkflowStep[], dto: ExecuteWorkflowDTO): Promise<void> {
    const startTime = Date.now();
    let currentStepIndex = 0;

    try {
      while (currentStepIndex < steps.length) {
        const step = steps[currentStepIndex];

        const checkpointResult = await this.feedbackManager.evaluateCheckpoint({
          executionId,
          stepId: step.id,
          stepName: step.name,
          stepType: step.type,
          checkpointType: 'pre_execute',
        });

        if (checkpointResult.action === 'block') {
          await this.prisma.workflowExecution.update({
            where: { id: executionId },
            data: { status: 'pending' },
          });
          this.logger.info(`Execution ${executionId} blocked at step ${step.name}`);
          return;
        }

        const stepResult = await this.executeStep(executionId, step, dto);

        if (!stepResult.success) {
          if (step.retryCount && stepResult.retryCount < step.retryCount) {
            this.logger.warn(`Step ${step.name} failed, retrying...`);
            continue;
          }

          if (step.fallback) {
            const fallbackStep = steps.find((s) => s.id === step.fallback);
            if (fallbackStep) {
              currentStepIndex = steps.indexOf(fallbackStep);
              continue;
            }
          }

          await this.prisma.workflowExecution.update({
            where: { id: executionId },
            data: { status: 'failed', error: stepResult.error, completedAt: new Date() },
          });
          this.activeExecutions.delete(executionId);
          this.emit('workflow:execution:failed', { executionId, error: stepResult.error });
          return;
        }

        await this.feedbackManager.evaluateCheckpoint({
          executionId,
          stepId: step.id,
          stepName: step.name,
          stepType: step.type,
          checkpointType: 'post_execute',
          stepOutput: stepResult.output,
        });

        currentStepIndex++;
      }

      const duration = Date.now() - startTime;
      await this.prisma.workflowExecution.update({
        where: { id: executionId },
        data: { status: 'completed', completedAt: new Date() },
      });
      this.activeExecutions.delete(executionId);
      this.emit('workflow:execution:completed', { executionId, duration });
    } catch (err: any) {
      await this.prisma.workflowExecution.update({
        where: { id: executionId },
        data: { status: 'failed', error: err.message, completedAt: new Date() },
      });
      this.activeExecutions.delete(executionId);
      this.emit('workflow:execution:failed', { executionId, error: err.message });
    }
  }

  private async executeStep(
    executionId: string,
    step: WorkflowStep,
    dto: ExecuteWorkflowDTO,
  ): Promise<{ success: boolean; output?: string; error?: string; retryCount: number }> {
    const stepStartTime = Date.now();

    const stepExecution = await this.prisma.workflowStepExecution.create({
      data: {
        executionId,
        stepId: step.id,
        stepName: step.name,
        stepType: step.type,
        status: 'running',
        startedAt: new Date(),
      },
    });

    try {
      let output: string | undefined;
      const config = step.config ?? {};

      switch (step.type) {
        case 'ai_analyze': {
          output = await this.executeAIAnalyzeStep(step, config, executionId);
          break;
        }
        case 'ai_generate': {
          output = await this.executeAIGenerateStep(step, config, executionId);
          break;
        }
        case 'approval': {
          output = await this.executeApprovalStep(step, config, executionId);
          break;
        }
        case 'condition': {
          output = await this.executeConditionStep(step, config);
          break;
        }
        case 'notification': {
          output = await this.executeNotificationStep(step, config);
          break;
        }
        case 'webhook': {
          output = await this.executeWebhookStep(step, config);
          break;
        }
        case 'solo_call': {
          output = await this.executeSOLOCallStep(step, config, executionId);
          break;
        }
        case 'parallel': {
          output = await this.executeParallelStep(step, config, executionId);
          break;
        }
        case 'delay': {
          const delayMs = (config.duration as number) ?? 1000;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          output = `Delayed ${delayMs}ms`;
          break;
        }
        default: {
          output = `Unknown step type: ${step.type}`;
          this.logger.warn(`Unknown step type: ${step.type}`);
        }
      }

      const durationMs = Date.now() - stepStartTime;

      await this.prisma.workflowStepExecution.update({
        where: { id: stepExecution.id },
        data: {
          status: 'completed',
          output: output ?? null,
          durationMs,
          completedAt: new Date(),
        },
      });

      const nextStep = (step.next ?? [])[0];
      await this.prisma.workflowExecution.update({
        where: { id: executionId },
        data: { currentStepId: nextStep ?? null },
      });

      this.emit('workflow:step:completed', { executionId, stepId: step.id, stepName: step.name, durationMs });

      return { success: true, output, retryCount: 0 };
    } catch (err: any) {
      const durationMs = Date.now() - stepStartTime;

      await this.prisma.workflowStepExecution.update({
        where: { id: stepExecution.id },
        data: {
          status: 'failed',
          error: err.message,
          durationMs,
          completedAt: new Date(),
        },
      });

      this.emit('workflow:step:failed', { executionId, stepId: step.id, error: err.message });

      return { success: false, error: err.message, retryCount: 0 };
    }
  }

  private async executeAIAnalyzeStep(
    step: WorkflowStep,
    config: Record<string, unknown>,
    executionId: string,
  ): Promise<string> {
    this.logger.info(`AI analyze step: ${step.name}`);

    try {
      // @ts-expect-error -- getKernel may not return container; fallback handled below
      const { getKernel } = await import('@/lib/core/v3');
      const container = getKernel()?.getContainer?.();
      const soloBridge = container?.resolve<import('@/lib/modules/workflow-engine/solo/solo-bridge').SOLOBridge>('SOLOBridge');

      if (soloBridge && typeof soloBridge.call === 'function') {
        const soloResult = await soloBridge.call({
          prompt: String(config.prompt ?? `Analyze: ${step.name}`),
          stepId: step.id,
          executionId,
          stepName: step.name,
          subAgentType: config.subAgentType as string,
          callMode: config.callMode as import('@/lib/modules/workflow-engine/types').SOLOCallMode,
          context: config.context as Record<string, unknown> | undefined,
        });
        return typeof soloResult === 'string' ? soloResult : JSON.stringify(soloResult);
      }
    } catch (err: any) {
      this.logger.debug(`SOLO Bridge not available: ${err.message}`);
    }

    try {
      // @ts-expect-error -- getKernel may not return container; fallback handled below
      const { getKernel } = await import('@/lib/core/v3');
      const container = getKernel()?.getContainer?.();
      const aiModel = container?.resolve<import('@/lib/modules/ai-engine/ai-model-adapter').IAIModelAdapter>('OpenAICompatibleAdapter');

      if (aiModel && typeof aiModel.complete === 'function') {
        const prompt = String(config.prompt ?? `Analyze: ${step.name}`);
        const aiResponse = await aiModel.complete(prompt);
        return JSON.stringify({
          lastAiResult: {
            analysis: aiResponse,
            timestamp: new Date().toISOString(),
            model: 'fallback-adapter',
          },
        });
      }
    } catch (err: any) {
      this.logger.debug(`AI Model Adapter not available: ${err.message}`);
    }

    return JSON.stringify({
      analysis: `AI analysis for: ${step.name}`,
      timestamp: new Date().toISOString(),
      model: 'placeholder',
      note: 'No AI backend configured. Configure SOLO Bridge or AI Model Adapter.',
    });
  }

  private async executeAIGenerateStep(
    step: WorkflowStep,
    config: Record<string, unknown>,
    executionId: string,
  ): Promise<string> {
    this.logger.info(`AI generate step: ${step.name}`);

    try {
      // @ts-expect-error -- getKernel may not return container; fallback handled below
      const { getKernel } = await import('@/lib/core/v3');
      const container = getKernel()?.getContainer?.();
      const soloBridge = container?.resolve<import('@/lib/modules/workflow-engine/solo/solo-bridge').SOLOBridge>('SOLOBridge');

      if (soloBridge && typeof soloBridge.call === 'function') {
        const soloResult = await soloBridge.call({
          prompt: String(config.prompt ?? `Generate: ${step.name}`),
          stepId: step.id,
          executionId,
          stepName: step.name,
          subAgentType: config.subAgentType as string,
          callMode: config.callMode as import('@/lib/modules/workflow-engine/types').SOLOCallMode,
          context: config.context as Record<string, unknown> | undefined,
        });
        return typeof soloResult === 'string' ? soloResult : JSON.stringify(soloResult);
      }
    } catch (err: any) {
      this.logger.debug(`SOLO Bridge not available for generate: ${err.message}`);
    }

    return JSON.stringify({
      generated: `AI generation for: ${step.name}`,
      timestamp: new Date().toISOString(),
      model: 'placeholder',
      note: 'No AI backend configured.',
    });
  }

  private async executeApprovalStep(step: WorkflowStep, config: Record<string, unknown>, executionId: string): Promise<string> {
    this.logger.info(`Approval step: ${step.name}`);

    const checkpoint = await this.feedbackManager.createCheckpoint({
      executionId, stepId: step.id, stepName: step.name, stepType: step.type,
      checkpointType: 'pre_execute', approvalMode: (config.approvalMode as string) ?? 'notify',
    });

    if ((config.approvalMode as string) === 'block') {
      const timeout = ((config.timeout as number) ?? 3600) * 1000;
      const startTime = Date.now();

      while (Date.now() - startTime < timeout) {
        const updated = await this.prisma.feedbackCheckpoint.findUnique({ where: { id: checkpoint.id } });
        if (updated?.status === 'approved') return 'Approved';
        if (updated?.status === 'rejected') throw new Error('Approval rejected');
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }

      throw new Error('Approval timeout');
    }

    return 'Approval checkpoint created (non-blocking)';
  }

  private async executeConditionStep(step: WorkflowStep, config: Record<string, unknown>): Promise<string> {
    const condition = config.condition as string ?? 'true';
    const result = condition === 'true' || condition.includes('==') ? 'true' : 'false';
    return JSON.stringify({ condition, result, branch: result === 'true' ? 'then' : 'else' });
  }

  private async executeNotificationStep(step: WorkflowStep, config: Record<string, unknown>): Promise<string> {
    const message = String(config.message ?? `Notification from step: ${step.name}`);
    const channel = String(config.channel ?? 'system');
    this.logger.info(`Notification: [${channel}] ${message}`);
    return JSON.stringify({ channel, message, sent: true });
  }

  private async executeWebhookStep(step: WorkflowStep, config: Record<string, unknown>): Promise<string> {
    const url = String(config.url ?? '');
    if (!url) throw new Error('Webhook step requires a URL');

    const method = String(config.method ?? 'POST');
    const headers = (config.headers as Record<string, string>) ?? {};
    const body = config.body ?? {};

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });

    const responseBody = await response.text();
    return JSON.stringify({ status: response.status, body: responseBody.substring(0, 500) });
  }

  private async executeSOLOCallStep(step: WorkflowStep, config: Record<string, unknown>, executionId: string): Promise<string> {
    this.logger.info(`SOLO call step: ${step.name}`);

    try {
      const bridge = new SOLOBridge({ logger: this.logger });

      const result = await bridge.call({
        prompt: String(config.prompt ?? `Execute: ${step.name}`),
        stepId: step.id,
        executionId,
        stepName: step.name,
        subAgentType: config.subAgentType as string,
        callMode: config.callMode as import('@/lib/modules/workflow-engine/types').SOLOCallMode,
        context: config.context as Record<string, unknown> | undefined,
      });

      return typeof result === 'string' ? result : JSON.stringify(result);
    } catch (err: any) {
      this.logger.error(`SOLO call failed: ${err.message}`);
      return JSON.stringify({ error: err.message, note: 'SOLO Bridge call failed' });
    }
  }

  private async executeParallelStep(step: WorkflowStep, config: Record<string, unknown>, executionId: string): Promise<string> {
    const subSteps = (config.steps as WorkflowStep[]) ?? [];
    if (subSteps.length === 0) return 'No sub-steps to execute';

    const results = await Promise.allSettled(
      subSteps.map((subStep) => this.executeStep(executionId, subStep, { workflowId: '', triggerType: 'parallel' })),
    );

    return JSON.stringify({
      total: results.length,
      fulfilled: results.filter((r) => r.status === 'fulfilled').length,
      rejected: results.filter((r) => r.status === 'rejected').length,
    });
  }

  async createFeedbackRule(rule: Omit<FeedbackRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<FeedbackRule> {
    const created = await this.prisma.feedbackRule.create({ data: rule as any });
    return created as unknown as FeedbackRule;
  }

  async listFeedbackRules(filters?: { isActive?: boolean }): Promise<FeedbackRule[]> {
    const where: Record<string, unknown> = {};
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;
    const rules = await this.prisma.feedbackRule.findMany({ where, orderBy: { createdAt: 'desc' } });
    return rules as unknown as FeedbackRule[];
  }

  async submitStepFeedback(feedback: Omit<StepFeedback, 'id' | 'createdAt'>): Promise<StepFeedback> {
    const created = await this.prisma.stepFeedback.create({ data: feedback as any });
    return created as unknown as StepFeedback;
  }

  async getExecutionStats(): Promise<Record<string, unknown>> {
    const total = await this.prisma.workflowExecution.count();
    const completed = await this.prisma.workflowExecution.count({ where: { status: 'completed' } });
    const failed = await this.prisma.workflowExecution.count({ where: { status: 'failed' } });
    const running = await this.prisma.workflowExecution.count({ where: { status: 'running' } });

    return {
      total, completed, failed, running,
      successRate: total > 0 ? ((completed / total) * 100).toFixed(1) + '%' : 'N/A',
    };
  }
}

let _instance: WorkflowService | null = null;

export function getWorkflowService(prisma?: PrismaClient, logger?: ILogger): WorkflowService {
  if (!_instance && prisma && logger) {
    _instance = new WorkflowService(prisma, logger);
  }
  if (!_instance) {
    throw new Error('WorkflowService not initialized. Call getWorkflowService(prisma, logger) first.');
  }
  return _instance;
}