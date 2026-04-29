import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { NotificationRepository } from '@/lib/modules/notifications/notification.repository';
import { join } from 'node:path';

const TEST_DB_PATH = join(process.cwd(), 'test-db', 'test-task-core.db');

function createRepo() {
  const adapter = new PrismaBetterSqlite3({ url: TEST_DB_PATH });
  const prisma = new PrismaClient({ adapter });
  return { prisma, repo: new NotificationRepository(prisma) };
}

describe('NotificationRepository', () => {
  let prisma: PrismaClient;
  let repo: NotificationRepository;

  beforeEach(async () => {
    const services = createRepo();
    prisma = services.prisma;
    repo = services.repo;
    await prisma.notification.deleteMany();
  });

  afterEach(async () => {
    await prisma.$disconnect();
  });

  // --- 创建 ---

  it('should create a notification with defaults', async () => {
    const notif = await repo.create({
      type: 'task.created',
      title: '新任务',
      message: '任务已创建',
    });

    expect(notif.id).toBeDefined();
    expect(notif.type).toBe('task.created');
    expect(notif.title).toBe('新任务');
    expect(notif.message).toBe('任务已创建');
    expect(notif.level).toBe('info');
    expect(notif.channel).toBe('system');
    expect(notif.isRead).toBe(false);
    expect(notif.metadata).toBeNull();
  });

  it('should create a notification with all fields', async () => {
    const notif = await repo.create({
      type: 'task.completed',
      title: '任务完成',
      message: '已完成',
      level: 'success',
      channel: 'browser',
      metadata: { taskId: 'abc', action: 'created' },
    });

    expect(notif.level).toBe('success');
    expect(notif.channel).toBe('browser');
    expect(notif.metadata).toEqual({ taskId: 'abc', action: 'created' });
  });

  // --- 查询 ---

  it('should list all notifications', async () => {
    await repo.create({ type: 'test', title: 'T1', message: 'M1' });
    await repo.create({ type: 'test', title: 'T2', message: 'M2' });
    await repo.create({ type: 'test', title: 'T3', message: 'M3' });

    const result = await repo.findMany();
    expect(result.total).toBe(3);
    expect(result.notifications).toHaveLength(3);
  });

  it('should filter by type', async () => {
    await repo.create({ type: 'task.created', title: 'T1', message: 'M1' });
    await repo.create({ type: 'task.completed', title: 'T2', message: 'M2' });
    await repo.create({ type: 'task.created', title: 'T3', message: 'M3' });

    const result = await repo.findMany({ type: 'task.created' });
    expect(result.total).toBe(2);
  });

  it('should filter by isRead', async () => {
    const n1 = await repo.create({ type: 'test', title: 'T1', message: 'M1' });
    await repo.create({ type: 'test', title: 'T2', message: 'M2' });
    await repo.markAsRead(n1.id);

    const unread = await repo.findMany({ isRead: false });
    expect(unread.total).toBe(1);

    const read = await repo.findMany({ isRead: true });
    expect(read.total).toBe(1);
  });

  it('should filter by level', async () => {
    await repo.create({ type: 'test', title: 'T1', message: 'M1', level: 'info' });
    await repo.create({ type: 'test', title: 'T2', message: 'M2', level: 'success' });
    await repo.create({ type: 'test', title: 'T3', message: 'M3', level: 'warning' });

    const result = await repo.findMany({ level: 'success' });
    expect(result.total).toBe(1);
    expect(result.notifications[0].title).toBe('T2');
  });

  it('should support pagination with limit and offset', async () => {
    for (let i = 0; i < 10; i++) {
      await repo.create({ type: 'test', title: `T${i}`, message: `M${i}` });
    }

    const page1 = await repo.findMany({ limit: 3, offset: 0 });
    expect(page1.notifications).toHaveLength(3);
    expect(page1.total).toBe(10);

    const page2 = await repo.findMany({ limit: 3, offset: 3 });
    expect(page2.notifications).toHaveLength(3);
  });

  it('should order by createdAt desc', async () => {
    const n1 = await repo.create({ type: 'test', title: 'First', message: 'M1' });
    const n2 = await repo.create({ type: 'test', title: 'Second', message: 'M2' });

    const result = await repo.findMany();
    expect(result.notifications[0].id).toBe(n2.id);
    expect(result.notifications[1].id).toBe(n1.id);
  });

  // --- 未读计数 ---

  it('should count unread notifications', async () => {
    await repo.create({ type: 'test', title: 'T1', message: 'M1' });
    await repo.create({ type: 'test', title: 'T2', message: 'M2' });

    expect(await repo.findUnreadCount()).toBe(2);
  });

  it('should count unread after marking one as read', async () => {
    const n1 = await repo.create({ type: 'test', title: 'T1', message: 'M1' });
    await repo.create({ type: 'test', title: 'T2', message: 'M2' });

    await repo.markAsRead(n1.id);
    expect(await repo.findUnreadCount()).toBe(1);
  });

  // --- 标记已读 ---

  it('should mark a single notification as read', async () => {
    const notif = await repo.create({ type: 'test', title: 'T1', message: 'M1' });
    expect(notif.isRead).toBe(false);

    await repo.markAsRead(notif.id);

    const result = await repo.findMany();
    expect(result.notifications[0].isRead).toBe(true);
  });

  it('should mark all notifications as read', async () => {
    await repo.create({ type: 'test', title: 'T1', message: 'M1' });
    await repo.create({ type: 'test', title: 'T2', message: 'M2' });
    await repo.create({ type: 'test', title: 'T3', message: 'M3' });

    await repo.markAllAsRead();
    expect(await repo.findUnreadCount()).toBe(0);
  });

  it('should handle markAllAsRead when all are already read', async () => {
    await repo.markAllAsRead();
    expect(await repo.findUnreadCount()).toBe(0);
  });

  // --- 删除 ---

  it('should delete a notification', async () => {
    const notif = await repo.create({ type: 'test', title: 'T1', message: 'M1' });
    await repo.delete(notif.id);

    const result = await repo.findMany();
    expect(result.total).toBe(0);
  });

  it('should delete older than N days', async () => {
    // Create a notification
    await repo.create({ type: 'test', title: 'T1', message: 'M1' });

    // Manually set createdAt to 30 days ago
    const all = await repo.findMany();
    const oldId = all.notifications[0].id;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 31);
    await prisma.notification.update({
      where: { id: oldId },
      data: { createdAt: cutoff },
    });

    // Create a recent notification
    await repo.create({ type: 'test', title: 'T2', message: 'M2' });

    const deletedCount = await repo.deleteOlderThan(30);
    expect(deletedCount).toBe(1);

    const remaining = await repo.findMany();
    expect(remaining.total).toBe(1);
    expect(remaining.notifications[0].title).toBe('T2');
  });

  // --- 元数据 ---

  it('should store and retrieve metadata', async () => {
    const notif = await repo.create({
      type: 'test',
      title: 'T1',
      message: 'M1',
      metadata: { taskId: 'abc', action: 'created', count: 42 },
    });

    expect(notif.metadata).toEqual({ taskId: 'abc', action: 'created', count: 42 });
  });

  it('should handle null metadata', async () => {
    const notif = await repo.create({
      type: 'test',
      title: 'T1',
      message: 'M1',
    });

    expect(notif.metadata).toBeNull();
  });
});
