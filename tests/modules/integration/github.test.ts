import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger } from '@/lib/core/logger';
import { GitHubAdapter } from '@/lib/modules/integration-github/github.adapter';

// Save original env
const originalEnv = { ...process.env };

describe('GitHubAdapter', () => {
  let adapter: GitHubAdapter;
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger('test');
    adapter = new GitHubAdapter(logger);
    delete process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_REPO;
  });

  afterEach(() => {
    process.env.GITHUB_TOKEN = originalEnv.GITHUB_TOKEN;
    process.env.GITHUB_REPO = originalEnv.GITHUB_REPO;
    vi.restoreAllMocks();
  });

  // --- 基本属性 ---

  it('should have correct type and name', () => {
    expect(adapter.type).toBe('github');
    expect(adapter.name).toBe('GitHub');
  });

  // --- pullTasks ---

  it('should return error when GITHUB_TOKEN not configured', async () => {
    const result = await adapter.pullTasks();
    expect(result.success).toBe(false);
    expect(result.synced).toBe(0);
    expect(result.errors[0]).toContain('GITHUB_TOKEN');
  });

  it('should return error when GITHUB_REPO not configured', async () => {
    process.env.GITHUB_TOKEN = 'test_token';
    const result = await adapter.pullTasks();
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('GITHUB_REPO');
  });

  it('should fetch issues and filter out pull requests', async () => {
    process.env.GITHUB_TOKEN = 'test_token';
    process.env.GITHUB_REPO = 'owner/repo';

    const mockIssues = [
      { number: 1, title: 'Bug fix', body: 'Fix bug', user: { login: 'user1' }, labels: [{ name: 'bug' }] },
      { number: 2, title: 'Feature', body: 'New feature', user: { login: 'user2' }, pull_request: { url: 'http' } },
      { number: 3, title: 'Docs', body: null, user: { login: 'user3' }, labels: [] },
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockIssues,
    } as Response);

    const result = await adapter.pullTasks();
    expect(result.success).toBe(true);
    expect(result.synced).toBe(2); // PR filtered out
    expect(result.created).toBe(2);
  });

  it('should handle GitHub API error response', async () => {
    process.env.GITHUB_TOKEN = 'test_token';
    process.env.GITHUB_REPO = 'owner/repo';

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
    process.env.GITHUB_TOKEN = 'test_token';
    process.env.GITHUB_REPO = 'owner/repo';

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    const result = await adapter.pullTasks();
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('Network error');
  });

  it('should extract priority from labels', async () => {
    process.env.GITHUB_TOKEN = 'test_token';
    process.env.GITHUB_REPO = 'owner/repo';

    const mockIssues = [
      { number: 1, title: 'Urgent issue', body: '', user: { login: 'user1' }, labels: [{ name: 'urgent' }] },
      { number: 2, title: 'Low issue', body: '', user: { login: 'user2' }, labels: [{ name: 'low' }] },
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockIssues,
    } as Response);

    const result = await adapter.pullTasks();
    expect(result.success).toBe(true);
    expect(result.synced).toBe(2);
  });

  it('should pass since option as If-Modified-Since header', async () => {
    process.env.GITHUB_TOKEN = 'test_token';
    process.env.GITHUB_REPO = 'owner/repo';

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);

    const since = new Date('2026-01-01');
    await adapter.pullTasks({ since });

    expect(fetchSpy).toHaveBeenCalled();
    const headers = fetchSpy.mock.calls[0][1] as any;
    expect(headers.headers['If-Modified-Since']).toBe(since.toUTCString());
  });

  // --- pushTask ---

  it('should return error when pushing without config', async () => {
    const result = await adapter.pushTask({ title: 'Test' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not configured');
  });

  it('should create a new issue via pushTask', async () => {
    process.env.GITHUB_TOKEN = 'test_token';
    process.env.GITHUB_REPO = 'owner/repo';

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ number: 42, html_url: 'https://github.com/owner/repo/issues/42' }),
    } as Response);

    const result = await adapter.pushTask({ title: 'New Issue', description: 'Body text' });
    expect(result.success).toBe(true);
    expect(result.externalId).toBe('42');
    expect(result.externalUrl).toContain('github.com');
  });

  it('should update an existing issue via pushTask', async () => {
    process.env.GITHUB_TOKEN = 'test_token';
    process.env.GITHUB_REPO = 'owner/repo';

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ number: 42, html_url: 'https://github.com/owner/repo/issues/42' }),
    } as Response);

    const result = await adapter.pushTask({ title: 'Updated', externalId: '42' });
    expect(result.success).toBe(true);

    // Should use PATCH method
    const fetchCall = (globalThis.fetch as any).mock.calls.find(
      (c: any) => c[1]?.method === 'PATCH'
    );
    expect(fetchCall).toBeDefined();
  });

  it('should map status to closed state', async () => {
    process.env.GITHUB_TOKEN = 'test_token';
    process.env.GITHUB_REPO = 'owner/repo';

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ number: 42, html_url: 'https://github.com/owner/repo/issues/42' }),
    } as Response);

    await adapter.pushTask({ title: 'Done task', status: 'done' });

    const body = JSON.parse(fetchSpy.mock.calls[0]![1]!.body as string);
    expect(body.state).toBe('closed');
  });

  // --- handleWebhook ---

  it('should handle issues webhook event', async () => {
    await adapter.handleWebhook(
      { action: 'opened', issue: { number: 1, title: 'Test' } },
      { 'x-github-event': 'issues' },
    );
    // Should not throw
  });

  it('should handle push webhook event', async () => {
    await adapter.handleWebhook(
      { ref: 'refs/heads/main', sender: { login: 'user' } },
      { 'x-github-event': 'push' },
    );
  });

  it('should handle pull_request webhook event', async () => {
    await adapter.handleWebhook(
      { action: 'opened', pull_request: { number: 1 } },
      { 'x-github-event': 'pull_request' },
    );
  });

  it('should handle unknown webhook event', async () => {
    await adapter.handleWebhook({}, { 'x-github-event': 'unknown' });
  });

  // --- testConnection ---

  it('should test connection successfully', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ full_name: 'owner/repo' }),
    } as Response);

    const result = await adapter.testConnection({ token: 'test', repo: 'owner/repo' });
    expect(result.success).toBe(true);
  });

  it('should fail connection test without token', async () => {
    const result = await adapter.testConnection({});
    expect(result.success).toBe(false);
    expect(result.error).toContain('No GitHub token');
  });

  it('should fail connection test without repo', async () => {
    const result = await adapter.testConnection({ token: 'test' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('No GitHub repo');
  });

  it('should fail connection test on API error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({}),
    } as Response);

    const result = await adapter.testConnection({ token: 'test', repo: 'owner/repo' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('404');
  });
});
