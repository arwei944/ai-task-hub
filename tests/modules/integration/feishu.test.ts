import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger } from '@/lib/core/logger';
import { FeishuAdapter } from '@/lib/modules/integration-feishu/feishu.adapter';

const originalEnv = { ...process.env };

describe('FeishuAdapter', () => {
  let adapter: FeishuAdapter;
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger('test');
    adapter = new FeishuAdapter(logger);
    delete process.env.FEISHU_APP_ID;
    delete process.env.FEISHU_APP_SECRET;
  });

  afterEach(() => {
    process.env.FEISHU_APP_ID = originalEnv.FEISHU_APP_ID;
    process.env.FEISHU_APP_SECRET = originalEnv.FEISHU_APP_SECRET;
    vi.restoreAllMocks();
  });

  // --- 基本属性 ---

  it('should have correct type and name', () => {
    expect(adapter.type).toBe('feishu');
    expect(adapter.name).toBe('飞书');
  });

  // --- pullTasks ---

  it('should return error when credentials not configured', async () => {
    const result = await adapter.pullTasks();
    expect(result.success).toBe(false);
    expect(result.synced).toBe(0);
    expect(result.errors[0]).toContain('FEISHU');
  });

  it('should return error when only APP_ID configured', async () => {
    process.env.FEISHU_APP_ID = 'app_id';
    const result = await adapter.pullTasks();
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('FEISHU');
  });

  it('should fetch tasks from Feishu API', async () => {
    process.env.FEISHU_APP_ID = 'test_app_id';
    process.env.FEISHU_APP_SECRET = 'test_secret';

    // Mock token request
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      if (url.includes('tenant_access_token')) {
        return {
          ok: true,
          json: async () => ({ code: 0, tenant_access_token: 'mock_token' }),
        } as Response;
      }
      if (url.includes('/tasks')) {
        return {
          ok: true,
          json: async () => ({
            code: 0,
            data: {
              items: [
                { task_id: 'task1', name: '任务1', description: '描述1', creator: 'user1' },
                { task_id: 'task2', name: '任务2', description: '描述2', creator: 'user2' },
              ],
            },
          }),
        } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    });

    const result = await adapter.pullTasks();
    expect(result.success).toBe(true);
    expect(result.synced).toBe(2);
    expect(result.created).toBe(2);
  });

  it('should handle auth failure', async () => {
    process.env.FEISHU_APP_ID = 'test_app_id';
    process.env.FEISHU_APP_SECRET = 'wrong_secret';

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ code: 1001, msg: 'invalid app_id or app_secret' }),
    } as Response);

    const result = await adapter.pullTasks();
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('auth failed');
  });

  it('should handle task list API error', async () => {
    process.env.FEISHU_APP_ID = 'test_app_id';
    process.env.FEISHU_APP_SECRET = 'test_secret';

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      if (url.includes('tenant_access_token')) {
        return {
          ok: true,
          json: async () => ({ code: 0, tenant_access_token: 'mock_token' }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({ code: 9999, msg: 'internal error' }),
      } as Response;
    });

    const result = await adapter.pullTasks();
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('Feishu API error');
  });

  it('should handle network error', async () => {
    process.env.FEISHU_APP_ID = 'test_app_id';
    process.env.FEISHU_APP_SECRET = 'test_secret';

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    const result = await adapter.pullTasks();
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('Network error');
  });

  it('should handle empty task list', async () => {
    process.env.FEISHU_APP_ID = 'test_app_id';
    process.env.FEISHU_APP_SECRET = 'test_secret';

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      if (url.includes('tenant_access_token')) {
        return {
          ok: true,
          json: async () => ({ code: 0, tenant_access_token: 'mock_token' }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({ code: 0, data: { items: [] } }),
      } as Response;
    });

    const result = await adapter.pullTasks();
    expect(result.success).toBe(true);
    expect(result.synced).toBe(0);
  });

  // --- pushTask ---

  it('should return error when pushing without config', async () => {
    const result = await adapter.pushTask({ title: 'Test' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not configured');
  });

  it('should create a task via pushTask', async () => {
    process.env.FEISHU_APP_ID = 'test_app_id';
    process.env.FEISHU_APP_SECRET = 'test_secret';

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      if (url.includes('tenant_access_token')) {
        return {
          ok: true,
          json: async () => ({ code: 0, tenant_access_token: 'mock_token' }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({ code: 0, data: { task_id: 'new_task_id' } }),
      } as Response;
    });

    const result = await adapter.pushTask({ title: 'New Task', description: 'Body' });
    expect(result.success).toBe(true);
    expect(result.externalId).toBe('new_task_id');
  });

  it('should map done status to completed flag', async () => {
    process.env.FEISHU_APP_ID = 'test_app_id';
    process.env.FEISHU_APP_SECRET = 'test_secret';

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      if (url.includes('tenant_access_token')) {
        return {
          ok: true,
          json: async () => ({ code: 0, tenant_access_token: 'mock_token' }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({ code: 0, data: { task_id: 'id' } }),
      } as Response;
    });

    await adapter.pushTask({ title: 'Done', status: 'done' });

    const createCall = fetchSpy.mock.calls.find((c: any) => !c[0].includes('tenant_access_token'));
    const body = JSON.parse(createCall[1].body);
    expect(body.completed).toBe(true);
  });

  it('should handle pushTask API error', async () => {
    process.env.FEISHU_APP_ID = 'test_app_id';
    process.env.FEISHU_APP_SECRET = 'test_secret';

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      if (url.includes('tenant_access_token')) {
        return {
          ok: true,
          json: async () => ({ code: 0, tenant_access_token: 'mock_token' }),
        } as Response;
      }
      return {
        ok: false,
        status: 500,
      } as Response;
    });

    const result = await adapter.pushTask({ title: 'Test' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('500');
  });

  // --- handleWebhook ---

  it('should handle task.created webhook event', async () => {
    await adapter.handleWebhook({ event: 'task.created', key: 'task_key' });
    // Should not throw
  });

  it('should handle task.updated webhook event', async () => {
    await adapter.handleWebhook({ event: 'task.updated', key: 'task_key' });
  });

  it('should handle unknown webhook event', async () => {
    await adapter.handleWebhook({ event: 'unknown.event' });
  });

  // --- testConnection ---

  it('should test connection successfully', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ code: 0, tenant_access_token: 'token' }),
    } as Response);

    const result = await adapter.testConnection({ app_id: 'test', app_secret: 'secret' });
    expect(result.success).toBe(true);
  });

  it('should fail connection test without credentials', async () => {
    const result = await adapter.testConnection({});
    expect(result.success).toBe(false);
    expect(result.error).toContain('credentials not provided');
  });

  it('should fail connection test on auth failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ code: 1001, msg: 'invalid credentials' }),
    } as Response);

    const result = await adapter.testConnection({ app_id: 'test', app_secret: 'wrong' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('invalid credentials');
  });

  it('should fail connection test on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    const result = await adapter.testConnection({ app_id: 'test', app_secret: 'secret' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Network error');
  });
});
