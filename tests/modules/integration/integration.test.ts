import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventBus } from '@/lib/core/event-bus';
import { Logger } from '@/lib/core/logger';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { IntegrationRepository, WebhookRepository } from '@/lib/modules/integration-core/integration.repository';
import { IntegrationService } from '@/lib/modules/integration-core/integration.service';
import { GitHubAdapter } from '@/lib/modules/integration-github/github.adapter';
import { FeishuAdapter } from '@/lib/modules/integration-feishu/feishu.adapter';
import { NotionAdapter } from '@/lib/modules/integration-notion/notion.adapter';
import { WebhookAdapter, type WebhookRule } from '@/lib/modules/integration-webhook/webhook.adapter';
import { TaskRepository } from '@/lib/modules/task-core/task.repository';
import { TaskHistoryRepository } from '@/lib/modules/task-core/task-history.repository';
import { TaskDependencyRepository } from '@/lib/modules/task-core/task-dependency.repository';
import { TaskProgressService } from '@/lib/modules/task-core/task-progress.service';
import { TaskService } from '@/lib/modules/task-core/task.service';
import type { IntegrationAdapter, SyncResult } from '@/lib/modules/integration-core/types';
import { join } from 'node:path';

const TEST_DB_PATH = join(process.cwd(), 'test-db', 'test-task-core.db');

function createTestServices() {
  const adapter = new PrismaBetterSqlite3({ url: TEST_DB_PATH });
  const prisma = new PrismaClient({ adapter });
  const eventBus = new EventBus();
  const logger = new Logger('test');

  const integrationRepo = new IntegrationRepository(prisma);
  const webhookRepo = new WebhookRepository(prisma);
  const taskRepo = new TaskRepository(prisma);
  const historyRepo = new TaskHistoryRepository(prisma);
  const depRepo = new TaskDependencyRepository(prisma);
  const progressService = new TaskProgressService(taskRepo, logger);
  const taskService = new TaskService(taskRepo, historyRepo, depRepo, progressService, eventBus, logger);

  const integrationService = new IntegrationService(integrationRepo, webhookRepo, taskService, eventBus, logger);

  return { prisma, eventBus, logger, integrationRepo, webhookRepo, integrationService };
}

describe('IntegrationModule', () => {
  let services: ReturnType<typeof createTestServices>;

  beforeEach(async () => {
    services = createTestServices();
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

  describe('IntegrationService', () => {
    it('should register adapters', () => {
      services.integrationService.registerAdapter(new GitHubAdapter(services.logger));
      services.integrationService.registerAdapter(new FeishuAdapter(services.logger));
      services.integrationService.registerAdapter(new NotionAdapter(services.logger));
      services.integrationService.registerAdapter(new WebhookAdapter(services.logger));

      const types = services.integrationService.getAdapterTypes();
      expect(types).toHaveLength(4);
      expect(types.map(t => t.type)).toEqual(['github', 'feishu', 'notion', 'webhook']);
    });

    it('should create an integration', async () => {
      services.integrationService.registerAdapter(new GitHubAdapter(services.logger));

      const integration = await services.integrationService.createIntegration({
        type: 'github',
        name: 'My GitHub',
        config: { token: 'test', repo: 'owner/repo' },
      });

      expect(integration.id).toBeDefined();
      expect(integration.type).toBe('github');
      expect(integration.name).toBe('My GitHub');
      expect(integration.config).toEqual({ token: 'test', repo: 'owner/repo' });
    });

    it('should reject unknown integration type', async () => {
      await expect(
        services.integrationService.createIntegration({
          type: 'unknown',
          name: 'Test',
          config: {},
        }),
      ).rejects.toThrow('Unknown integration type');
    });

    it('should list integrations', async () => {
      services.integrationService.registerAdapter(new GitHubAdapter(services.logger));
      services.integrationService.registerAdapter(new NotionAdapter(services.logger));

      await services.integrationService.createIntegration({ type: 'github', name: 'GH1', config: {} });
      await services.integrationService.createIntegration({ type: 'notion', name: 'N1', config: {} });

      const all = await services.integrationService.listIntegrations();
      expect(all).toHaveLength(2);

      const gh = await services.integrationService.listIntegrations({ type: 'github' });
      expect(gh).toHaveLength(1);
    });

    it('should update an integration', async () => {
      services.integrationService.registerAdapter(new GitHubAdapter(services.logger));
      const created = await services.integrationService.createIntegration({ type: 'github', name: 'Old', config: {} });

      const updated = await services.integrationService.updateIntegration(created.id, { name: 'New', isActive: false });
      expect(updated!.name).toBe('New');
      expect(updated!.isActive).toBe(false);
    });

    it('should delete an integration', async () => {
      services.integrationService.registerAdapter(new GitHubAdapter(services.logger));
      const created = await services.integrationService.createIntegration({ type: 'github', name: 'To Delete', config: {} });

      await services.integrationService.deleteIntegration(created.id);
      const all = await services.integrationService.listIntegrations();
      expect(all).toHaveLength(0);
    });

    it('should test connection', async () => {
      services.integrationService.registerAdapter(new WebhookAdapter(services.logger));
      const created = await services.integrationService.createIntegration({ type: 'webhook', name: 'Test', config: {} });

      const result = await services.integrationService.testConnection(created.id);
      expect(result.success).toBe(true);
    });

    it('should sync integration', async () => {
      services.integrationService.registerAdapter(new WebhookAdapter(services.logger));
      const created = await services.integrationService.createIntegration({ type: 'webhook', name: 'Test', config: {} });

      const result = await services.integrationService.syncIntegration(created.id);
      expect(result.success).toBe(true);
    });
  });

  describe('GitHubAdapter', () => {
    it('should return error when token not configured', async () => {
      const adapter = new GitHubAdapter(services.logger);
      const result = await adapter.pullTasks();
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('GITHUB_TOKEN');
    });

    it('should return error when repo not configured', async () => {
      process.env.GITHUB_TOKEN = 'test_token';
      const adapter = new GitHubAdapter(services.logger);
      const result = await adapter.pullTasks();
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('GITHUB_REPO');
      delete process.env.GITHUB_TOKEN;
    });

    it('should handle webhook events', async () => {
      const adapter = new GitHubAdapter(services.logger);
      // Should not throw
      await adapter.handleWebhook(
        { action: 'opened', issue: { number: 1, title: 'Test' } },
        { 'x-github-event': 'issues' },
      );
    });

    it('should test connection without config', async () => {
      const adapter = new GitHubAdapter(services.logger);
      const result = await adapter.testConnection({});
      expect(result.success).toBe(false);
      expect(result.error).toContain('No GitHub token');
    });
  });

  describe('FeishuAdapter', () => {
    it('should return error when credentials not configured', async () => {
      const adapter = new FeishuAdapter(services.logger);
      const result = await adapter.pullTasks();
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('FEISHU');
    });

    it('should test connection without config', async () => {
      const adapter = new FeishuAdapter(services.logger);
      const result = await adapter.testConnection({});
      expect(result.success).toBe(false);
    });
  });

  describe('NotionAdapter', () => {
    it('should return error when credentials not configured', async () => {
      const adapter = new NotionAdapter(services.logger);
      const result = await adapter.pullTasks();
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('NOTION');
    });

    it('should test connection without config', async () => {
      const adapter = new NotionAdapter(services.logger);
      const result = await adapter.testConnection({});
      expect(result.success).toBe(false);
    });
  });

  describe('WebhookAdapter', () => {
    it('should process webhook rules', async () => {
      const adapter = new WebhookAdapter(services.logger);
      adapter.addRule({
        id: 'rule1',
        name: 'Extract title',
        titlePath: 'data.title',
        descriptionPath: 'data.body',
      });

      await adapter.handleWebhook({
        data: { title: 'New Task', body: 'Description here' },
      });

      expect(adapter.getRules()).toHaveLength(1);
    });

    it('should match rules with conditions', async () => {
      const adapter = new WebhookAdapter(services.logger);
      adapter.addRule({
        id: 'rule1',
        name: 'Only issues',
        titlePath: 'issue.title',
        conditionPath: 'issue.state',
        conditionValue: 'open',
      });

      // Should match
      await adapter.handleWebhook({
        issue: { title: 'Open Issue', state: 'open' },
      });

      // Should not match
      await adapter.handleWebhook({
        issue: { title: 'Closed Issue', state: 'closed' },
      });
    });

    it('should verify signatures', () => {
      const adapter = new WebhookAdapter(services.logger);
      const secret = 'test-secret';
      const payload = '{"test": true}';
      const signature = adapter.verifySignature(payload, 'wrong', secret);
      expect(signature).toBe(false);
    });

    it('should always pass testConnection', async () => {
      const adapter = new WebhookAdapter(services.logger);
      const result = await adapter.testConnection({});
      expect(result.success).toBe(true);
    });

    it('should not support push', async () => {
      const adapter = new WebhookAdapter(services.logger);
      const result = await adapter.pushTask({ title: 'test' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('does not support push');
    });
  });
});
