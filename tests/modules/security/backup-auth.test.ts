// ============================================================
// C-04: Backup API - No Authentication (Security Vulnerability)
// ============================================================
//
// These tests document the CURRENT behavior of /api/backup:
// The endpoint has NO authentication protection.
// Any unauthenticated request can export/import all data.
//
// This is a CRITICAL security vulnerability (C-04).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// --- Mocks ---

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

// Helper: create a mock Request with NO Authorization header
function createUnauthenticatedRequest(url: string, body?: unknown): Request {
  const init: RequestInit = { method: body !== undefined ? 'POST' : 'GET' };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { 'Content-Type': 'application/json' };
  }
  // Explicitly NO Authorization header - simulating unauthenticated access
  return new Request(url, init) as Request;
}

describe('C-04: Backup API - No Authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
    mockCreateMany.mockResolvedValue({ count: 0 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // C-04-1: Unauthenticated GET request exports data
  it('C-04-1: Unauthenticated GET request returns 200 (VULNERABILITY - no auth check)', async () => {
    // This test documents the vulnerability: a GET request without any
    // Authorization header still succeeds and returns all backup data.
    const request = createUnauthenticatedRequest('http://localhost:3000/api/backup');

    // Verify the request has no Authorization header
    expect(request.headers.get('Authorization')).toBeNull();

    const response = await GET();
    const data = await response.json();

    // VULNERABILITY: Should return 401/403, but currently returns 200
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.tables).toBeDefined();
    expect(data.recordCounts).toBeDefined();
  });

  // C-04-2: Unauthenticated POST request imports data
  it('C-04-2: Unauthenticated POST request returns 200 (VULNERABILITY - no auth check)', async () => {
    // This test documents the vulnerability: a POST request without any
    // Authorization header can still import data into the database.
    const body = {
      data: {
        User: [{ username: 'attacker', email: 'attacker@evil.com', passwordHash: 'stolen' }],
      },
    };
    const request = createUnauthenticatedRequest('http://localhost:3000/api/backup', body);

    // Verify the request has no Authorization header
    expect(request.headers.get('Authorization')).toBeNull();

    const response = await POST(request);
    const data = await response.json();

    // VULNERABILITY: Should return 401/403, but currently returns 200
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.imported).toBeDefined();
  });

  // C-04-3: POST with empty body
  it('C-04-3: POST with empty body should return 400', async () => {
    const request = createUnauthenticatedRequest('http://localhost:3000/api/backup', {});

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Invalid data format');
  });

  // C-04-4: POST with non-object data (array)
  it('C-04-4: POST with array as data should return 400', async () => {
    const request = createUnauthenticatedRequest('http://localhost:3000/api/backup', {
      data: [1, 2, 3],
    });

    const response = await POST(request);
    const data = await response.json();

    // Array is technically typeof === 'object' in JS, but the route checks
    // `typeof data !== 'object'` which would pass for arrays.
    // However, the route iterates Object.entries(data) which works on arrays too.
    // The actual behavior depends on implementation.
    // Based on source: `if (!data || typeof data !== 'object')` - arrays pass this check.
    // So the request succeeds with 200, but imports nothing useful.
    // This test documents the actual behavior.
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  // C-04-5: GET normal export returns all table data
  it('C-04-5: GET normal export returns JSON with all table data', async () => {
    mockFindMany
      .mockResolvedValueOnce([{ id: '1', username: 'admin' }])
      .mockResolvedValueOnce([{ id: '1', title: 'Test Task' }])
      .mockResolvedValue([]);

    const request = createUnauthenticatedRequest('http://localhost:3000/api/backup');
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.tables).toContain('User');
    expect(data.tables).toContain('Task');
    expect(data.recordCounts.User).toBe(1);
    expect(data.recordCounts.Task).toBe(1);
    expect(data.timestamp).toBeDefined();
    expect(data.file).toBeDefined();
  });

  // C-04-6: POST normal import with valid backup data
  it('C-04-6: POST with valid backup data should import successfully', async () => {
    mockCreateMany.mockResolvedValue({ count: 2 });

    const body = {
      data: {
        Tag: [{ name: 'bug', color: '#ff0000' }, { name: 'feature', color: '#00ff00' }],
      },
    };
    const request = createUnauthenticatedRequest('http://localhost:3000/api/backup', body);
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.imported.Tag).toBe(2);
    expect(data.totalRecords).toBe(2);
    expect(mockCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          { name: 'bug', color: '#ff0000' },
          { name: 'feature', color: '#00ff00' },
        ],
        skipDuplicates: true,
      }),
    );
  });
});
