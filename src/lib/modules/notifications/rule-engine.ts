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
    this.eventBus.on('task.created', (e) => this.evaluate(e));
    this.eventBus.on('task.updated', (e) => this.evaluate(e));
    this.eventBus.on('task.status_changed', (e) => this.evaluate(e));
    this.eventBus.on('task.completed', (e) => this.evaluate(e));
    this.eventBus.on('task.deleted', (e) => this.evaluate(e));
    this.eventBus.on('agent.operation', (e) => this.evaluate(e));
    this.eventBus.on('integration.synced', (e) => this.evaluate(e));
    this.eventBus.on('agent.registered', (e) => this.evaluate(e));
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
      'task.created': '新任务创建',
      'task.updated': '任务已更新',
      'task.status_changed': '任务状态变更',
      'task.completed': '任务已完成',
      'task.deleted': '任务已删除',
      'agent.operation': '智能体操作',
      'agent.registered': '新智能体注册',
      'integration.synced': '集成同步完成',
    };
    return titles[eventType] || `事件: ${eventType}`;
  }

  private defaultMessage(event: DomainEvent): string {
    const payload = event.payload as any;
    if (payload?.task?.title) return payload.task.title;
    if (payload?.agent?.name) return `智能体: ${payload.agent.name}`;
    if (payload?.integrationId) return `集成: ${payload.type}`;
    return JSON.stringify(payload).slice(0, 200);
  }

  private inferLevel(eventType: string): 'info' | 'warning' | 'error' | 'success' {
    if (eventType.includes('deleted') || eventType.includes('error')) return 'error';
    if (eventType.includes('overdue') || eventType.includes('warning')) return 'warning';
    if (eventType.includes('completed') || eventType.includes('registered')) return 'success';
    return 'info';
  }
}
