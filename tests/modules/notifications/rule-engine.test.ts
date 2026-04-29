import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventBus } from '@/lib/core/event-bus';
import { Logger } from '@/lib/core/logger';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { NotificationRepository } from '@/lib/modules/notifications/notification.repository';
import { NotificationRuleEngine } from '@/lib/modules/notifications/rule-engine';
import type { INotificationChannel, Notification } from '@/lib/modules/notifications/types';
import { join } from 'node:path';

const TEST_DB_PATH = join(process.cwd(), 'test-db', 'test-task-core.db');

function createTestServices() {
  const adapter = new PrismaBetterSqlite3({ url: TEST_DB_PATH });
  const prisma = new PrismaClient({ adapter });
  const eventBus = new EventBus();
  const logger = new Logger('test');

  const notificationRepo = new NotificationRepository(prisma);
  const ruleEngine = new NotificationRuleEngine(notificationRepo, eventBus, logger);

  return { prisma, eventBus, logger, notificationRepo, ruleEngine };
}

describe('NotificationRuleEngine', () => {
  let services: ReturnType<typeof createTestServices>;

  beforeEach(async () => {
    services = createTestServices();
    await services.prisma.notification.deleteMany();
  });

  afterEach(async () => {
    await services.prisma.$disconnect();
  });

  // --- 规则管理 ---

  it('should add a rule', () => {
    services.ruleEngine.addRule({ event: 'task.created', action: 'notify' });
    expect(services.ruleEngine.getRules()).toHaveLength(1);
    expect(services.ruleEngine.getRules()[0].event).toBe('task.created');
  });

  it('should remove a rule by event', () => {
    services.ruleEngine.addRule({ event: 'task.created', action: 'notify' });
    services.ruleEngine.addRule({ event: 'task.updated', action: 'log' });
    services.ruleEngine.removeRule('task.created');

    const rules = services.ruleEngine.getRules();
    expect(rules).toHaveLength(1);
    expect(rules[0].event).toBe('task.updated');
  });

  it('should not throw when removing non-existent rule', () => {
    expect(() => services.ruleEngine.removeRule('non.existent')).not.toThrow();
  });

  // --- 渠道管理 ---

  it('should register a channel', () => {
    const channel: INotificationChannel = {
      id: 'test-channel',
      name: 'Test Channel',
      send: vi.fn(),
    };
    services.ruleEngine.registerChannel(channel);

    const channels = services.ruleEngine.getChannels();
    expect(channels).toHaveLength(1);
    expect(channels[0].id).toBe('test-channel');
  });

  it('should unregister a channel', () => {
    const channel: INotificationChannel = {
      id: 'test-channel',
      name: 'Test Channel',
      send: vi.fn(),
    };
    services.ruleEngine.registerChannel(channel);
    services.ruleEngine.unregisterChannel('test-channel');

    expect(services.ruleEngine.getChannels()).toHaveLength(0);
  });

  // --- 规则匹配 ---

  it('should match exact event type', async () => {
    services.ruleEngine.addRule({ event: 'task.created', action: 'notify' });

    await services.ruleEngine.evaluate({
      type: 'task.created',
      payload: { task: { title: 'Test' } },
      timestamp: new Date(),
      source: 'test',
    });

    const notifs = await services.notificationRepo.findMany();
    expect(notifs.total).toBe(1);
    expect(notifs.notifications[0].type).toBe('task.created');
  });

  it('should match wildcard pattern', async () => {
    services.ruleEngine.addRule({ event: 'task.*', action: 'notify' });

    await services.ruleEngine.evaluate({
      type: 'task.status_changed',
      payload: {},
      timestamp: new Date(),
      source: 'test',
    });

    const notifs = await services.notificationRepo.findMany();
    expect(notifs.total).toBe(1);
  });

  it('should match catch-all wildcard', async () => {
    services.ruleEngine.addRule({ event: '*', action: 'notify' });

    await services.ruleEngine.evaluate({
      type: 'any.event',
      payload: {},
      timestamp: new Date(),
      source: 'test',
    });

    const notifs = await services.notificationRepo.findMany();
    expect(notifs.total).toBe(1);
  });

  it('should match prefix wildcard', async () => {
    services.ruleEngine.addRule({ event: 'agent.*', action: 'notify' });

    await services.ruleEngine.evaluate({
      type: 'agent.operation',
      payload: {},
      timestamp: new Date(),
      source: 'test',
    });

    const notifs = await services.notificationRepo.findMany();
    expect(notifs.total).toBe(1);
  });

  it('should not create notification for unmatched events', async () => {
    services.ruleEngine.addRule({ event: 'task.created', action: 'notify' });

    await services.ruleEngine.evaluate({
      type: 'agent.operation',
      payload: {},
      timestamp: new Date(),
      source: 'test',
    });

    const notifs = await services.notificationRepo.findMany();
    expect(notifs.total).toBe(0);
  });

  // --- 通知级别推断 ---

  it('should infer success level for completed events', async () => {
    services.ruleEngine.addRule({ event: 'task.completed', action: 'notify' });

    await services.ruleEngine.evaluate({
      type: 'task.completed',
      payload: {},
      timestamp: new Date(),
      source: 'test',
    });

    const notifs = await services.notificationRepo.findMany();
    expect(notifs.notifications[0].level).toBe('success');
  });

  it('should infer error level for deleted events', async () => {
    services.ruleEngine.addRule({ event: 'task.deleted', action: 'notify' });

    await services.ruleEngine.evaluate({
      type: 'task.deleted',
      payload: {},
      timestamp: new Date(),
      source: 'test',
    });

    const notifs = await services.notificationRepo.findMany();
    expect(notifs.notifications[0].level).toBe('error');
  });

  it('should infer warning level for overdue events', async () => {
    services.ruleEngine.addRule({ event: 'task.overdue', action: 'notify' });

    await services.ruleEngine.evaluate({
      type: 'task.overdue',
      payload: {},
      timestamp: new Date(),
      source: 'test',
    });

    const notifs = await services.notificationRepo.findMany();
    expect(notifs.notifications[0].level).toBe('warning');
  });

  it('should use rule level when specified', async () => {
    services.ruleEngine.addRule({ event: 'task.created', action: 'notify', level: 'warning' });

    await services.ruleEngine.evaluate({
      type: 'task.created',
      payload: {},
      timestamp: new Date(),
      source: 'test',
    });

    const notifs = await services.notificationRepo.findMany();
    expect(notifs.notifications[0].level).toBe('warning');
  });

  // --- 模板 ---

  it('should use custom title template', async () => {
    services.ruleEngine.addRule({
      event: 'task.created',
      action: 'notify',
      titleTemplate: 'New task from {source}',
    });

    await services.ruleEngine.evaluate({
      type: 'task.created',
      payload: {},
      timestamp: new Date(),
      source: 'Trae',
    });

    const notifs = await services.notificationRepo.findMany();
    expect(notifs.notifications[0].title).toBe('New task from Trae');
  });

  it('should use custom message template', async () => {
    services.ruleEngine.addRule({
      event: 'task.created',
      action: 'notify',
      messageTemplate: 'Event: {event} from {source}',
    });

    await services.ruleEngine.evaluate({
      type: 'task.created',
      payload: {},
      timestamp: new Date(),
      source: 'TestSource',
    });

    const notifs = await services.notificationRepo.findMany();
    expect(notifs.notifications[0].message).toBe('Event: task.created from TestSource');
  });

  // --- 渠道分发 ---

  it('should send to registered channels', async () => {
    const channel: INotificationChannel = {
      id: 'mock-channel',
      name: 'Mock Channel',
      send: vi.fn(),
    };
    services.ruleEngine.registerChannel(channel);
    services.ruleEngine.addRule({ event: 'task.created', action: 'notify' });

    await services.ruleEngine.evaluate({
      type: 'task.created',
      payload: { task: { title: 'Channel Test' } },
      timestamp: new Date(),
      source: 'test',
    });

    expect(channel.send).toHaveBeenCalledTimes(1);
    const sentNotif = (channel.send as any).mock.calls[0][0] as Notification;
    expect(sentNotif.type).toBe('task.created');
    expect(sentNotif.channel).toBe('mock-channel');
  });

  it('should only log when action is log', async () => {
    const channel: INotificationChannel = {
      id: 'mock-channel',
      name: 'Mock Channel',
      send: vi.fn(),
    };
    services.ruleEngine.registerChannel(channel);
    services.ruleEngine.addRule({ event: 'task.created', action: 'log' });

    await services.ruleEngine.evaluate({
      type: 'task.created',
      payload: {},
      timestamp: new Date(),
      source: 'test',
    });

    // Should save to DB but not send to channels
    expect(channel.send).not.toHaveBeenCalled();
    const notifs = await services.notificationRepo.findMany();
    expect(notifs.total).toBe(1);
  });

  it('should handle channel send error gracefully', async () => {
    const channel: INotificationChannel = {
      id: 'failing-channel',
      name: 'Failing Channel',
      send: vi.fn().mockRejectedValue(new Error('Channel error')),
    };
    services.ruleEngine.registerChannel(channel);
    services.ruleEngine.addRule({ event: 'task.created', action: 'notify' });

    // Should not throw
    await services.ruleEngine.evaluate({
      type: 'task.created',
      payload: {},
      timestamp: new Date(),
      source: 'test',
    });

    // Should still save to DB
    const notifs = await services.notificationRepo.findMany();
    expect(notifs.total).toBe(1);
  });

  // --- 事件监听 ---

  it('should start listening to events', async () => {
    services.ruleEngine.addRule({ event: 'task.created', action: 'notify' });
    services.ruleEngine.start();

    services.eventBus.emit({
      type: 'task.created',
      payload: { task: { title: 'Event Test' } },
      timestamp: new Date(),
      source: 'test',
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    const notifs = await services.notificationRepo.findMany();
    expect(notifs.total).toBe(1);
  });

  // --- 默认标题和消息 ---

  it('should use default title for known event types', async () => {
    services.ruleEngine.addRule({ event: 'task.created', action: 'notify' });

    await services.ruleEngine.evaluate({
      type: 'task.created',
      payload: {},
      timestamp: new Date(),
      source: 'test',
    });

    const notifs = await services.notificationRepo.findMany();
    expect(notifs.notifications[0].title).toBe('新任务创建');
  });

  it('should use default message with task title', async () => {
    services.ruleEngine.addRule({ event: 'task.created', action: 'notify' });

    await services.ruleEngine.evaluate({
      type: 'task.created',
      payload: { task: { title: 'My Task' } },
      timestamp: new Date(),
      source: 'test',
    });

    const notifs = await services.notificationRepo.findMany();
    expect(notifs.notifications[0].message).toBe('My Task');
  });

  it('should use default message with agent name', async () => {
    services.ruleEngine.addRule({ event: 'agent.operation', action: 'notify' });

    await services.ruleEngine.evaluate({
      type: 'agent.operation',
      payload: { agent: { name: 'TestAgent' } },
      timestamp: new Date(),
      source: 'test',
    });

    const notifs = await services.notificationRepo.findMany();
    expect(notifs.notifications[0].message).toContain('TestAgent');
  });

  it('should use default title for unknown event type', async () => {
    services.ruleEngine.addRule({ event: 'custom.event', action: 'notify' });

    await services.ruleEngine.evaluate({
      type: 'custom.event',
      payload: {},
      timestamp: new Date(),
      source: 'test',
    });

    const notifs = await services.notificationRepo.findMany();
    expect(notifs.notifications[0].title).toContain('custom.event');
  });
});
