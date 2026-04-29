// ============================================================
// Webhook API Route Integration Tests - /api/webhook/[type]
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock all the heavy dependencies as classes
const mockHandleWebhook = vi.fn();

vi.mock('@/lib/core/logger', () => ({
  Logger: vi.fn(function (this: any) {
    this.info = vi.fn();
    this.warn = vi.fn();
    this.error = vi.fn();
    this.debug = vi.fn();
  }),
}));

vi.mock('@/lib/core/event-bus', () => ({
  EventBus: vi.fn(function (this: any) {
    this.on = vi.fn();
    this.emit = vi.fn();
    this.off = vi.fn();
  }),
}));

vi.mock('@prisma/adapter-better-sqlite3', () => ({
  PrismaBetterSqlite3: vi.fn(function (this: any) {}),
}));

vi.mock('@/generated/prisma/client', () => ({
  PrismaClient: vi.fn(function (this: any) {}),
}));

vi.mock('@/lib/modules/integration-core/integration.repository', () => ({
  IntegrationRepository: vi.fn(function (this: any) {}),
  WebhookRepository: vi.fn(function (this: any) {}),
}));

vi.mock('@/lib/modules/integration-core/integration.service', () => ({
  IntegrationService: vi.fn(function (this: any) {
    this.handleWebhook = mockHandleWebhook;
    this.registerAdapter = vi.fn();
  }),
}));

vi.mock('@/lib/modules/task-core/task.repository', () => ({
  TaskRepository: vi.fn(function (this: any) {}),
}));

vi.mock('@/lib/modules/task-core/task-history.repository', () => ({
  TaskHistoryRepository: vi.fn(function (this: any) {}),
}));

vi.mock('@/lib/modules/task-core/task-dependency.repository', () => ({
  TaskDependencyRepository: vi.fn(function (this: any) {}),
}));

vi.mock('@/lib/modules/task-core/task-progress.service', () => ({
  TaskProgressService: vi.fn(function (this: any) {}),
}));

vi.mock('@/lib/modules/task-core/task.service', () => ({
  TaskService: vi.fn(function (this: any) {}),
}));

vi.mock('@/lib/modules/integration-github/github.adapter', () => ({
  GitHubAdapter: vi.fn(function (this: any) {
    this.type = 'github';
    this.name = 'GitHub';
  }),
}));

vi.mock('@/lib/modules/integration-feishu/feishu.adapter', () => ({
  FeishuAdapter: vi.fn(function (this: any) {
    this.type = 'feishu';
    this.name = 'Feishu';
  }),
}));

vi.mock('@/lib/modules/integration-notion/notion.adapter', () => ({
  NotionAdapter: vi.fn(function (this: any) {
    this.type = 'notion';
    this.name = 'Notion';
  }),
}));

vi.mock('@/lib/modules/integration-webhook/webhook.adapter', () => ({
  WebhookAdapter: vi.fn(function (this: any) {
    this.type = 'webhook';
    this.name = 'Webhook';
  }),
}));

vi.mock('@/lib/modules/integration-telegram/telegram.adapter', () => ({
  TelegramAdapter: vi.fn(function (this: any) {
    this.type = 'telegram';
    this.name = 'Telegram';
  }),
}));

vi.mock('@/lib/modules/integration-wechat/wechat.adapter', () => ({
  WeChatAdapter: vi.fn(function (this: any) {
    this.type = 'wechat';
    this.name = 'WeChat';
  }),
}));

import { POST } from '@/app/api/webhook/[type]/route';

function createMockWebhookRequest(
  type: string,
  body: unknown,
  headers: Record<string, string> = {},
): { request: Request; params: { type: string } } {
  const url = `http://localhost:3000/api/webhook/${type}`;
  const request = new Request(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  }) as Request;

  return {
    request,
    params: { type },
  };
}

describe('POST /api/webhook/[type]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHandleWebhook.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==================== Normal Path Tests ====================

  it('should return 200 on successful webhook processing', async () => {
    const { request, params } = createMockWebhookRequest('github', {
      action: 'opened',
      issue: { title: 'Bug fix' },
    });

    const response = await POST(request, { params: Promise.resolve(params) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.type).toBe('github');
  });

  it('should pass webhook type to service', async () => {
    const { request, params } = createMockWebhookRequest('feishu', {
      event: 'message',
    });

    await POST(request, { params: Promise.resolve(params) });

    expect(mockHandleWebhook).toHaveBeenCalledWith(
      'feishu',
      expect.any(Object),
      expect.any(Object),
    );
  });

  it('should pass payload body to service', async () => {
    const payload = { action: 'created', repository: { name: 'test-repo' } };
    const { request, params } = createMockWebhookRequest('github', payload);

    await POST(request, { params: Promise.resolve(params) });

    const callArgs = mockHandleWebhook.mock.calls[0];
    expect(callArgs[1]).toEqual(payload);
  });

  it('should pass request headers to service', async () => {
    const { request, params } = createMockWebhookRequest(
      'github',
      { action: 'push' },
      { 'X-GitHub-Event': 'push', 'X-GitHub-Delivery': '12345' },
    );

    await POST(request, { params: Promise.resolve(params) });

    const callArgs = mockHandleWebhook.mock.calls[0];
    const headers = callArgs[2];
    expect(headers['x-github-event']).toBe('push');
    expect(headers['x-github-delivery']).toBe('12345');
  });

  it('should handle different webhook types', async () => {
    const types = ['github', 'feishu', 'notion', 'webhook', 'telegram', 'wechat'];

    for (const type of types) {
      mockHandleWebhook.mockClear();
      const { request, params } = createMockWebhookRequest(type, { test: true });
      const response = await POST(request, { params: Promise.resolve(params) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.type).toBe(type);
      expect(mockHandleWebhook).toHaveBeenCalledWith(
        type,
        expect.any(Object),
        expect.any(Object),
      );
    }
  });

  it('should handle complex JSON payloads', async () => {
    const complexPayload = {
      action: 'completed',
      task: {
        id: 'task-123',
        title: 'Deploy to production',
        status: 'done',
        assignees: [{ id: 'user-1', name: 'Alice' }],
      },
      metadata: {
        timestamp: '2024-01-15T10:30:00Z',
        source: 'ci-pipeline',
      },
    };

    const { request, params } = createMockWebhookRequest('webhook', complexPayload);
    const response = await POST(request, { params: Promise.resolve(params) });

    expect(response.status).toBe(200);
    const callArgs = mockHandleWebhook.mock.calls[0];
    expect(callArgs[1]).toEqual(complexPayload);
  });

  // ==================== Error Path Tests ====================

  it('should return 500 when service throws an error', async () => {
    mockHandleWebhook.mockRejectedValue(new Error('Adapter not found'));

    const { request, params } = createMockWebhookRequest('unknown-type', {});
    const response = await POST(request, { params: Promise.resolve(params) });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Adapter not found');
  });

  it('should return 500 when payload is invalid JSON', async () => {
    const url = 'http://localhost:3000/api/webhook/github';
    const request = new Request(url, {
      method: 'POST',
      body: 'not valid json {{{',
      headers: { 'Content-Type': 'application/json' },
    }) as Request;

    const response = await POST(request, {
      params: Promise.resolve({ type: 'github' }),
    });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBeDefined();
  });

  it('should handle empty payload body', async () => {
    const { request, params } = createMockWebhookRequest('github', {});

    const response = await POST(request, { params: Promise.resolve(params) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('should handle service errors with different message types', async () => {
    const errors = [
      new Error('Network timeout'),
      new Error('Permission denied'),
      new Error('Rate limit exceeded'),
    ];

    for (const error of errors) {
      mockHandleWebhook.mockRejectedValueOnce(error);
      const { request, params } = createMockWebhookRequest('github', { test: true });
      const response = await POST(request, { params: Promise.resolve(params) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe(error.message);
    }
  });
});
