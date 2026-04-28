import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from './server';
import { IntegrationRepository, WebhookRepository } from '@/lib/modules/integration-core/integration.repository';
import { IntegrationService } from '@/lib/modules/integration-core/integration.service';
import { EventBus } from '@/lib/core/event-bus';
import { Logger } from '@/lib/core/logger';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { TaskRepository } from '@/lib/modules/task-core/task.repository';
import { TaskHistoryRepository } from '@/lib/modules/task-core/task-history.repository';
import { TaskDependencyRepository } from '@/lib/modules/task-core/task-dependency.repository';
import { TaskProgressService } from '@/lib/modules/task-core/task-progress.service';
import { TaskService } from '@/lib/modules/task-core/task.service';
import { GitHubAdapter } from '@/lib/modules/integration-github/github.adapter';
import { FeishuAdapter } from '@/lib/modules/integration-feishu/feishu.adapter';
import { NotionAdapter } from '@/lib/modules/integration-notion/notion.adapter';
import { WebhookAdapter } from '@/lib/modules/integration-webhook/webhook.adapter';
import { TelegramAdapter } from '@/lib/modules/integration-telegram/telegram.adapter';
import { WeChatAdapter } from '@/lib/modules/integration-wechat/wechat.adapter';

// Lazy-initialized services
let _integrationService: IntegrationService | null = null;

function getServices() {
  if (_integrationService) return { integrationService: _integrationService };

  const dbPath = process.env.DATABASE_URL?.replace(/^file:/, '') ?? './prisma/dev.db';
  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  const prisma = new PrismaClient({ adapter });
  const eventBus = new EventBus();
  const logger = new Logger('integration');

  const integrationRepo = new IntegrationRepository(prisma);
  const webhookRepo = new WebhookRepository(prisma);
  const taskRepo = new TaskRepository(prisma);
  const historyRepo = new TaskHistoryRepository(prisma);
  const depRepo = new TaskDependencyRepository(prisma);
  const progressService = new TaskProgressService(taskRepo, logger);
  const taskService = new TaskService(taskRepo, historyRepo, depRepo, progressService, eventBus, logger);

  _integrationService = new IntegrationService(integrationRepo, webhookRepo, taskService, eventBus, logger);

  // Register built-in adapters
  _integrationService.registerAdapter(new GitHubAdapter(logger));
  _integrationService.registerAdapter(new FeishuAdapter(logger));
  _integrationService.registerAdapter(new NotionAdapter(logger));
  _integrationService.registerAdapter(new WebhookAdapter(logger));
  _integrationService.registerAdapter(new TelegramAdapter(logger));
  _integrationService.registerAdapter(new WeChatAdapter(logger));

  return { integrationService: _integrationService };
}

export const integrationsRouter = createTRPCRouter({
  // List available adapter types
  adapterTypes: publicProcedure.query(() => {
    const { integrationService } = getServices();
    return integrationService.getAdapterTypes();
  }),

  // Create integration
  create: publicProcedure
    .input(z.object({
      type: z.string(),
      name: z.string().min(1),
      description: z.string().optional(),
      config: z.record(z.string(), z.unknown()),
    }))
    .mutation(async ({ input }) => {
      const { integrationService } = getServices();
      return integrationService.createIntegration(input);
    }),

  // List integrations
  list: publicProcedure
    .input(z.object({
      type: z.string().optional(),
      isActive: z.boolean().optional(),
    }).optional())
    .query(async ({ input }) => {
      const { integrationService } = getServices();
      return integrationService.listIntegrations(input);
    }),

  // Get integration
  get: publicProcedure.input(z.object({ id: z.string() })).query(async ({ input }) => {
    const { integrationService } = getServices();
    const integration = await integrationService.getIntegration(input.id);
    if (!integration) throw new Error('Integration not found');
    return integration;
  }),

  // Update integration
  update: publicProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      config: z.record(z.string(), z.unknown()).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { integrationService } = getServices();
      const { id, ...data } = input;
      return integrationService.updateIntegration(id, data);
    }),

  // Delete integration
  delete: publicProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    const { integrationService } = getServices();
    await integrationService.deleteIntegration(input.id);
    return { success: true };
  }),

  // Test connection
  testConnection: publicProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    const { integrationService } = getServices();
    return integrationService.testConnection(input.id);
  }),

  // Trigger sync
  sync: publicProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    const { integrationService } = getServices();
    return integrationService.syncIntegration(input.id);
  }),
});
