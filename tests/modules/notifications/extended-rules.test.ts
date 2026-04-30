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

describe('Extended Notification Rules', () => {
  let services: ReturnType<typeof createTestServices>;

  beforeEach(async () => {
    services = createTestServices();
    await services.prisma.notification.deleteMany();
  });

  afterEach(async () => {
    await services.prisma.$disconnect();
  });

  // --- GitHub integration event notifications ---

  describe('GitHub integration events', () => {
    it('should create notification for integration.github.push event', async () => {
      services.ruleEngine.addRule({ event: 'integration.github.push', action: 'notify' });

      await services.ruleEngine.evaluate({
        type: 'integration.github.push',
        payload: {
          ref: 'refs/heads/main',
          pushedBy: 'octocat',
          repository: 'owner/repo',
          commits: [],
        },
        timestamp: new Date(),
        source: 'integration-github',
      });

      const notifs = await services.notificationRepo.findMany();
      expect(notifs.total).toBe(1);
      expect(notifs.notifications[0].title).toBe('GitHub 代码推送');
      expect(notifs.notifications[0].message).toContain('owner/repo');
      expect(notifs.notifications[0].message).toContain('refs/heads/main');
    });

    it('should create notification for integration.github.pr.opened event', async () => {
      services.ruleEngine.addRule({ event: 'integration.github.pr.opened', action: 'notify' });

      await services.ruleEngine.evaluate({
        type: 'integration.github.pr.opened',
        payload: {
          prNumber: 42,
          title: 'Add new feature',
          sender: 'developer',
          repository: 'owner/repo',
          baseBranch: 'main',
          headBranch: 'feature/new',
        },
        timestamp: new Date(),
        source: 'integration-github',
      });

      const notifs = await services.notificationRepo.findMany();
      expect(notifs.total).toBe(1);
      expect(notifs.notifications[0].title).toBe('GitHub PR 创建');
      expect(notifs.notifications[0].message).toContain('owner/repo');
      expect(notifs.notifications[0].message).toContain('PR #42');
      expect(notifs.notifications[0].message).toContain('Add new feature');
    });

    it('should create notification for integration.github.pr.merged event with success level', async () => {
      services.ruleEngine.addRule({ event: 'integration.github.pr.merged', action: 'notify' });

      await services.ruleEngine.evaluate({
        type: 'integration.github.pr.merged',
        payload: {
          prNumber: 42,
          title: 'Add new feature',
          mergedBy: 'maintainer',
          repository: 'owner/repo',
          mergeCommitSha: 'abc123',
        },
        timestamp: new Date(),
        source: 'integration-github',
      });

      const notifs = await services.notificationRepo.findMany();
      expect(notifs.total).toBe(1);
      expect(notifs.notifications[0].title).toBe('GitHub PR 合并');
      expect(notifs.notifications[0].level).toBe('success');
      expect(notifs.notifications[0].message).toContain('owner/repo');
      expect(notifs.notifications[0].message).toContain('PR #42');
    });

    it('should create notification for integration.github.issue.created event', async () => {
      services.ruleEngine.addRule({ event: 'integration.github.issue.created', action: 'notify' });

      await services.ruleEngine.evaluate({
        type: 'integration.github.issue.created',
        payload: {
          issueNumber: 10,
          title: 'Bug: login fails',
          sender: 'reporter',
          repository: 'owner/repo',
          url: 'https://github.com/owner/repo/issues/10',
          labels: ['bug'],
        },
        timestamp: new Date(),
        source: 'integration-github',
      });

      const notifs = await services.notificationRepo.findMany();
      expect(notifs.total).toBe(1);
      expect(notifs.notifications[0].title).toBe('GitHub Issue 创建');
      expect(notifs.notifications[0].message).toContain('owner/repo');
      expect(notifs.notifications[0].message).toContain('Issue #10');
      expect(notifs.notifications[0].message).toContain('Bug: login fails');
    });

    it('should match GitHub events with wildcard pattern integration.github.*', async () => {
      services.ruleEngine.addRule({ event: 'integration.github.*', action: 'notify' });

      await services.ruleEngine.evaluate({
        type: 'integration.github.push',
        payload: { ref: 'refs/heads/main', repository: 'owner/repo' },
        timestamp: new Date(),
        source: 'integration-github',
      });

      await services.ruleEngine.evaluate({
        type: 'integration.github.pr.merged',
        payload: { prNumber: 1, title: 'Test', repository: 'owner/repo' },
        timestamp: new Date(),
        source: 'integration-github',
      });

      const notifs = await services.notificationRepo.findMany();
      expect(notifs.total).toBe(2);
    });
  });

  // --- Requirement event notifications ---

  describe('Requirement events', () => {
    it('should create notification for requirement.created event', async () => {
      services.ruleEngine.addRule({ event: 'requirement.created', action: 'notify' });

      await services.ruleEngine.evaluate({
        type: 'requirement.created',
        payload: {
          requirementId: 'req-001',
          title: '用户登录功能',
          description: '实现用户名密码登录',
        },
        timestamp: new Date(),
        source: 'requirements',
      });

      const notifs = await services.notificationRepo.findMany();
      expect(notifs.total).toBe(1);
      expect(notifs.notifications[0].title).toBe('新需求创建');
      expect(notifs.notifications[0].message).toContain('req-001');
      expect(notifs.notifications[0].message).toContain('用户登录功能');
    });

    it('should create notification for requirement.status.changed event', async () => {
      services.ruleEngine.addRule({ event: 'requirement.status.changed', action: 'notify' });

      await services.ruleEngine.evaluate({
        type: 'requirement.status.changed',
        payload: {
          requirementId: 'req-001',
          status: 'in_progress',
          previousStatus: 'pending',
        },
        timestamp: new Date(),
        source: 'requirements',
      });

      const notifs = await services.notificationRepo.findMany();
      expect(notifs.total).toBe(1);
      expect(notifs.notifications[0].title).toBe('需求状态变更');
      expect(notifs.notifications[0].message).toContain('req-001');
      expect(notifs.notifications[0].message).toContain('in_progress');
    });

    it('should create notification for requirement.mapped.to.task event with success level', async () => {
      services.ruleEngine.addRule({ event: 'requirement.mapped.to.task', action: 'notify' });

      await services.ruleEngine.evaluate({
        type: 'requirement.mapped.to.task',
        payload: {
          requirementId: 'req-001',
          taskId: 'task-042',
          title: '用户登录功能',
        },
        timestamp: new Date(),
        source: 'requirements',
      });

      const notifs = await services.notificationRepo.findMany();
      expect(notifs.total).toBe(1);
      expect(notifs.notifications[0].title).toBe('需求已映射到任务');
      expect(notifs.notifications[0].level).toBe('success');
      expect(notifs.notifications[0].message).toContain('req-001');
      expect(notifs.notifications[0].message).toContain('task-042');
    });
  });

  // --- Notification templates for new events ---

  describe('notification templates for new events', () => {
    it('should use default title for integration.github.push', async () => {
      services.ruleEngine.addRule({ event: 'integration.github.push', action: 'notify' });

      await services.ruleEngine.evaluate({
        type: 'integration.github.push',
        payload: { ref: 'refs/heads/main', repository: 'owner/repo' },
        timestamp: new Date(),
        source: 'integration-github',
      });

      const notifs = await services.notificationRepo.findMany();
      expect(notifs.notifications[0].title).toBe('GitHub 代码推送');
    });

    it('should use default title for integration.github.pr.opened', async () => {
      services.ruleEngine.addRule({ event: 'integration.github.pr.opened', action: 'notify' });

      await services.ruleEngine.evaluate({
        type: 'integration.github.pr.opened',
        payload: { prNumber: 1, title: 'Test PR', repository: 'owner/repo' },
        timestamp: new Date(),
        source: 'integration-github',
      });

      const notifs = await services.notificationRepo.findMany();
      expect(notifs.notifications[0].title).toBe('GitHub PR 创建');
    });

    it('should use default title for integration.github.pr.merged', async () => {
      services.ruleEngine.addRule({ event: 'integration.github.pr.merged', action: 'notify' });

      await services.ruleEngine.evaluate({
        type: 'integration.github.pr.merged',
        payload: { prNumber: 1, title: 'Test PR', repository: 'owner/repo' },
        timestamp: new Date(),
        source: 'integration-github',
      });

      const notifs = await services.notificationRepo.findMany();
      expect(notifs.notifications[0].title).toBe('GitHub PR 合并');
    });

    it('should use default title for integration.github.issue.created', async () => {
      services.ruleEngine.addRule({ event: 'integration.github.issue.created', action: 'notify' });

      await services.ruleEngine.evaluate({
        type: 'integration.github.issue.created',
        payload: { issueNumber: 1, title: 'Bug', repository: 'owner/repo' },
        timestamp: new Date(),
        source: 'integration-github',
      });

      const notifs = await services.notificationRepo.findMany();
      expect(notifs.notifications[0].title).toBe('GitHub Issue 创建');
    });

    it('should use default title for requirement.created', async () => {
      services.ruleEngine.addRule({ event: 'requirement.created', action: 'notify' });

      await services.ruleEngine.evaluate({
        type: 'requirement.created',
        payload: { requirementId: 'req-001', title: 'New requirement' },
        timestamp: new Date(),
        source: 'requirements',
      });

      const notifs = await services.notificationRepo.findMany();
      expect(notifs.notifications[0].title).toBe('新需求创建');
    });

    it('should use default title for requirement.status.changed', async () => {
      services.ruleEngine.addRule({ event: 'requirement.status.changed', action: 'notify' });

      await services.ruleEngine.evaluate({
        type: 'requirement.status.changed',
        payload: { requirementId: 'req-001', status: 'in_progress' },
        timestamp: new Date(),
        source: 'requirements',
      });

      const notifs = await services.notificationRepo.findMany();
      expect(notifs.notifications[0].title).toBe('需求状态变更');
    });

    it('should use default title for requirement.mapped.to.task', async () => {
      services.ruleEngine.addRule({ event: 'requirement.mapped.to.task', action: 'notify' });

      await services.ruleEngine.evaluate({
        type: 'requirement.mapped.to.task',
        payload: { requirementId: 'req-001', taskId: 'task-001' },
        timestamp: new Date(),
        source: 'requirements',
      });

      const notifs = await services.notificationRepo.findMany();
      expect(notifs.notifications[0].title).toBe('需求已映射到任务');
    });

    it('should support custom title and message templates for new events', async () => {
      services.ruleEngine.addRule({
        event: 'integration.github.pr.merged',
        action: 'notify',
        titleTemplate: 'PR merged in {source}',
        messageTemplate: 'Event: {event}',
      });

      await services.ruleEngine.evaluate({
        type: 'integration.github.pr.merged',
        payload: { prNumber: 1, title: 'Test', repository: 'owner/repo' },
        timestamp: new Date(),
        source: 'integration-github',
      });

      const notifs = await services.notificationRepo.findMany();
      expect(notifs.notifications[0].title).toBe('PR merged in integration-github');
      expect(notifs.notifications[0].message).toBe('Event: integration.github.pr.merged');
    });

    it('should send new event notifications to registered channels', async () => {
      const channel: INotificationChannel = {
        id: 'test-channel',
        name: 'Test Channel',
        send: vi.fn(),
      };
      services.ruleEngine.registerChannel(channel);
      services.ruleEngine.addRule({ event: 'integration.github.issue.created', action: 'notify' });

      await services.ruleEngine.evaluate({
        type: 'integration.github.issue.created',
        payload: { issueNumber: 5, title: 'Critical bug', repository: 'owner/repo' },
        timestamp: new Date(),
        source: 'integration-github',
      });

      expect(channel.send).toHaveBeenCalledTimes(1);
      const sentNotif = (channel.send as any).mock.calls[0][0] as Notification;
      expect(sentNotif.type).toBe('integration.github.issue.created');
      expect(sentNotif.channel).toBe('test-channel');
      expect(sentNotif.title).toBe('GitHub Issue 创建');
    });
  });

  // --- Event bus integration for new events ---

  describe('event bus integration for new events', () => {
    it('should listen to integration.github.push via start()', async () => {
      services.ruleEngine.addRule({ event: 'integration.github.push', action: 'notify' });
      services.ruleEngine.start();

      services.eventBus.emit({
        type: 'integration.github.push',
        payload: { ref: 'refs/heads/main', repository: 'owner/repo', pushedBy: 'dev' },
        timestamp: new Date(),
        source: 'integration-github',
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const notifs = await services.notificationRepo.findMany();
      expect(notifs.total).toBe(1);
      expect(notifs.notifications[0].title).toBe('GitHub 代码推送');
    });

    it('should listen to integration.github.pr.opened via start()', async () => {
      services.ruleEngine.addRule({ event: 'integration.github.pr.opened', action: 'notify' });
      services.ruleEngine.start();

      services.eventBus.emit({
        type: 'integration.github.pr.opened',
        payload: { prNumber: 1, title: 'Test', repository: 'owner/repo' },
        timestamp: new Date(),
        source: 'integration-github',
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const notifs = await services.notificationRepo.findMany();
      expect(notifs.total).toBe(1);
      expect(notifs.notifications[0].title).toBe('GitHub PR 创建');
    });

    it('should listen to integration.github.pr.merged via start()', async () => {
      services.ruleEngine.addRule({ event: 'integration.github.pr.merged', action: 'notify' });
      services.ruleEngine.start();

      services.eventBus.emit({
        type: 'integration.github.pr.merged',
        payload: { prNumber: 1, title: 'Test', repository: 'owner/repo' },
        timestamp: new Date(),
        source: 'integration-github',
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const notifs = await services.notificationRepo.findMany();
      expect(notifs.total).toBe(1);
      expect(notifs.notifications[0].title).toBe('GitHub PR 合并');
    });

    it('should listen to integration.github.issue.created via start()', async () => {
      services.ruleEngine.addRule({ event: 'integration.github.issue.created', action: 'notify' });
      services.ruleEngine.start();

      services.eventBus.emit({
        type: 'integration.github.issue.created',
        payload: { issueNumber: 1, title: 'Bug', repository: 'owner/repo' },
        timestamp: new Date(),
        source: 'integration-github',
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const notifs = await services.notificationRepo.findMany();
      expect(notifs.total).toBe(1);
      expect(notifs.notifications[0].title).toBe('GitHub Issue 创建');
    });

    it('should listen to requirement.created via start()', async () => {
      services.ruleEngine.addRule({ event: 'requirement.created', action: 'notify' });
      services.ruleEngine.start();

      services.eventBus.emit({
        type: 'requirement.created',
        payload: { requirementId: 'req-001', title: 'New requirement' },
        timestamp: new Date(),
        source: 'requirements',
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const notifs = await services.notificationRepo.findMany();
      expect(notifs.total).toBe(1);
      expect(notifs.notifications[0].title).toBe('新需求创建');
    });

    it('should listen to requirement.status.changed via start()', async () => {
      services.ruleEngine.addRule({ event: 'requirement.status.changed', action: 'notify' });
      services.ruleEngine.start();

      services.eventBus.emit({
        type: 'requirement.status.changed',
        payload: { requirementId: 'req-001', status: 'in_progress' },
        timestamp: new Date(),
        source: 'requirements',
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const notifs = await services.notificationRepo.findMany();
      expect(notifs.total).toBe(1);
      expect(notifs.notifications[0].title).toBe('需求状态变更');
    });

    it('should listen to requirement.mapped.to.task via start()', async () => {
      services.ruleEngine.addRule({ event: 'requirement.mapped.to.task', action: 'notify' });
      services.ruleEngine.start();

      services.eventBus.emit({
        type: 'requirement.mapped.to.task',
        payload: { requirementId: 'req-001', taskId: 'task-001' },
        timestamp: new Date(),
        source: 'requirements',
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const notifs = await services.notificationRepo.findMany();
      expect(notifs.total).toBe(1);
      expect(notifs.notifications[0].title).toBe('需求已映射到任务');
    });
  });
});
