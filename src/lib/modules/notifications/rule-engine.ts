import type { ILogger } from '@/lib/core/types';
import type { IEventBus } from '@/lib/core/types';
import type { DomainEvent } from '@/lib/core/types';
import type { Notification, NotificationRule, INotificationChannel } from './types';
import { NotificationRepository } from './notification.repository';
import { getPrisma } from '@/lib/db';

/**
 * Notification Rule Engine v2
 *
 * Supports:
 * - In-memory rules (backward compatible)
 * - Database-persisted rules (CRUD)
 * - Dynamic rule loading
 * - Deployment & lifecycle event monitoring
 */
export class NotificationRuleEngine {
  private rules: NotificationRule[] = [];
  private channels: Map<string, INotificationChannel> = new Map();
  private dbLoaded = false;

  constructor(
    private notificationRepo: NotificationRepository,
    private eventBus: IEventBus,
    private logger: ILogger,
    private prismaFn: () => ReturnType<typeof getPrisma> = getPrisma,
  ) {}

  // ==================== Rule Management ====================

  /** Add an in-memory rule (backward compatible) */
  addRule(rule: NotificationRule): void {
    this.rules.push(rule);
    this.logger.info(`Notification rule added: ${rule.event} -> ${rule.action}`);
  }

  /** Remove a rule by event pattern */
  removeRule(event: string): void {
    this.rules = this.rules.filter(r => r.event !== event);
  }

  /** Get all active rules (in-memory + DB) */
  getRules(): NotificationRule[] {
    return [...this.rules];
  }

  // ==================== Database Rule CRUD ====================

  /** Create a persisted notification rule */
  async createRule(input: {
    name: string;
    eventPattern: string;
    action?: string;
    level?: string;
    titleTemplate?: string;
    messageTemplate?: string;
    channels?: string;
    priority?: number;
  }): Promise<NotificationRuleRecord> {
    const prisma = this.prismaFn();
    try {
      const rule = await prisma.notificationRule.create({
        data: {
          name: input.name,
          eventPattern: input.eventPattern,
          action: input.action ?? 'notify',
          level: input.level ?? null,
          titleTemplate: input.titleTemplate ?? null,
          messageTemplate: input.messageTemplate ?? null,
          channels: input.channels ?? 'system',
          priority: input.priority ?? 0,
        },
      });

      // Add to in-memory rules
      this.rules.push(this.dbRuleToNotificationRule(rule));

      this.emitRuleEvent('notification.rule.created', rule);
      this.logger.info(`Persisted notification rule created: ${rule.name} (${rule.id})`);
      return this.mapDbRule(rule);
    } finally {
      await prisma.$disconnect();
    }
  }

  /** List all persisted rules */
  async listRules(filters?: { isActive?: boolean }): Promise<NotificationRuleRecord[]> {
    const prisma = this.prismaFn();
    try {
      const where: Record<string, unknown> = {};
      if (filters?.isActive !== undefined) where.isActive = filters.isActive;

      const rules = await prisma.notificationRule.findMany({
        where,
        orderBy: { priority: 'desc' },
      });
      return rules.map((r) => this.mapDbRule(r));
    } finally {
      await prisma.$disconnect();
    }
  }

  /** Update a persisted rule */
  async updateRule(id: string, updates: {
    name?: string;
    eventPattern?: string;
    action?: string;
    level?: string;
    titleTemplate?: string;
    messageTemplate?: string;
    channels?: string;
    isActive?: boolean;
    priority?: number;
  }): Promise<NotificationRuleRecord | null> {
    const prisma = this.prismaFn();
    try {
      const data: Record<string, unknown> = {};
      if (updates.name !== undefined) data.name = updates.name;
      if (updates.eventPattern !== undefined) data.eventPattern = updates.eventPattern;
      if (updates.action !== undefined) data.action = updates.action;
      if (updates.level !== undefined) data.level = updates.level;
      if (updates.titleTemplate !== undefined) data.titleTemplate = updates.titleTemplate;
      if (updates.messageTemplate !== undefined) data.messageTemplate = updates.messageTemplate;
      if (updates.channels !== undefined) data.channels = updates.channels;
      if (updates.isActive !== undefined) data.isActive = updates.isActive;
      if (updates.priority !== undefined) data.priority = updates.priority;

      const rule = await prisma.notificationRule.update({
        where: { id },
        data,
      });

      // Refresh in-memory rules
      await this.loadRulesFromDb();

      this.emitRuleEvent('notification.rule.updated', rule);
      return this.mapDbRule(rule);
    } catch (error: any) {
      if (error.code === 'P2025') return null;
      throw error;
    } finally {
      await prisma.$disconnect();
    }
  }

  /** Delete a persisted rule */
  async deleteRule(id: string): Promise<boolean> {
    const prisma = this.prismaFn();
    try {
      await prisma.notificationRule.delete({ where: { id } });
      // Refresh in-memory rules
      await this.loadRulesFromDb();
      this.emitRuleEvent('notification.rule.deleted', { ruleId: id });
      return true;
    } catch (error: any) {
      if (error.code === 'P2025') return false;
      throw error;
    } finally {
      await prisma.$disconnect();
    }
  }

  /** Load all active rules from database into memory */
  async loadRulesFromDb(): Promise<number> {
    const prisma = this.prismaFn();
    try {
      const dbRules = await prisma.notificationRule.findMany({
        where: { isActive: true },
        orderBy: { priority: 'desc' },
      });

      // Keep only in-memory rules (non-DB), then add DB rules
      this.rules = this.rules.filter(r => !(r as NotificationRule & { _fromDb?: boolean })._fromDb);
      for (const rule of dbRules) {
        this.rules.push(this.dbRuleToNotificationRule(rule));
      }

      this.dbLoaded = true;
      this.logger.info(`Loaded ${dbRules.length} notification rules from database`);
      return dbRules.length;
    } catch (error: any) {
      this.logger.warn(`Failed to load rules from DB: ${error.message}`);
      return 0;
    } finally {
      await prisma.$disconnect();
    }
  }

  // ==================== Channel Management ====================

  registerChannel(channel: INotificationChannel): void {
    this.channels.set(channel.id, channel);
    this.logger.info(`Notification channel registered: ${channel.name} (${channel.id})`);
  }

  unregisterChannel(channelId: string): void {
    this.channels.delete(channelId);
  }

  getChannels(): INotificationChannel[] {
    return Array.from(this.channels.values());
  }

  // ==================== Event Evaluation ====================

  async evaluate(event: DomainEvent): Promise<void> {
    const matchingRules = this.rules.filter(rule => this.matchEvent(rule.event, event.type));
    if (matchingRules.length === 0) return;

    for (const rule of matchingRules) {
      const notification = this.buildNotification(event, rule);
      await this.dispatch(notification, rule);
    }
  }

  start(): void {
    // Task events
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

    // Deployment events (NEW)
    this.eventBus.on('deployment.created', (e) => this.evaluate(e));
    this.eventBus.on('deployment.status.changed', (e) => this.evaluate(e));
    this.eventBus.on('deployment.rolled_back', (e) => this.evaluate(e));
    this.eventBus.on('deployment.environment.created', (e) => this.evaluate(e));
    this.eventBus.on('deployment.health_check.updated', (e) => this.evaluate(e));

    // Lifecycle events (NEW)
    this.eventBus.on('lifecycle.phase_transition.requested', (e) => this.evaluate(e));
    this.eventBus.on('lifecycle.phase_transition.approved', (e) => this.evaluate(e));
    this.eventBus.on('lifecycle.phase_transition.rejected', (e) => this.evaluate(e));

    // Knowledge events (NEW)
    this.eventBus.on('knowledge.created', (e) => this.evaluate(e));
    this.eventBus.on('knowledge.updated', (e) => this.evaluate(e));

    this.logger.info('Notification rule engine started, listening to events');
  }

  // ==================== Private Methods ====================

  private matchEvent(pattern: string, eventType: string): boolean {
    if (pattern === '*') return true;
    if (pattern === eventType) return true;
    if (pattern.endsWith('.*')) {
      const prefix = pattern.slice(0, -2);
      return eventType.startsWith(prefix);
    }
    return false;
  }

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

  private async dispatch(notification: Notification, rule: NotificationRule): Promise<void> {
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

    // Check if rule specifies target channels
    const ruleRecord = rule as NotificationRule & { _channels?: string };
    const targetChannels = ruleRecord._channels
      ? String(ruleRecord._channels).split(',').map((c: string) => c.trim())
      : null;

    for (const channel of this.channels.values()) {
      // If rule specifies channels, only send to those
      if (targetChannels && !targetChannels.includes(channel.id) && !targetChannels.includes('*')) {
        continue;
      }
      try {
        await channel.send({ ...notification, channel: channel.id });
      } catch (error: any) {
        this.logger.error(`Failed to send notification via ${channel.name}: ${error.message}`);
      }
    }
  }

  private interpolate(template: string, event: DomainEvent): string {
    return template
      .replace(/\\{event\\}/g, event.type)
      .replace(/\\{source\\}/g, event.source ?? 'unknown')
      .replace(/\\{timestamp\\}/g, new Date(event.timestamp).toLocaleString());
  }

  private defaultTitle(eventType: string): string {
    const titles: Record<string, string> = {
      'task.created': '新任务创建',
      'task.status.changed': '任务状态变更',
      'task.completed': '任务已完成',
      'task.assigned': '任务已分配',
      'task.blocked': '任务阻塞',
      'project.created': '新项目创建',
      'project.phase.changed': '项目阶段变更',
      'release.created': '新发布创建',
      'release.status.changed': '发布状态变更',
      'release.published': '发布完成',
      'release.rolled.back': '发布回滚',
      'workflow.triggered': '工作流触发',
      'workflow.completed': '工作流完成',
      'workflow.failed': '工作流失败',
      'workflow.step.completed': '工作流步骤完成',
      'workflow.step.failed': '工作流步骤失败',
      'agent.registered': '新智能体注册',
      'integration.github.push': 'GitHub 代码推送',
      'integration.github.pr.opened': 'GitHub PR 创建',
      'integration.github.pr.merged': 'GitHub PR 合并',
      'integration.github.issue.created': 'GitHub Issue 创建',
      'requirement.created': '新需求创建',
      'requirement.status.changed': '需求状态变更',
      'requirement.mapped.to.task': '需求已映射到任务',
      'deployment.created': '新部署创建',
      'deployment.status.changed': '部署状态变更',
      'deployment.rolled_back': '部署回滚',
      'deployment.environment.created': '部署环境创建',
      'deployment.health_check.updated': '健康检查状态更新',
      'lifecycle.phase_transition.requested': '阶段转换请求',
      'lifecycle.phase_transition.approved': '阶段转换已批准',
      'lifecycle.phase_transition.rejected': '阶段转换已拒绝',
      'knowledge.created': '知识条目创建',
      'knowledge.updated': '知识条目更新',
    };
    return titles[eventType] || `事件: ${eventType}`;
  }

  private defaultMessage(event: DomainEvent): string {
    const payload = event.payload as unknown as Record<string, unknown>;
    if (payload?.repository && payload?.ref) return `${payload.repository} 推送: ${payload.ref}`;
    if (payload?.repository && payload?.prNumber) return `${payload.repository} PR #${payload.prNumber}: ${payload.title}`;
    if (payload?.repository && payload?.issueNumber) return `${payload.repository} Issue #${payload.issueNumber}: ${payload.title}`;
    if (payload?.pushedBy) return `推送者: ${payload.pushedBy}`;
    if (payload?.requirementId && payload?.taskId) return `需求 ${payload.requirementId} -> 任务 ${payload.taskId}`;
    if (payload?.requirementId && payload?.status) return `需求 ${payload.requirementId} 状态: ${payload.status}`;
    if (payload?.requirementId && payload?.title) return `需求 ${payload.requirementId}: ${payload.title}`;
    if (payload?.title) return payload.title;
    if (payload?.taskId) return `任务 ${payload.taskId}`;
    if (payload?.projectId && payload?.phase) return `项目 ${payload.projectId} 阶段: ${payload.phase}`;
    if (payload?.projectId && payload?.name) return `项目: ${payload.name}`;
    if (payload?.releaseId && payload?.version) return `发布 v${payload.version}`;
    if (payload?.releaseId) return `发布 ${payload.releaseId}`;
    if (payload?.deploymentId && payload?.version) return `部署 v${payload.version} (${payload.environmentId})`;
    if (payload?.deploymentId) return `部署 ${payload.deploymentId}`;
    if (payload?.workflowId) return `工作流 ${payload.workflowId}`;
    if (payload?.executionId) return `执行 ${payload.executionId}`;
    if (payload?.agentId) return `智能体 ${payload.agentId}`;
    return JSON.stringify(payload).slice(0, 200);
  }

  private inferLevel(eventType: string): 'info' | 'warning' | 'error' | 'success' {
    if (eventType.includes('deleted') || eventType.includes('error') || eventType.includes('failed') || eventType.includes('unhealthy')) return 'error';
    if (eventType.includes('overdue') || eventType.includes('warning') || eventType.includes('rejected') || eventType.includes('rolled_back')) return 'warning';
    if (eventType.includes('completed') || eventType.includes('registered') || eventType.includes('merged') || eventType.includes('mapped') || eventType.includes('approved') || eventType.includes('healthy') || eventType.includes('published')) return 'success';
    return 'info';
  }

  private dbRuleToNotificationRule(dbRule: { id: string; eventPattern: string; action: string; level?: string | null; titleTemplate?: string | null; messageTemplate?: string | null; channels?: string | null }): NotificationRule & { _fromDb: boolean } {
    return {
      event: dbRule.eventPattern,
      action: dbRule.action as NotificationRule['action'],
      level: (dbRule.level as NotificationRule['level']) ?? undefined,
      titleTemplate: dbRule.titleTemplate ?? undefined,
      messageTemplate: dbRule.messageTemplate ?? undefined,
      _fromDb: true,
      _dbId: dbRule.id,
      _channels: dbRule.channels ?? undefined,
    };
  }

  private mapDbRule(rule: NotificationRuleRecord & { createdAt: Date; updatedAt: Date }): NotificationRuleRecord {
    return {
      id: rule.id,
      name: rule.name,
      eventPattern: rule.eventPattern,
      action: rule.action,
      level: rule.level,
      titleTemplate: rule.titleTemplate,
      messageTemplate: rule.messageTemplate,
      channels: rule.channels,
      isActive: rule.isActive,
      priority: rule.priority,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    };
  }

  private emitRuleEvent(type: string, payload: unknown): void {
    try {
      const event: DomainEvent = { type, payload, timestamp: new Date(), source: 'notifications' };
      this.eventBus.emit(event);
    } catch {
      // Don't let rule events cause recursive loops
    }
  }
}

export interface NotificationRuleRecord {
  id: string;
  name: string;
  eventPattern: string;
  action: string;
  level: string | null;
  titleTemplate: string | null;
  messageTemplate: string | null;
  channels: string;
  isActive: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}
