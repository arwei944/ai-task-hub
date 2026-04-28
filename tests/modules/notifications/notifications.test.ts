import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventBus } from '@/lib/core/event-bus';
import { Logger } from '@/lib/core/logger';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { NotificationRepository } from '@/lib/modules/notifications/notification.repository';
import { NotificationRuleEngine } from '@/lib/modules/notifications/rule-engine';
import { WebhookChannel } from '@/lib/modules/notifications/channels/webhook-channel';
import { BrowserPushChannel } from '@/lib/modules/notifications/channels/browser-push-channel';
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

describe('NotificationsModule', () => {
  let services: ReturnType<typeof createTestServices>;

  beforeEach(async () => {
    services = createTestServices();
    await services.prisma.notification.deleteMany();
    await services.prisma.webhook.deleteMany();
    await services.prisma.integration.deleteMany();
    await services.prisma.agentOperation.deleteMany();
    await services.prisma.agent.deleteMany();
    await services.prisma.taskHistory.deleteMany();
    await services.prisma.taskDependency.deleteMany();
    await services.prisma.taskTag.deleteMany();
    await services.prisma.tag.deleteMany();
    await services.prisma.task.deleteMany();
  });

  afterEach(async () => {
    await services.prisma.$disconnect();
  });

  describe('NotificationRepository', () => {
    it('should create a notification', async () => {
      const notif = await services.notificationRepo.create({
        type: 'task.created',
        title: '新任务',
        message: '任务已创建',
        level: 'info',
      });

      expect(notif.id).toBeDefined();
      expect(notif.type).toBe('task.created');
      expect(notif.title).toBe('新任务');
      expect(notif.isRead).toBe(false);
    });

    it('should list notifications with filters', async () => {
      await services.notificationRepo.create({ type: 'task.created', title: 'T1', message: 'M1', level: 'info' });
      await services.notificationRepo.create({ type: 'task.completed', title: 'T2', message: 'M2', level: 'success' });
      await services.notificationRepo.create({ type: 'task.overdue', title: 'T3', message: 'M3', level: 'warning' });

      const all = await services.notificationRepo.findMany();
      expect(all.total).toBe(3);

      const info = await services.notificationRepo.findMany({ level: 'info' });
      expect(info.total).toBe(1);
      expect(info.notifications[0].title).toBe('T1');

      const byType = await services.notificationRepo.findMany({ type: 'task.completed' });
      expect(byType.total).toBe(1);
    });

    it('should count unread notifications', async () => {
      await services.notificationRepo.create({ type: 'test', title: 'T1', message: 'M1' });
      await services.notificationRepo.create({ type: 'test', title: 'T2', message: 'M2' });

      expect(await services.notificationRepo.findUnreadCount()).toBe(2);

      const all = await services.notificationRepo.findMany();
      await services.notificationRepo.markAsRead(all.notifications[0].id);

      expect(await services.notificationRepo.findUnreadCount()).toBe(1);
    });

    it('should mark all as read', async () => {
      await services.notificationRepo.create({ type: 'test', title: 'T1', message: 'M1' });
      await services.notificationRepo.create({ type: 'test', title: 'T2', message: 'M2' });

      await services.notificationRepo.markAllAsRead();
      expect(await services.notificationRepo.findUnreadCount()).toBe(0);
    });

    it('should delete notifications', async () => {
      const notif = await services.notificationRepo.create({ type: 'test', title: 'T1', message: 'M1' });
      await services.notificationRepo.delete(notif.id);

      const all = await services.notificationRepo.findMany();
      expect(all.total).toBe(0);
    });

    it('should store and retrieve metadata', async () => {
      const notif = await services.notificationRepo.create({
        type: 'test',
        title: 'T1',
        message: 'M1',
        metadata: { taskId: 'abc', action: 'created' },
      });

      expect(notif.metadata).toEqual({ taskId: 'abc', action: 'created' });
    });
  });

  describe('NotificationRuleEngine', () => {
    it('should add and remove rules', () => {
      services.ruleEngine.addRule({ event: 'task.created', action: 'notify' });
      services.ruleEngine.addRule({ event: 'task.*', action: 'log' });

      expect(services.ruleEngine.getRules()).toHaveLength(2);

      services.ruleEngine.removeRule('task.created');
      expect(services.ruleEngine.getRules()).toHaveLength(1);
    });

    it('should register channels', () => {
      const browser = new BrowserPushChannel(services.logger);
      services.ruleEngine.registerChannel(browser);

      expect(services.ruleEngine.getChannels()).toHaveLength(1);
      expect(services.ruleEngine.getChannels()[0].id).toBe('browser_push');
    });

    it('should evaluate events and create notifications', async () => {
      services.ruleEngine.addRule({ event: 'task.created', action: 'notify' });

      await services.ruleEngine.evaluate({
        type: 'task.created',
        payload: { task: { title: 'Test Task' } },
        timestamp: new Date(),
        source: 'test',
      });

      const notifs = await services.notificationRepo.findMany();
      expect(notifs.total).toBe(1);
      expect(notifs.notifications[0].type).toBe('task.created');
      expect(notifs.notifications[0].title).toBeTruthy();
    });

    it('should match wildcard events', async () => {
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

    it('should infer notification level from event type', async () => {
      services.ruleEngine.addRule({ event: 'task.completed', action: 'notify' });
      services.ruleEngine.addRule({ event: 'task.deleted', action: 'notify' });

      await services.ruleEngine.evaluate({
        type: 'task.completed',
        payload: {},
        timestamp: new Date(),
        source: 'test',
      });
      await services.ruleEngine.evaluate({
        type: 'task.deleted',
        payload: {},
        timestamp: new Date(),
        source: 'test',
      });

      const notifs = await services.notificationRepo.findMany();
      expect(notifs.total).toBe(2);

      const completed = notifs.notifications.find(n => n.type === 'task.completed');
      const deleted = notifs.notifications.find(n => n.type === 'task.deleted');
      expect(completed?.level).toBe('success');
      expect(deleted?.level).toBe('error');
    });

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

    it('should send to registered channels', async () => {
      const browser = new BrowserPushChannel(services.logger);
      services.ruleEngine.registerChannel(browser);
      services.ruleEngine.addRule({ event: 'task.created', action: 'notify' });

      await services.ruleEngine.evaluate({
        type: 'task.created',
        payload: { task: { title: 'Channel Test' } },
        timestamp: new Date(),
        source: 'test',
      });

      const pending = browser.getPending();
      expect(pending).toHaveLength(1);
      expect(pending[0].type).toBe('task.created');
    });

    it('should start listening to events', async () => {
      services.ruleEngine.addRule({ event: 'task.created', action: 'notify' });
      services.ruleEngine.start();

      // Emit event through event bus
      services.eventBus.emit({
        type: 'task.created',
        payload: { task: { title: 'Event Test' } },
        timestamp: new Date(),
        source: 'test',
      });

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 50));

      const notifs = await services.notificationRepo.findMany();
      expect(notifs.total).toBe(1);
    });
  });

  describe('BrowserPushChannel', () => {
    it('should queue and retrieve pending notifications', async () => {
      const channel = new BrowserPushChannel(services.logger);

      await channel.send({ type: 'test', title: 'T1', message: 'M1', level: 'info', channel: 'browser_push' });
      await channel.send({ type: 'test', title: 'T2', message: 'M2', level: 'info', channel: 'browser_push' });

      expect(channel.getPending()).toHaveLength(2);
    });

    it('should limit pending notifications', async () => {
      const channel = new BrowserPushChannel(services.logger);
      // Send more than maxPending (100)
      for (let i = 0; i < 110; i++) {
        await channel.send({ type: 'test', title: `T${i}`, message: `M${i}`, level: 'info', channel: 'browser_push' });
      }

      expect(channel.getPending()).toHaveLength(100);
    });

    it('should clear pending notifications', async () => {
      const channel = new BrowserPushChannel(services.logger);
      await channel.send({ type: 'test', title: 'T1', message: 'M1', level: 'info', channel: 'browser_push' });
      channel.clearPending();
      expect(channel.getPending()).toHaveLength(0);
    });
  });
});
