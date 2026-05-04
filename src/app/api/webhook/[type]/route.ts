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
import { getPrisma } from '@/lib/db';
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

// Webhook signature verification using WEBHOOK_SECRET env var.
// If WEBHOOK_SECRET is set, all webhook requests must include a valid
// X-Webhook-Signature header (HMAC-SHA256 of the body).
// If WEBHOOK_SECRET is not set, webhooks are accepted without verification
// (single-admin/demo mode).

import { createHmac } from 'crypto';

function verifyWebhookSignature(body: string, signature: string | null): boolean {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return true; // No secret configured = open mode
  if (!signature) return false;
  const expected = createHmac('sha256', secret).update(body).digest('hex');
  try {
    return signature === expected || signature === `sha256=${expected}`;
  } catch {
    return false;
  }
}

let _service: IntegrationService | null = null;

function getService(): IntegrationService {
  if (_service) return _service;

  const logger = new Logger('webhook-receiver');
  const eventBus = new EventBus();
  const prisma = getPrisma();

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
  const { type } = await params;
  const logger = new Logger('webhook-receiver');

  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-webhook-signature');

    if (!verifyWebhookSignature(rawBody, signature)) {
      return NextResponse.json(
        { success: false, error: 'Invalid webhook signature' },
        { status: 401 },
      );
    }

    const payload = JSON.parse(rawBody);
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
