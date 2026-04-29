import type { PrismaClient } from '@/generated/prisma/client';
import type { Logger } from '@/lib/core/logger';
import type { EventBus } from '@/lib/core/event-bus';
import type { WorkflowOrchestrator } from '../orchestrator';
import type { TriggerType } from '../types';

export class TriggerDispatcher {
  private scheduledJobs = new Map<string, ReturnType<typeof setInterval>>();
  private eventListeners: Array<{ unsubscribe: () => void }> = [];

  constructor(private prisma: PrismaClient, private orchestrator: WorkflowOrchestrator, private eventBus?: EventBus, private logger?: Logger) {}

  async registerWorkflowTrigger(params: { workflowId: string; trigger: TriggerType; triggerConfig?: string }): Promise<void> {
    const { workflowId, trigger, triggerConfig } = params;
    await this.unregisterWorkflowTrigger(workflowId);
    switch (trigger) {
      case 'schedule': if (triggerConfig) this.registerScheduleTrigger(workflowId, triggerConfig); break;
      case 'event': if (triggerConfig) this.registerEventTrigger(workflowId, triggerConfig); break;
      case 'github-issue': break;
      case 'webhook': break;
      case 'manual': break;
    }
    this.logger?.info(`Registered trigger "${trigger}" for workflow ${workflowId}`);
  }

  async unregisterWorkflowTrigger(workflowId: string): Promise<void> {
    const job = this.scheduledJobs.get(workflowId); if (job) { clearInterval(job); this.scheduledJobs.delete(workflowId); }
    this.eventListeners = this.eventListeners.filter(listener => { if (listener.unsubscribe) { listener.unsubscribe(); return false; } return true; });
    this.logger?.info(`Unregistered triggers for workflow ${workflowId}`);
  }

  async manualTrigger(workflowId: string, triggeredBy?: string): Promise<{ executionId: string; status: string }> {
    const workflow = await this.prisma.workflow.findUnique({ where: { id: workflowId } });
    if (!workflow) throw new Error(`Workflow not found: ${workflowId}`);
    if (!workflow.isActive) throw new Error(`Workflow is not active: ${workflowId}`);
    const steps = JSON.parse(workflow.steps ?? '[]');
    const variables = workflow.variables ? JSON.parse(workflow.variables) : undefined;
    return this.orchestrator.startExecution({ workflowId, workflowName: workflow.name, steps, variables, triggerType: 'manual', triggeredBy, timeoutMs: workflow.timeoutMs });
  }

  async webhookTrigger(workflowId: string, payload: Record<string, unknown>): Promise<{ executionId: string; status: string }> {
    const workflow = await this.prisma.workflow.findUnique({ where: { id: workflowId } });
    if (!workflow) throw new Error(`Workflow not found: ${workflowId}`);
    const steps = JSON.parse(workflow.steps ?? '[]');
    const baseVariables = workflow.variables ? JSON.parse(workflow.variables) : {};
    const variables = { ...baseVariables, webhookPayload: payload };
    return this.orchestrator.startExecution({ workflowId, workflowName: workflow.name, steps, variables, triggerType: 'webhook', timeoutMs: workflow.timeoutMs });
  }

  private registerScheduleTrigger(workflowId: string, triggerConfig: string): void {
    let config: { cron?: string; intervalMs?: number };
    try { config = JSON.parse(triggerConfig); } catch { this.logger?.error(`Invalid schedule config for workflow ${workflowId}`); return; }
    if (config.intervalMs) {
      const job = setInterval(async () => { try { await this.executeTriggeredWorkflow(workflowId, 'schedule'); } catch (err) { this.logger?.error(`Schedule trigger failed for workflow ${workflowId}`, { error: String(err) }); } }, config.intervalMs);
      this.scheduledJobs.set(workflowId, job);
    } else if (config.cron) { this.registerCronTrigger(workflowId, config.cron); }
  }

  private registerCronTrigger(workflowId: string, cronExpr: string): void {
    const intervalMs = this.cronToInterval(cronExpr); if (!intervalMs) { this.logger?.error(`Unsupported cron expression: ${cronExpr}`); return; }
    const job = setInterval(async () => { try { if (this.shouldExecuteCron(cronExpr)) await this.executeTriggeredWorkflow(workflowId, 'schedule'); } catch (err) { this.logger?.error(`Cron trigger failed for workflow ${workflowId}`, { error: String(err) }); } }, Math.min(intervalMs, 60000));
    this.scheduledJobs.set(workflowId, job);
  }

  private registerEventTrigger(workflowId: string, triggerConfig: string): void {
    let config: { eventType?: string; filter?: Record<string, unknown> };
    try { config = JSON.parse(triggerConfig); } catch { this.logger?.error(`Invalid event config for workflow ${workflowId}`); return; }
    if (!config.eventType) { this.logger?.error(`Missing eventType in event config for workflow ${workflowId}`); return; }
    const unsubscribe = this.eventBus?.on(config.eventType, async (event: any) => {
      if (config.filter) { const matches = Object.entries(config.filter).every(([key, value]) => event.payload?.[key] === value); if (!matches) return; }
      try { await this.executeTriggeredWorkflow(workflowId, 'event', event.payload); } catch (err) { this.logger?.error(`Event trigger failed for workflow ${workflowId}`, { error: String(err) }); }
    });
    if (unsubscribe) { this.eventListeners.push({ unsubscribe }); this.logger?.info(`Registered event trigger for workflow ${workflowId}: ${config.eventType}`); }
  }

  private async executeTriggeredWorkflow(workflowId: string, triggerType: string, triggerPayload?: Record<string, unknown>): Promise<void> {
    const workflow = await this.prisma.workflow.findUnique({ where: { id: workflowId } }); if (!workflow || !workflow.isActive) return;
    const steps = JSON.parse(workflow.steps ?? '[]');
    const baseVariables = workflow.variables ? JSON.parse(workflow.variables) : {};
    const variables = { ...baseVariables, triggerPayload };
    await this.prisma.workflowExecution.create({ data: { workflowId, workflowSnapshot: JSON.stringify({ id: workflowId, name: workflow.name, steps, variables }), status: 'running', triggerType, context: JSON.stringify(variables), startedAt: new Date() } }).then(execution => {
      this.orchestrator.startExecution({ workflowId, workflowName: workflow.name, steps, variables, triggerType, timeoutMs: workflow.timeoutMs }).catch(err => { this.logger?.error(`Failed to start triggered execution`, { error: String(err) }); });
    });
  }

  private cronToInterval(expr: string): number | null {
    const parts = expr.split(' '); if (parts.length !== 5) return null;
    const [minute, hour] = parts;
    if (minute === '*' && hour === '*') return 60000;
    if (minute.startsWith('*/') && hour === '*') { const n = parseInt(minute.slice(2)); if (!isNaN(n) && n > 0) return n * 60000; }
    if (minute === '0' && hour === '*') return 3600000;
    if (minute === '0' && hour === '0') return 86400000;
    return null;
  }

  private shouldExecuteCron(expr: string): boolean {
    const now = new Date(); const parts = expr.split(' '); if (parts.length !== 5) return false;
    const [minute, hour] = parts;
    if (minute === '*' && hour === '*') return true;
    if (minute.startsWith('*/') && hour === '*') { const n = parseInt(minute.slice(2)); if (!isNaN(n) && n > 0) return now.getMinutes() % n === 0; }
    if (minute === '0' && hour === '*') return now.getMinutes() === 0;
    if (minute === '0' && hour === '0') return now.getHours() === 0 && now.getMinutes() === 0;
    return false;
  }

  shutdown(): void {
    for (const [workflowId, job] of this.scheduledJobs.entries()) { clearInterval(job); this.logger?.info(`Cleared scheduled trigger for workflow ${workflowId}`); }
    this.scheduledJobs.clear();
    for (const listener of this.eventListeners) { listener.unsubscribe(); }
    this.eventListeners = [];
    this.logger?.info('Trigger dispatcher shut down');
  }
}