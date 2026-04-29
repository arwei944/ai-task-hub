import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger } from '@/lib/core/logger';
import { NotionAdapter } from '@/lib/modules/integration-notion/notion.adapter';

const originalEnv = { ...process.env };

describe('NotionAdapter', () => {
  let adapter: NotionAdapter;
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger('test');
    adapter = new NotionAdapter(logger);
    delete process.env.NOTION_TOKEN;
    delete process.env.NOTION_DATABASE_ID;
  });

  afterEach(() => {
    process.env.NOTION_TOKEN = originalEnv.NOTION_TOKEN;
    process.env.NOTION_DATABASE_ID = originalEnv.NOTION_DATABASE_ID;
    vi.restoreAllMocks();
  });

  // --- 基本属性 ---

  it('should have correct type and name', () => {
    expect(adapter.type).toBe('notion');
    expect(adapter.name).toBe('Notion');
  });

  // --- pullTasks ---

  it('should return error when NOTION_TOKEN not configured', async () => {
    process.env.NOTION_DATABASE_ID = 'db_id';
    const result = await adapter.pullTasks();
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('NOTION_TOKEN');
  });

  it('should return error when NOTION_DATABASE_ID not configured', async () => {
    process.env.NOTION_TOKEN = 'token';
    const result = await adapter.pullTasks();
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('NOTION_DATABASE_ID');
  });

  it('should fetch pages from Notion database', async () => {
    process.env.NOTION_TOKEN = 'test_token';
    process.env.NOTION_DATABASE_ID = 'test_db_id';

    const mockPages = [
      {
        id: 'page1',
        properties: {
          Name: { type: 'title', title: [{ plain_text: 'Task 1' }] },
        },
      },
      {
        id: 'page2',
        properties: {
          Name: { type: 'title', title: [{ plain_text: 'Task 2' }] },
        },
      },
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ results: mockPages }),
    } as Response);

    const result = await adapter.pullTasks();
    expect(result.success).toBe(true);
    expect(result.synced).toBe(2);
    expect(result.created).toBe(2);
  });

  it('should extract title from Notion page properties', async () => {
    process.env.NOTION_TOKEN = 'test_token';
    process.env.NOTION_DATABASE_ID = 'test_db_id';

    const mockPages = [
      {
        id: 'page1',
        properties: {
          Title: { type: 'title', title: [{ plain_text: 'My Task' }] },
          Status: { type: 'select', select: { name: 'In Progress' } },
        },
      },
      {
        id: 'page2',
        properties: {
          SomeOther: { type: 'rich_text', rich_text: [{ plain_text: 'Not a title' }] },
        },
      },
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ results: mockPages }),
    } as Response);

    const result = await adapter.pullTasks();
    expect(result.synced).toBe(2);
  });

  it('should use Untitled when no title property found', async () => {
    process.env.NOTION_TOKEN = 'test_token';
    process.env.NOTION_DATABASE_ID = 'test_db_id';

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{ id: 'page1', properties: {} }],
      }),
    } as Response);

    const result = await adapter.pullTasks();
    expect(result.synced).toBe(1);
  });

  it('should handle Notion API error response', async () => {
    process.env.NOTION_TOKEN = 'test_token';
    process.env.NOTION_DATABASE_ID = 'test_db_id';

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    } as Response);

    const result = await adapter.pullTasks();
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('401');
  });

  it('should handle network error', async () => {
    process.env.NOTION_TOKEN = 'test_token';
    process.env.NOTION_DATABASE_ID = 'test_db_id';

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    const result = await adapter.pullTasks();
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('Network error');
  });

  it('should handle empty results', async () => {
    process.env.NOTION_TOKEN = 'test_token';
    process.env.NOTION_DATABASE_ID = 'test_db_id';

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    } as Response);

    const result = await adapter.pullTasks();
    expect(result.success).toBe(true);
    expect(result.synced).toBe(0);
  });

  it('should pass since option as filter', async () => {
    process.env.NOTION_TOKEN = 'test_token';
    process.env.NOTION_DATABASE_ID = 'test_db_id';

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    } as Response);

    const since = new Date('2026-01-01');
    await adapter.pullTasks({ since });

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.filter).toBeDefined();
    expect(body.filter.timestamp).toBe('last_edited_time');
  });

  // --- pushTask ---

  it('should return error when pushing without config', async () => {
    const result = await adapter.pushTask({ title: 'Test' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not configured');
  });

  it('should create a new page via pushTask', async () => {
    process.env.NOTION_TOKEN = 'test_token';
    process.env.NOTION_DATABASE_ID = 'test_db_id';

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'new_page_id', url: 'https://notion.so/page' }),
    } as Response);

    const result = await adapter.pushTask({ title: 'New Task', description: 'Body' });
    expect(result.success).toBe(true);
    expect(result.externalId).toBe('new_page_id');
    expect(result.externalUrl).toContain('notion.so');
  });

  it('should update an existing page via pushTask', async () => {
    process.env.NOTION_TOKEN = 'test_token';
    process.env.NOTION_DATABASE_ID = 'test_db_id';

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'existing_page_id' }),
    } as Response);

    const result = await adapter.pushTask({ title: 'Updated', externalId: 'existing_page_id' });
    expect(result.success).toBe(true);

    // Should use PATCH method
    const fetchCall = (globalThis.fetch as any).mock.calls.find(
      (c: any) => c[1]?.method === 'PATCH'
    );
    expect(fetchCall).toBeDefined();
  });

  it('should map status to Notion select values', async () => {
    process.env.NOTION_TOKEN = 'test_token';
    process.env.NOTION_DATABASE_ID = 'test_db_id';

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'page_id' }),
    } as Response);

    await adapter.pushTask({ title: 'Test', status: 'in_progress' });

    const createCall = fetchSpy.mock.calls.find((c: any) => c[1]?.method === 'POST');
    const body = JSON.parse(createCall[1].body);
    expect(body.properties.Status.select.name).toBe('In Progress');
  });

  it('should map priority to Notion select values', async () => {
    process.env.NOTION_TOKEN = 'test_token';
    process.env.NOTION_DATABASE_ID = 'test_db_id';

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'page_id' }),
    } as Response);

    await adapter.pushTask({ title: 'Test', priority: 'high' });

    const createCall = fetchSpy.mock.calls.find((c: any) => c[1]?.method === 'POST');
    const body = JSON.parse(createCall[1].body);
    expect(body.properties.Priority.select.name).toBe('High');
  });

  it('should handle pushTask API error', async () => {
    process.env.NOTION_TOKEN = 'test_token';
    process.env.NOTION_DATABASE_ID = 'test_db_id';

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 400,
    } as Response);

    const result = await adapter.pushTask({ title: 'Test' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('400');
  });

  // --- handleWebhook ---

  it('should handle page.created webhook event', async () => {
    await adapter.handleWebhook({ type: 'page.created', id: 'page1' });
    // Should not throw
  });

  it('should handle page.updated webhook event', async () => {
    await adapter.handleWebhook({ type: 'page.updated', id: 'page1' });
  });

  it('should handle unknown webhook event', async () => {
    await adapter.handleWebhook({ type: 'unknown.event' });
  });

  // --- testConnection ---

  it('should test connection successfully', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'db_id' }),
    } as Response);

    const result = await adapter.testConnection({ token: 'test', database_id: 'db_id' });
    expect(result.success).toBe(true);
  });

  it('should fail connection test without credentials', async () => {
    const result = await adapter.testConnection({});
    expect(result.success).toBe(false);
    expect(result.error).toContain('credentials not provided');
  });

  it('should fail connection test on API error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
    } as Response);

    const result = await adapter.testConnection({ token: 'test', database_id: 'db_id' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('401');
  });

  it('should fail connection test on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    const result = await adapter.testConnection({ token: 'test', database_id: 'db_id' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Network error');
  });
});
