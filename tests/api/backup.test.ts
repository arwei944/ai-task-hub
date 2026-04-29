// ============================================================
// Backup API Route Integration Tests - /api/backup
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the db module
const mockFindMany = vi.fn();
const mockCreateMany = vi.fn();
const mockDisconnect = vi.fn();

const mockPrismaInstance = {
  user: { findMany: mockFindMany, createMany: mockCreateMany },
  task: { findMany: mockFindMany, createMany: mockCreateMany },
  taskDependency: { findMany: mockFindMany, createMany: mockCreateMany },
  taskHistory: { findMany: mockFindMany, createMany: mockCreateMany },
  taskTag: { findMany: mockFindMany, createMany: mockCreateMany },
  tag: { findMany: mockFindMany, createMany: mockCreateMany },
  aiAuditLog: { findMany: mockFindMany, createMany: mockCreateMany },
  agent: { findMany: mockFindMany, createMany: mockCreateMany },
  agentOperationLog: { findMany: mockFindMany, createMany: mockCreateMany },
  notification: { findMany: mockFindMany, createMany: mockCreateMany },
  notificationChannel: { findMany: mockFindMany, createMany: mockCreateMany },
  deployment: { findMany: mockFindMany, createMany: mockCreateMany },
  plugin: { findMany: mockFindMany, createMany: mockCreateMany },
  $disconnect: mockDisconnect,
};

vi.mock('@/lib/db', () => ({
  getPrisma: () => mockPrismaInstance,
}));

// Mock fs modules - use inline factory to avoid hoisting issues
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
}));

vi.mock('path', () => ({
  join: (...args: string[]) => args.join('/'),
}));

import { GET, POST } from '@/app/api/backup/route';
import * as fs from 'fs';

function createMockRequest(url: string, body?: unknown): Request {
  const init: RequestInit = { method: body ? 'POST' : 'GET' };
  if (body) {
    init.body = JSON.stringify(body);
    init.headers = { 'Content-Type': 'application/json' };
  }
  return new Request(url, init) as Request;
}

describe('GET /api/backup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return 200 with backup data structure', async () => {
    const request = createMockRequest('http://localhost:3000/api/backup');
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.tables).toBeDefined();
    expect(Array.isArray(data.tables)).toBe(true);
    expect(data.recordCounts).toBeDefined();
    expect(data.timestamp).toBeDefined();
    expect(data.file).toBeDefined();
  });

  it('should export all expected table names', async () => {
    mockFindMany.mockResolvedValue([]);

    const request = createMockRequest('http://localhost:3000/api/backup');
    const response = await GET();
    const data = await response.json();

    const expectedTables = [
      'User', 'Task', 'TaskDependency', 'TaskHistory', 'TaskTag',
      'Tag', 'AIAuditLog', 'Agent', 'AgentOperationLog',
      'Notification', 'NotificationChannel', 'Deployment', 'Plugin',
    ];
    expect(data.tables).toEqual(expectedTables);
  });

  it('should report correct record counts for empty tables', async () => {
    mockFindMany.mockResolvedValue([]);

    const request = createMockRequest('http://localhost:3000/api/backup');
    const response = await GET();
    const data = await response.json();

    for (const count of Object.values(data.recordCounts)) {
      expect(count).toBe(0);
    }
  });

  it('should report correct record counts when tables have data', async () => {
    mockFindMany
      .mockResolvedValueOnce([{ id: '1', username: 'admin' }])
      .mockResolvedValueOnce([{ id: '1', title: 'Task 1' }])
      .mockResolvedValue([]);

    const request = createMockRequest('http://localhost:3000/api/backup');
    const response = await GET();
    const data = await response.json();

    expect(data.recordCounts.User).toBe(1);
    expect(data.recordCounts.Task).toBe(1);
    expect(data.recordCounts.Tag).toBe(0);
  });

  it('should strip _count from exported records', async () => {
    mockFindMany.mockResolvedValue([
      { id: '1', username: 'admin', _count: { tasks: 5 } },
    ]);

    const request = createMockRequest('http://localhost:3000/api/backup');
    const response = await GET();
    const data = await response.json();

    expect(fs.writeFileSync).toHaveBeenCalled();
    const writtenData = JSON.parse((fs.writeFileSync as any).mock.calls[0][1]);
    expect(writtenData.User[0]._count).toBeUndefined();
    expect(writtenData.User[0].id).toBe('1');
    expect(writtenData.User[0].username).toBe('admin');
  });

  it('should write backup file to disk', async () => {
    mockFindMany.mockResolvedValue([]);

    const request = createMockRequest('http://localhost:3000/api/backup');
    await GET();

    expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
    const filePath = (fs.writeFileSync as any).mock.calls[0][0];
    expect(filePath).toContain('backup-');
    expect(filePath).toContain('.json');
  });

  it('should handle table query errors gracefully (return empty array)', async () => {
    mockFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('Table not found'))
      .mockResolvedValue([]);

    const request = createMockRequest('http://localhost:3000/api/backup');
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('should disconnect prisma after export', async () => {
    mockFindMany.mockResolvedValue([]);

    const request = createMockRequest('http://localhost:3000/api/backup');
    await GET();

    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it('should return 500 when unexpected error occurs (e.g. writeFileSync fails)', async () => {
    mockFindMany.mockResolvedValue([]);
    (fs.writeFileSync as any).mockImplementation(() => {
      throw new Error('Permission denied');
    });

    const request = createMockRequest('http://localhost:3000/api/backup');
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Permission denied');
  });
});

describe('POST /api/backup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateMany.mockResolvedValue({ count: 0 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return 200 on successful import', async () => {
    const body = {
      data: {
        User: [{ username: 'test', email: 'test@test.com', passwordHash: 'hash123' }],
      },
    };
    const request = createMockRequest('http://localhost:3000/api/backup', body);
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.imported).toBeDefined();
    expect(data.totalRecords).toBeDefined();
  });

  it('should return 400 when data is missing', async () => {
    const request = createMockRequest('http://localhost:3000/api/backup', {});
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Invalid data format');
  });

  it('should return 400 when data is not an object', async () => {
    const request = createMockRequest('http://localhost:3000/api/backup', { data: 'not-an-object' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('should strip id, createdAt, updatedAt, _count from imported records', async () => {
    const body = {
      data: {
        Tag: [{ id: 'old-id', name: 'bug', color: '#ff0000', createdAt: '2024-01-01', updatedAt: '2024-01-01', _count: {} }],
      },
    };
    const request = createMockRequest('http://localhost:3000/api/backup', body);
    await POST(request);

    expect(mockCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [{ name: 'bug', color: '#ff0000' }],
        skipDuplicates: true,
      }),
    );
  });

  it('should skip records that become empty after stripping', async () => {
    const body = {
      data: {
        User: [{ id: 'only-id-field', createdAt: '2024-01-01', updatedAt: '2024-01-01' }],
      },
    };
    const request = createMockRequest('http://localhost:3000/api/backup', body);
    await POST(request);

    expect(mockCreateMany).not.toHaveBeenCalled();
  });

  it('should skip non-array table entries', async () => {
    const body = {
      data: {
        User: 'not-an-array',
        Tag: [{ name: 'valid' }],
      },
    };
    const request = createMockRequest('http://localhost:3000/api/backup', body);
    await POST(request);

    expect(mockCreateMany).toHaveBeenCalledTimes(1);
  });

  it('should handle import errors per table gracefully', async () => {
    mockCreateMany
      .mockRejectedValueOnce(new Error('Unique constraint violation'))
      .mockResolvedValueOnce({ count: 1 });

    const body = {
      data: {
        User: [{ username: 'dup', email: 'dup@test.com', passwordHash: 'hash' }],
        Tag: [{ name: 'bug' }],
      },
    };
    const request = createMockRequest('http://localhost:3000/api/backup', body);
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.imported.User_error).toBeDefined();
    expect(data.imported.Tag).toBe(1);
  });

  it('should report totalRecords correctly', async () => {
    mockCreateMany.mockResolvedValue({ count: 2 });

    const body = {
      data: {
        Tag: [{ name: 'bug' }, { name: 'feature' }],
      },
    };
    const request = createMockRequest('http://localhost:3000/api/backup', body);
    const response = await POST(request);
    const data = await response.json();

    expect(data.totalRecords).toBe(2);
  });

  it('should disconnect prisma after import', async () => {
    const body = { data: { Tag: [{ name: 'test' }] } };
    const request = createMockRequest('http://localhost:3000/api/backup', body);
    await POST(request);

    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it('should return 500 when body parsing fails', async () => {
    const request = new Request('http://localhost:3000/api/backup', {
      method: 'POST',
      body: 'invalid json',
      headers: { 'Content-Type': 'application/json' },
    }) as Request;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBeDefined();
  });
});
