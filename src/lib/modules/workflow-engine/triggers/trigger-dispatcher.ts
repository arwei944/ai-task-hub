import type { PrismaClient } from '@/generated/prisma/client';
import type { Logger } from '@/lib/core/logger';
import type { EventBus } from '@/lib/core/event-bus';
import type { WorkflowOrchestrator } from '../orchestrator';
import type { TriggerType } from '../types';

/**
 * 触发调度器
 * 管理所有触发器类型，负责将触发事件分发到对应的工作流
 */
export class TriggerDispatcher {
  private scheduledJobs = new Map<string, ReturnType<typeof setInterval>>();
  private eventListeners: Array<{ workflowId: string; unsubscribe: () => void }> = [];

  constructor(
    private prisma: PrismaClient,
    private orchestrator: WorkflowOrchestrator,
    private eventBus?: EventBus,
    private logger?: Logger,
  ) {}

  /**
   * 注册工作流的触发器
   */
  async registerWorkflowTrigger(params: {
    workflowId: string;
    trigger: TriggerType;
    triggerConfig?: string;
  }): Promise<void> {
    const { workflowId, trigger, triggerConfig } = params;

    // 先清理旧的触发器
    await this.unregisterWorkflowTrigger(workflowId);

    switch (trigger) {
      case 'schedule':
        if (triggerConfig) {
          this.registerScheduleTrigger(workflowId, triggerConfig);
        }
        break;
      case 'event':
        if (triggerConfig) {
          this.registerEventTrigger(workflowId, triggerConfig);
        }
        break;
      case 'github-issue':
        // GitHub Issues 触发通过 webhook 接收，不需要主动注册
        break;
      case 'webhook':
        // Webhook 触发通过 API 端点接收
        break;
      case 'manual':
        // 手动触发不需要注册
        break;
    }

    this.logger?.info(`Registered trigger "${trigger}" for workflow ${workflowId}`);
  }

  /**
   * 注销工作流的触发器
   */
  async unregisterWorkflowTrigger(workflowId: string): Promise<void> {
    // 清理定时任务
    const job = this.scheduledJobs.get(workflowId);
    if (job) {
      clearInterval(job);
      this.scheduledJobs.delete(workflowId);
    }

    // 清理事件监听 - 只移除该 workflow 的监听器
    this.eventListeners = this.eventListeners.filter(listener => {
      if (listener.workflowId === workflowId) {
        if (listener.unsubscribe) {
          listener.unsubscribe();
        }
        return false;
      }
      return true;
    });

    this.logger?.info(`Unregistered triggers for workflow ${workflowId}`);
  }

  /**
   * 手动触发工作流
   */
  async manualTrigger(workflowId: string, triggeredBy?: string): Promise<{ executionId: string; status: string }> {
    const workflow = await this.prisma.workflow.findUnique({ where: { id: workflowId } });
    if (!workflow) throw new Error(`Workflow not found: ${workflowId}`);
    if (!workflow.isActive) throw new Error(`Workflow is not active: ${workflowId}`);

    const steps = JSON.parse(workflow.steps ?? '[]');
    const variables = workflow.variables ? JSON.parse(workflow.variables) : undefined;

    return this.orchestrator.startExecution({
      workflowId,
      workflowName: workflow.name,
      steps,
      variables,
      triggerType: 'manual',
      triggeredBy,
      timeoutMs: workflow.timeoutMs,
    });
  }

  /**
   * Webhook 触发
   */
  async webhookTrigger(workflowId: string, payload: Record<string, unknown>): Promise<{ executionId: string; status: string }> {
    const workflow = await this.prisma.workflow.findUnique({ where: { id: workflowId } });
    if (!workflow) throw new Error(`Workflow not found: ${workflowId}`);

    const steps = JSON.parse(workflow.steps ?? '[]');
    const baseVariables = workflow.variables ? JSON.parse(workflow.variables) : {};
    const variables = { ...baseVariables, webhookPayload: payload };

    return this.orchestrator.startExecution({
      workflowId,
      workflowName: workflow.name,
      steps,
      variables,
      triggerType: 'webhook',
      timeoutMs: workflow.timeoutMs,
    });
  }

  /**
   * 注册 schedule 触发器
   */
  private registerScheduleTrigger(workflowId: string, triggerConfig: string): void {
    let config: { cron?: string; intervalMs?: number };
    try {
      config = JSON.parse(triggerConfig);
    } catch {
      this.logger?.error(`Invalid schedule config for workflow ${workflowId}`);
      return;
    }

    if (config.intervalMs) {
      // 简单间隔触发
      const job = setInterval(async () => {
        try {
          await this.executeTriggeredWorkflow(workflowId, 'schedule');
        } catch (err) {
          this.logger?.error(`Schedule trigger failed for workflow ${workflowId}`, { error: String(err) });
        }
      }, config.intervalMs);

      this.scheduledJobs.set(workflowId, job);
      this.logger?.info(`Registered interval trigger for workflow ${workflowId}: every ${config.intervalMs}ms`);
    } else if (config.cron) {
      // Cron 表达式触发 (Phase B: 简单实现)
      this.registerCronTrigger(workflowId, config.cron);
    }
  }

  /**
   * 注册 cron 触发器（简化版）
   * 支持: 每分钟、每小时、每天、每周、每月
   */
  private registerCronTrigger(workflowId: string, cronExpr: string): void {
    const intervalMs = this.cronToInterval(cronExpr);
    if (!intervalMs) {
      this.logger?.error(`Unsupported cron expression: ${cronExpr}`);
      return;
    }

    const job = setInterval(async () => {
      try {
        // 检查是否到了执行时间
        if (this.shouldExecuteCron(cronExpr)) {
          await this.executeTriggeredWorkflow(workflowId, 'schedule');
        }
      } catch (err) {
        this.logger?.error(`Cron trigger failed for workflow ${workflowId}`, { error: String(err) });
      }
    }, Math.min(intervalMs, 60000)); // 最多每分钟检查一次

    this.scheduledJobs.set(workflowId, job);
    this.logger?.info(`Registered cron trigger for workflow ${workflowId}: ${cronExpr} (check interval: ${Math.min(intervalMs, 60000)}ms)`);
  }

  /**
   * 注册 event 触发器
   */
  private registerEventTrigger(workflowId: string, triggerConfig: string): void {
    let config: { eventType?: string; filter?: Record<string, unknown> };
    try {
      config = JSON.parse(triggerConfig);
    } catch {
      this.logger?.error(`Invalid event config for workflow ${workflowId}`);
      return;
    }

    if (!config.eventType) {
      this.logger?.error(`Missing eventType in event config for workflow ${workflowId}`);
      return;
    }

    const unsubscribe = this.eventBus?.on(config.eventType, async (event: any) => {
      // 检查过滤条件
      if (config.filter) {
        const matches = Object.entries(config.filter).every(
          ([key, value]) => event.payload?.[key] === value
        );
        if (!matches) return;
      }

      try {
        await this.executeTriggeredWorkflow(workflowId, 'event', event.payload);
      } catch (err) {
        this.logger?.error(`Event trigger failed for workflow ${workflowId}`, { error: String(err) });
      }
    });

    if (unsubscribe) {
      this.eventListeners.push({ workflowId, unsubscribe });
      this.logger?.info(`Registered event trigger for workflow ${workflowId}: ${config.eventType}`);
    }
  }

  /**
   * 执行被触发的工作流
   */
  private async executeTriggeredWorkflow(
    workflowId: string,
    triggerType: string,
    triggerPayload?: Record<string, unknown>,
  ): Promise<void> {
    const workflow = await this.prisma.workflow.findUnique({ where: { id: workflowId } });
    if (!workflow || !workflow.isActive) return;

    const steps = JSON.parse(workflow.steps ?? '[]');
    const baseVariables = workflow.variables ? JSON.parse(workflow.variables) : {};
    const variables = { ...baseVariables, triggerPayload };

    // 记录触发日志
    await this.prisma.workflowExecution.create({
      data: {
        workflowId,
        workflowSnapshot: JSON.stringify({ id: workflowId, name: workflow.name, steps, variables }),
        status: 'running',
        triggerType,
        context: JSON.stringify(variables),
        startedAt: new Date(),
      },
    }).then(execution => {
      // 后台执行
      this.orchestrator.startExecution({
        workflowId,
        workflowName: workflow.name,
        steps,
        variables,
        triggerType,
        timeoutMs: workflow.timeoutMs,
      }).catch(err => {
        this.logger?.error(`Failed to start triggered execution`, { error: String(err) });
      });
    });
  }

  /**
   * 简单的 cron 表达式转检查间隔
   */
  private cronToInterval(expr: string): number | null {
    // 简化支持: "0 * * * *" (每小时), "*/5 * * * *" (每5分钟), "0 0 * * *" (每天)
    const parts = expr.split(' ');
    if (parts.length !== 5) return null;

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

    // 每分钟
    if (minute === '*' && hour === '*') return 60000;
    // 每 N 分钟
    if (minute.startsWith('*/') && hour === '*') {
      const n = parseInt(minute.slice(2));
      if (!isNaN(n) && n > 0) return n * 60000;
    }
    // 每小时
    if (minute === '0' && hour === '*') return 3600000;
    // 每天
    if (minute === '0' && hour === '0') return 86400000;

    return null;
  }

  /**
   * 检查 cron 是否应该执行
   */
  private shouldExecuteCron(expr: string): boolean {
    const now = new Date();
    const parts = expr.split(' ');
    if (parts.length !== 5) return false;

    const [minute, hour] = parts;

    // 每分钟
    if (minute === '*' && hour === '*') return true;

    // 每 N 分钟
    if (minute.startsWith('*/') && hour === '*') {
      const n = parseInt(minute.slice(2));
      if (!isNaN(n) && n > 0) return now.getMinutes() % n === 0;
    }

    // 每小时
    if (minute === '0' && hour === '*') return now.getMinutes() === 0;

    // 每天
    if (minute === '0' && hour === '0') return now.getHours() === 0 && now.getMinutes() === 0;

    return false;
  }

  /**
   * 关闭所有触发器
   */
  shutdown(): void {
    for (const [workflowId, job] of this.scheduledJobs.entries()) {
      clearInterval(job);
      this.logger?.info(`Cleared scheduled trigger for workflow ${workflowId}`);
    }
    this.scheduledJobs.clear();

    for (const listener of this.eventListeners) {
      listener.unsubscribe();
    }
    this.eventListeners = [];

    this.logger?.info('Trigger dispatcher shut down');
  }
}
