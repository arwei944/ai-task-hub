// ============================================================
// Webhook Receiver API Route
// ============================================================
//
// Generic endpoint for receiving webhooks from any integration.
// The integration type is determined by the :type path parameter.
//
// POST /api/webhook/:type
//

import { NextRequest, NextResponse } from 'next/server';
import { Logger } from '@/lib/core/logger';
import { IntegrationService } from '@/lib/modules/integration-core/integration.service';
import { IntegrationRepository, WebhookRepository } from '@/lib/modules/integration-core/integration.repository';
import { EventBus } from '@/lib/core/event-bus';
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
import { AuthService } from '@/lib/modules/auth/auth.service';
import { UserRepository } from '@/lib/modules/auth/user.repository';

function getAuthService(): AuthService {
  const logger = new Logger('auth');
  const dbPath = process.env.DATABASE_URL?.replace(/^file:/, '') ?? './data/dev.db';
  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  const prisma = new PrismaClient({ adapter });
  const userRepo = new UserRepository(prisma);
  return new AuthService(userRepo, logger);
}

let _service: IntegrationService | null = null;

function getService(): IntegrationService {
  if (_service) return _service;

  const logger = new Logger('webhook-receiver');
  const eventBus = new EventBus();
  const dbPath = process.env.DATABASE_URL?.replace(/^file:/, '') ?? './prisma/dev.db';
  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  const prisma = new PrismaClient({ adapter });

  const integrationRepo = new IntegrationRepository(prisma);
  const webhookRepo = new WebhookRepository(prisma);
  const taskRepo = new TaskRepository(prisma);
  const historyRepo = new TaskHistoryRepository(prisma);
  const depRepo = new TaskDependencyRepository(prisma);
  const progressService = new TaskProgressService(taskRepo, logger);
  const taskService = new TaskService(taskRepo, historyRepo, depRepo, progressService, eventBus, logger);

  _service = new IntegrationService(integrationRepo, webhookRepo, taskService, eventBus, logger);
  _service.registerAdapter(new GitHubAdapter(logger));
  _service.registerAdapter(new FeishuAdapter(logger));
  _service.registerAdapter(new NotionAdapter(logger));
  _service.registerAdapter(new WebhookAdapter(logger));
  _service.registerAdapter(new TelegramAdapter(logger));
  _service.registerAdapter(new WeChatAdapter(logger));

  return _service;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> },
) {
  // Auth check
  const authService = getAuthService();
  const user = await authService.getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { type } = await params;
  const logger = new Logger('webhook-receiver');

  try {
    const payload = await request.json();
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const service = getService();
    await service.handleWebhook(type, payload, headers);

    return NextResponse.json({ success: true, type });
  } catch (error: any) {
    logger.error(`Webhook error (${type}): ${error.message}`);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
