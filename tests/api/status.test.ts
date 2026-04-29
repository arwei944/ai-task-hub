// ============================================================
// System Status API Route Integration Tests - /api/status
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock PrismaBetterSqlite3 as a class
vi.mock('@prisma/adapter-better-sqlite3', () => ({
  PrismaBetterSqlite3: vi.fn(function (this: any) {}),
}));

// Mock PrismaClient as a class
const mockQueryRaw = vi.fn();
const mockTaskCount = vi.fn();
const mockUserCount = vi.fn();
const mockPrismaDisconnect = vi.fn();

vi.mock('@/generated/prisma/client', () => ({
  PrismaClient: vi.fn(function (this: any) {
    this.$queryRaw = mockQueryRaw;
    this.task = { count: mockTaskCount };
    this.user = { count: mockUserCount };
    this.$disconnect = mockPrismaDisconnect;
  }),
}));

import { GET } from '@/app/api/status/route';

describe('GET /api/status', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    mockQueryRaw.mockResolvedValue([1]);
    mockTaskCount.mockResolvedValue(10);
    mockUserCount.mockResolvedValue(2);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('should return 200 when all health checks pass', async () => {
    process.env.OPENAI_API_KEY = 'sk-test-key';
    process.env.AI_MODEL = 'gpt-4';

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('healthy');
  });

  it('should return 503 when database health check fails', async () => {
    mockQueryRaw.mockRejectedValue(new Error('Connection refused'));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe('degraded');
    expect(data.health.database.status).toBe('error');
    expect(data.health.database.details).toContain('Connection refused');
  });

  it('should include database health details', async () => {
    mockTaskCount.mockResolvedValue(42);
    mockUserCount.mockResolvedValue(5);

    const response = await GET();
    const data = await response.json();

    expect(data.health.database.status).toBe('ok');
    expect(data.health.database.details).toBe('42 tasks, 5 users');
    expect(data.health.database.latency).toBeDefined();
    expect(typeof data.health.database.latency).toBe('number');
  });

  it('should report AI configuration status', async () => {
    process.env.OPENAI_API_KEY = 'sk-test-key';
    process.env.AI_MODEL = 'gpt-4o';

    const response = await GET();
    const data = await response.json();

    expect(data.health.ai.status).toBe('configured');
    expect(data.health.ai.details).toBe('gpt-4o');
  });

  it('should report AI as not_configured when no API key', async () => {
    delete process.env.OPENAI_API_KEY;
    process.env.AI_MODEL = 'gpt-4';

    const response = await GET();
    const data = await response.json();

    expect(data.status).toBe('degraded');
    expect(data.health.ai.status).toBe('not_configured');
  });

  it('should report AI model as not_set when not configured', async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.AI_MODEL;

    const response = await GET();
    const data = await response.json();

    expect(data.health.ai.details).toBe('not_set');
  });

  it('should report MCP as available', async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.health.mcp.status).toBe('available');
  });

  it('should include memory usage information', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';

    const response = await GET();
    const data = await response.json();

    expect(data.memory).toBeDefined();
    expect(data.memory.rss).toMatch(/\d+MB/);
    expect(data.memory.heapUsed).toMatch(/\d+MB/);
    expect(data.memory.heapTotal).toMatch(/\d+MB/);
  });

  it('should include version information', async () => {
    process.env.npm_package_version = '1.8.0';

    const response = await GET();
    const data = await response.json();

    expect(data.version).toBe('1.8.0');
  });

  it('should default version to 1.0.1 when env var not set', async () => {
    delete process.env.npm_package_version;
    process.env.OPENAI_API_KEY = 'sk-test';

    const response = await GET();
    const data = await response.json();

    expect(data.version).toBe('1.0.1');
  });

  it('should include uptime in seconds', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';

    const response = await GET();
    const data = await response.json();

    expect(data.uptime).toBeDefined();
    expect(typeof data.uptime).toBe('number');
    expect(data.uptime).toBeGreaterThanOrEqual(0);
  });

  it('should include timestamp in ISO format', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';

    const response = await GET();
    const data = await response.json();

    expect(data.timestamp).toBeDefined();
    expect(() => new Date(data.timestamp)).not.toThrow();
  });

  it('should include environment info', async () => {
    process.env.NODE_ENV = 'test';
    process.env.OPENAI_API_KEY = 'sk-test';

    const response = await GET();
    const data = await response.json();

    expect(data.environment).toBe('test');
  });

  it('should default environment to development', async () => {
    delete process.env.NODE_ENV;
    process.env.OPENAI_API_KEY = 'sk-test';

    const response = await GET();
    const data = await response.json();

    expect(data.environment).toBe('development');
  });

  it('should disconnect prisma after health check', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';

    await GET();

    expect(mockPrismaDisconnect).toHaveBeenCalledTimes(1);
  });

  it('should return valid JSON structure', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';

    const response = await GET();
    const data = await response.json();

    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('version');
    expect(data).toHaveProperty('uptime');
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('environment');
    expect(data).toHaveProperty('memory');
    expect(data).toHaveProperty('health');
    expect(data.health).toHaveProperty('database');
    expect(data.health).toHaveProperty('ai');
    expect(data.health).toHaveProperty('mcp');
  });
});
