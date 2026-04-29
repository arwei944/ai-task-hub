// ============================================================
// C-04: Backup API - Authentication Required
// ============================================================
//
// These tests verify that /api/backup requires Bearer token authentication.
// Unauthenticated requests should return 401.
// Authenticated requests should proceed normally.

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

// Helper: create a mock Request WITH Bearer token
function createAuthenticatedRequest(url: string, body?: unknown): Request {
  const init: RequestInit = { method: body !== undefined ? 'POST' : 'GET' };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer valid-token' };
  } else {
    init.headers = { 'Authorization': 'Bearer valid-token' };
  }
  return new Request(url, init) as Request;
}

describe('C-04: Backup API - Authentication Required', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
    mockCreateMany.mockResolvedValue({ count: 0 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // C-04-1: Unauthenticated GET request returns 401
  it('C-04-1: Unauthenticated GET request returns 401', async () => {
    const request = createUnauthenticatedRequest('http://localhost:3000/api/backup');

    // Verify the request has no Authorization header
    expect(request.headers.get('Authorization')).toBeNull();

    const response = await GET(request);
    const data = await response.json();

    // Should return 401 (authentication required)
    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Authentication required');
  });

  // C-04-2: Unauthenticated POST request returns 401
  it('C-04-2: Unauthenticated POST request returns 401', async () => {
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

    // Should return 401 (authentication required)
    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Authentication required');
  });

  // C-04-3: Authenticated GET request returns 200
  it('C-04-3: Authenticated GET request returns 200 with backup data', async () => {
    const request = createAuthenticatedRequest('http://localhost:3000/api/backup');

    // Verify the request has Authorization header
    expect(request.headers.get('Authorization')).toBe('Bearer valid-token');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.tables).toBeDefined();
    expect(data.recordCounts).toBeDefined();
  });

  // C-04-4: Authenticated POST request returns 200
  it('C-04-4: Authenticated POST request with valid data returns 200', async () => {
    mockCreateMany.mockResolvedValue({ count: 2 });

    const body = {
      data: {
        Tag: [{ name: 'bug', color: '#ff0000' }, { name: 'feature', color: '#00ff00' }],
      },
    };
    const request = createAuthenticatedRequest('http://localhost:3000/api/backup', body);
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.imported).toBeDefined();
  });

  // C-04-5: POST with empty body returns 400 (even with auth)
  it('C-04-5: Authenticated POST with empty body should return 400', async () => {
    const request = createAuthenticatedRequest('http://localhost:3000/api/backup', {});

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Invalid data format');
  });

  // C-04-6: GET normal export returns all table data (authenticated)
  it('C-04-6: Authenticated GET normal export returns JSON with all table data', async () => {
    mockFindMany
      .mockResolvedValueOnce([{ id: '1', username: 'admin' }])
      .mockResolvedValueOnce([{ id: '1', title: 'Test Task' }])
      .mockResolvedValue([]);

    const request = createAuthenticatedRequest('http://localhost:3000/api/backup');
    const response = await GET(request);
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

  // C-04-7: Authenticated POST with valid backup data imports successfully
  it('C-04-7: Authenticated POST with valid backup data should import successfully', async () => {
    mockCreateMany.mockResolvedValue({ count: 2 });

    const body = {
      data: {
        Tag: [{ name: 'bug', color: '#ff0000' }, { name: 'feature', color: '#00ff00' }],
      },
    };
    const request = createAuthenticatedRequest('http://localhost:3000/api/backup', body);
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
