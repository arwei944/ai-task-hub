/**
 * Integration tests for notifications tRPC router.
 * Tests: list, unreadCount, markAsRead, markAllAsRead, delete,
 *        pushSubscribe, pushUnsubscribe, pushTest
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestContext, destroyTestContext, createMockContext } from './helpers';
import type { TestContext } from './helpers';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});

afterAll(async () => {
  await destroyTestContext(ctx);
});

beforeEach(async () => {
  await ctx.prisma.notification.deleteMany();
});

describe('notifications.list', () => {
  it('should return empty list when no notifications', async () => {
    const result = await ctx.notificationRepo.findMany();
    expect(result.notifications).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('should return all notifications', async () => {
    await ctx.notificationRepo.create({
      type: 'task_created',
      title: 'Task Created',
      message: 'A new task was created',
    });
    await ctx.notificationRepo.create({
      type: 'task_status_changed',
      title: 'Status Changed',
      message: 'Task status updated',
    });

    const result = await ctx.notificationRepo.findMany();
    expect(result.notifications).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it('should filter by type', async () => {
    await ctx.notificationRepo.create({
      type: 'task_created',
      title: 'Task Created',
      message: 'New task',
    });
    await ctx.notificationRepo.create({
      type: 'agent_operation',
      title: 'Agent Op',
      message: 'Agent did something',
    });

    const result = await ctx.notificationRepo.findMany({ type: 'task_created' });
    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0].type).toBe('task_created');
  });

  it('should filter by isRead', async () => {
    const n1 = await ctx.notificationRepo.create({
      type: 'info',
      title: 'Unread',
      message: 'Not read yet',
    });
    const n2 = await ctx.notificationRepo.create({
      type: 'info',
      title: 'Read',
      message: 'Already read',
    });
    await ctx.notificationRepo.markAsRead(n2.id);

    const unread = await ctx.notificationRepo.findMany({ isRead: false });
    expect(unread.notifications).toHaveLength(1);
    expect(unread.notifications[0].id).toBe(n1.id);
  });

  it('should filter by level', async () => {
    await ctx.notificationRepo.create({
      type: 'info',
      title: 'Info',
      message: 'Info msg',
      level: 'info',
    });
    await ctx.notificationRepo.create({
      type: 'error',
      title: 'Error',
      message: 'Error msg',
      level: 'error',
    });

    const result = await ctx.notificationRepo.findMany({ level: 'error' });
    expect(result.notifications).toHaveLength(1);
  });

  it('should support pagination via limit and offset', async () => {
    for (let i = 0; i < 5; i++) {
      await ctx.notificationRepo.create({
        type: 'info',
        title: `Notification ${i}`,
        message: `Message ${i}`,
      });
    }

    const page1 = await ctx.notificationRepo.findMany({ limit: 2, offset: 0 });
    expect(page1.notifications).toHaveLength(2);

    const page2 = await ctx.notificationRepo.findMany({ limit: 2, offset: 2 });
    expect(page2.notifications).toHaveLength(2);
  });

  it('should return notifications in descending order', async () => {
    await ctx.notificationRepo.create({ type: 'info', title: 'First', message: '1' });
    await ctx.notificationRepo.create({ type: 'info', title: 'Second', message: '2' });

    const result = await ctx.notificationRepo.findMany();
    expect(result.notifications[0].title).toBe('Second');
  });
});

describe('notifications.unreadCount', () => {
  it('should return 0 when no notifications', async () => {
    const count = await ctx.notificationRepo.findUnreadCount();
    expect(count).toBe(0);
  });

  it('should count unread notifications', async () => {
    await ctx.notificationRepo.create({ type: 'info', title: 'Unread 1', message: '1' });
    await ctx.notificationRepo.create({ type: 'info', title: 'Unread 2', message: '2' });

    const count = await ctx.notificationRepo.findUnreadCount();
    expect(count).toBe(2);
  });

  it('should not count read notifications', async () => {
    const n = await ctx.notificationRepo.create({ type: 'info', title: 'Read', message: '1' });
    await ctx.notificationRepo.markAsRead(n.id);

    const count = await ctx.notificationRepo.findUnreadCount();
    expect(count).toBe(0);
  });
});

describe('notifications.markAsRead', () => {
  it('should mark a notification as read', async () => {
    const n = await ctx.notificationRepo.create({
      type: 'info',
      title: 'To Read',
      message: 'Mark me',
    });

    expect(n.isRead).toBe(false);
    await ctx.notificationRepo.markAsRead(n.id);

    const result = await ctx.notificationRepo.findMany();
    expect(result.notifications[0].isRead).toBe(true);
  });
});

describe('notifications.markAllAsRead', () => {
  it('should mark all notifications as read', async () => {
    await ctx.notificationRepo.create({ type: 'info', title: 'N1', message: '1' });
    await ctx.notificationRepo.create({ type: 'info', title: 'N2', message: '2' });
    await ctx.notificationRepo.create({ type: 'info', title: 'N3', message: '3' });

    await ctx.notificationRepo.markAllAsRead();

    const count = await ctx.notificationRepo.findUnreadCount();
    expect(count).toBe(0);
  });

  it('should handle empty notifications list', async () => {
    await ctx.notificationRepo.markAllAsRead();
    const count = await ctx.notificationRepo.findUnreadCount();
    expect(count).toBe(0);
  });
});

describe('notifications.delete', () => {
  it('should delete a notification', async () => {
    const n = await ctx.notificationRepo.create({
      type: 'info',
      title: 'To Delete',
      message: 'Delete me',
    });

    await ctx.notificationRepo.delete(n.id);

    const result = await ctx.notificationRepo.findMany();
    expect(result.notifications).toHaveLength(0);
  });
});

describe('notifications.create', () => {
  it('should create with default level and channel', async () => {
    const n = await ctx.notificationRepo.create({
      type: 'task_created',
      title: 'Auto',
      message: 'Auto notification',
    });

    expect(n.level).toBe('info');
    expect(n.channel).toBe('system');
    expect(n.isRead).toBe(false);
  });

  it('should create with custom level and channel', async () => {
    const n = await ctx.notificationRepo.create({
      type: 'error',
      title: 'Error',
      message: 'Something went wrong',
      level: 'error',
      channel: 'webhook',
    });

    expect(n.level).toBe('error');
    expect(n.channel).toBe('webhook');
  });

  it('should store metadata as JSON', async () => {
    const n = await ctx.notificationRepo.create({
      type: 'info',
      title: 'With Meta',
      message: 'Has metadata',
      metadata: { taskId: 't1', action: 'created' },
    });

    expect(n.metadata).toEqual({ taskId: 't1', action: 'created' });
  });
});

describe('notifications.pushSubscribe', () => {
  const mockCtx = createMockContext({ id: 'push-user-1' });

  it('should subscribe a user', () => {
    ctx.pushService.subscribe('push-user-1', {
      endpoint: 'https://example.com/push',
      keys: { p256dh: 'key1', auth: 'auth1' },
    });

    expect(ctx.pushService.subscriptionCount).toBe(1);
  });

  it('should replace existing subscription', () => {
    ctx.pushService.subscribe('push-user-1', {
      endpoint: 'https://example.com/push/old',
    });
    ctx.pushService.subscribe('push-user-1', {
      endpoint: 'https://example.com/push/new',
    });

    expect(ctx.pushService.subscriptionCount).toBe(1);
  });
});

describe('notifications.pushUnsubscribe', () => {
  it('should unsubscribe a user', () => {
    ctx.pushService.subscribe('push-user-2', {
      endpoint: 'https://example.com/push',
    });

    const removed = ctx.pushService.unsubscribe('push-user-2');
    expect(removed).toBe(true);
    // push-user-1 may still be subscribed from pushSubscribe tests
    expect(ctx.pushService.hasSubscription('push-user-2')).toBe(false);
  });

  it('should return false for non-subscribed user', () => {
    const removed = ctx.pushService.unsubscribe('non-existent');
    expect(removed).toBe(false);
  });
});

describe('notifications.pushTest', () => {
  it('should send test notification to subscribed user', async () => {
    ctx.pushService.subscribe('push-user-3', {
      endpoint: 'https://example.com/push',
    });

    const sent = await ctx.pushService.sendNotification(
      'push-user-3',
      'Test Notification',
      'Web Push is working!',
      { test: true },
    );

    expect(sent).toBe(true);
  });

  it('should return false for user without subscription', async () => {
    const sent = await ctx.pushService.sendNotification(
      'no-subscription-user',
      'Test',
      'No sub',
    );

    expect(sent).toBe(false);
  });
});

describe('notifications.pushSendToAll', () => {
  it('should send to all subscribed users', async () => {
    // Clean up any existing subscriptions from previous tests
    ctx.pushService.unsubscribe('push-user-1');
    ctx.pushService.unsubscribe('push-user-3');

    ctx.pushService.subscribe('user-a', { endpoint: 'https://a.com/push' });
    ctx.pushService.subscribe('user-b', { endpoint: 'https://b.com/push' });

    const result = await ctx.pushService.sendToAll('Broadcast', 'Hello all');

    expect(result.sent).toBe(2);
    expect(result.failed).toBe(0);
  });
});
