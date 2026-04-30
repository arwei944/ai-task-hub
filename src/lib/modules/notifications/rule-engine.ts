import type { ILogger } from '@/lib/core/types';
import type { IEventBus } from '@/lib/core/types';
import type { DomainEvent } from '@/lib/core/types';
import type { Notification, NotificationRule, INotificationChannel } from './types';
import { NotificationRepository } from './notification.repository';

/**
 * Notification Rule Engine
 *
 * Evaluates domain events against configured rules
 * and dispatches notifications through registered channels.
 */
export class NotificationRuleEngine {
  private rules: NotificationRule[] = [];
  private channels: Map<string, INotificationChannel> = new Map();

  constructor(
    private notificationRepo: NotificationRepository,
    private eventBus: IEventBus,
    private logger: ILogger,
  ) {}

  /**
   * Add a notification rule
   */
  addRule(rule: NotificationRule): void {
    this.rules.push(rule);
    this.logger.info(`Notification rule added: ${rule.event} -> ${rule.action}`);
  }

  /**
   * Remove a rule
   */
  removeRule(event: string): void {
    this.rules = this.rules.filter(r => r.event !== event);
  }

  /**
   * Get all rules
   */
  getRules(): NotificationRule[] {
    return [...this.rules];
  }

  /**
   * Register a notification channel
   */
  registerChannel(channel: INotificationChannel): void {
    this.channels.set(channel.id, channel);
    this.logger.info(`Notification channel registered: ${channel.name} (${channel.id})`);
  }

  /**
   * Unregister a channel
   */
  unregisterChannel(channelId: string): void {
    this.channels.delete(channelId);
  }

  /**
   * Get all registered channels
   */
  getChannels(): INotificationChannel[] {
    return Array.from(this.channels.values());
  }

  /**
   * Evaluate an event against all rules and dispatch notifications
   */
  async evaluate(event: DomainEvent): Promise<void> {
    const matchingRules = this.rules.filter(rule => this.matchEvent(rule.event, event.type));

    if (matchingRules.length === 0) return;

    for (const rule of matchingRules) {
      const notification = this.buildNotification(event, rule);
      await this.dispatch(notification, rule);
    }
  }

  /**
   * Start listening to events
   */
  start(): void {
    // Task events (catalog-matched types)
    this.eventBus.on('task.created', (e) => this.evaluate(e));
    this.eventBus.on('task.status.changed', (e) => this.evaluate(e));
    this.eventBus.on('task.completed', (e) => this.evaluate(e));
    this.eventBus.on('task.assigned', (e) => this.evaluate(e));
    this.eventBus.on('task.blocked', (e) => this.evaluate(e));

    // Project events
    this.eventBus.on('project.created', (e) => this.evaluate(e));
    this.eventBus.on('project.phase.changed', (e) => this.evaluate(e));

    // Release events
    this.eventBus.on('release.created', (e) => this.evaluate(e));
    this.eventBus.on('release.status.changed', (e) => this.evaluate(e));
    this.eventBus.on('release.published', (e) => this.evaluate(e));
    this.eventBus.on('release.rolled.back', (e) => this.evaluate(e));

    // Workflow events
    this.eventBus.on('workflow.triggered', (e) => this.evaluate(e));
    this.eventBus.on('workflow.completed', (e) => this.evaluate(e));
    this.eventBus.on('workflow.failed', (e) => this.evaluate(e));
    this.eventBus.on('workflow.step.completed', (e) => this.evaluate(e));
    this.eventBus.on('workflow.step.failed', (e) => this.evaluate(e));

    // Agent events
    this.eventBus.on('agent.registered', (e) => this.evaluate(e));

    // GitHub integration events
    this.eventBus.on('integration.github.push', (e) => this.evaluate(e));
    this.eventBus.on('integration.github.pr.opened', (e) => this.evaluate(e));
    this.eventBus.on('integration.github.pr.merged', (e) => this.evaluate(e));
    this.eventBus.on('integration.github.issue.created', (e) => this.evaluate(e));

    // Requirement events
    this.eventBus.on('requirement.created', (e) => this.evaluate(e));
    this.eventBus.on('requirement.status.changed', (e) => this.evaluate(e));
    this.eventBus.on('requirement.mapped.to.task', (e) => this.evaluate(e));

    this.logger.info('Notification rule engine started, listening to events');
  }

  /**
   * Match event pattern (supports wildcards)
   */
  private matchEvent(pattern: string, eventType: string): boolean {
    if (pattern === '*') return true;
    if (pattern === eventType) return true;
    if (pattern.endsWith('.*')) {
      const prefix = pattern.slice(0, -2);
      return eventType.startsWith(prefix);
    }
    return false;
  }

  /**
   * Build a notification from event and rule
   */
  private buildNotification(event: DomainEvent, rule: NotificationRule): Notification {
    const title = rule.titleTemplate
      ? this.interpolate(rule.titleTemplate, event)
      : this.defaultTitle(event.type);

    const message = rule.messageTemplate
      ? this.interpolate(rule.messageTemplate, event)
      : this.defaultMessage(event);

    return {
      type: event.type,
      title,
      message,
      level: rule.level ?? this.inferLevel(event.type),
      channel: 'system',
      metadata: { source: event.source, timestamp: event.timestamp },
    };
  }

  /**
   * Dispatch notification to appropriate channels
   */
  private async dispatch(notification: Notification, rule: NotificationRule): Promise<void> {
    // Always save to database
    await this.notificationRepo.create({
      type: notification.type,
      title: notification.title,
      message: notification.message,
      level: notification.level,
      channel: notification.channel,
      metadata: notification.metadata,
    });

    if (rule.action === 'log') {
      this.logger.info(`[Notification] ${notification.title}: ${notification.message}`);
      return;
    }

    // Send to all registered channels
    for (const channel of this.channels.values()) {
      try {
        await channel.send({ ...notification, channel: channel.id });
      } catch (error: any) {
        this.logger.error(`Failed to send notification via ${channel.name}: ${error.message}`);
      }
    }
  }

  /**
   * Interpolate template with event data
   */
  private interpolate(template: string, event: DomainEvent): string {
    return template
      .replace(/\{event\}/g, event.type)
      .replace(/\{source\}/g, event.source ?? 'unknown')
      .replace(/\{timestamp\}/g, new Date(event.timestamp).toLocaleString());
  }

  private defaultTitle(eventType: string): string {
    const titles: Record<string, string> = {
      // Task events
      'task.created': '新任务创建',
      'task.status.changed': '任务状态变更',
      'task.completed': '任务已完成',
      'task.assigned': '任务已分配',
      'task.blocked': '任务阻塞',
      // Project events
      'project.created': '新项目创建',
      'project.phase.changed': '项目阶段变更',
      // Release events
      'release.created': '新发布创建',
      'release.status.changed': '发布状态变更',
      'release.published': '发布完成',
      'release.rolled.back': '发布回滚',
      // Workflow events
      'workflow.triggered': '工作流触发',
      'workflow.completed': '工作流完成',
      'workflow.failed': '工作流失败',
      'workflow.step.completed': '工作流步骤完成',
      'workflow.step.failed': '工作流步骤失败',
      // Agent events
      'agent.registered': '新智能体注册',
      // GitHub integration events
      'integration.github.push': 'GitHub 代码推送',
      'integration.github.pr.opened': 'GitHub PR 创建',
      'integration.github.pr.merged': 'GitHub PR 合并',
      'integration.github.issue.created': 'GitHub Issue 创建',
      // Requirement events
      'requirement.created': '新需求创建',
      'requirement.status.changed': '需求状态变更',
      'requirement.mapped.to.task': '需求已映射到任务',
    };
    return titles[eventType] || `事件: ${eventType}`;
  }

  private defaultMessage(event: DomainEvent): string {
    const payload = event.payload as any;
    // GitHub integration events (check before generic title)
    if (payload?.repository && payload?.ref) return `${payload.repository} 推送: ${payload.ref}`;
    if (payload?.repository && payload?.prNumber) return `${payload.repository} PR #${payload.prNumber}: ${payload.title}`;
    if (payload?.repository && payload?.issueNumber) return `${payload.repository} Issue #${payload.issueNumber}: ${payload.title}`;
    if (payload?.pushedBy) return `推送者: ${payload.pushedBy}`;
    // Requirement events (check before generic title)
    if (payload?.requirementId && payload?.taskId) return `需求 ${payload.requirementId} -> 任务 ${payload.taskId}`;
    if (payload?.requirementId && payload?.status) return `需求 ${payload.requirementId} 状态: ${payload.status}`;
    if (payload?.requirementId && payload?.title) return `需求 ${payload.requirementId}: ${payload.title}`;
    // Task events
    if (payload?.title) return payload.title;
    if (payload?.taskId) return `任务 ${payload.taskId}`;
    // Project events
    if (payload?.projectId && payload?.phase) return `项目 ${payload.projectId} 阶段: ${payload.phase}`;
    if (payload?.projectId && payload?.name) return `项目: ${payload.name}`;
    // Release events
    if (payload?.releaseId && payload?.version) return `发布 v${payload.version}`;
    if (payload?.releaseId) return `发布 ${payload.releaseId}`;
    // Workflow events
    if (payload?.workflowId) return `工作流 ${payload.workflowId}`;
    if (payload?.executionId) return `执行 ${payload.executionId}`;
    // Agent events
    if (payload?.agentId) return `智能体 ${payload.agentId}`;
    // Fallback
    return JSON.stringify(payload).slice(0, 200);
  }

  private inferLevel(eventType: string): 'info' | 'warning' | 'error' | 'success' {
    if (eventType.includes('deleted') || eventType.includes('error')) return 'error';
    if (eventType.includes('overdue') || eventType.includes('warning')) return 'warning';
    if (eventType.includes('completed') || eventType.includes('registered') || eventType.includes('merged') || eventType.includes('mapped')) return 'success';
    return 'info';
  }
}
