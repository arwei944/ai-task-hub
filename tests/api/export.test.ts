// ============================================================
// Export Tasks API Route Integration Tests - /api/export/tasks
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock PrismaBetterSqlite3 as a class
vi.mock('@prisma/adapter-better-sqlite3', () => ({
  PrismaBetterSqlite3: vi.fn(function (this: any) {}),
}));

// Mock PrismaClient as a class
const mockTaskFindMany = vi.fn();
const mockPrismaDisconnect = vi.fn();

vi.mock('@/generated/prisma/client', () => ({
  PrismaClient: vi.fn(function (this: any) {
    this.task = { findMany: mockTaskFindMany };
    this.$disconnect = mockPrismaDisconnect;
  }),
}));

// Mock Logger as a class
vi.mock('@/lib/core/logger', () => ({
  Logger: vi.fn(function (this: any) {
    this.info = vi.fn();
    this.warn = vi.fn();
    this.error = vi.fn();
    this.debug = vi.fn();
  }),
}));

import { GET } from '@/app/api/export/tasks/route';

function createMockRequest(url: string): Request {
  return new Request(url, { method: 'GET' }) as Request;
}

describe('GET /api/export/tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTaskFindMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==================== JSON Format Tests ====================

  describe('JSON format', () => {
    it('should return 200 with JSON content type by default', async () => {
      const request = createMockRequest('http://localhost:3000/api/export/tasks');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('should return 200 with JSON content type when format=json', async () => {
      const request = createMockRequest('http://localhost:3000/api/export/tasks?format=json');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('should return JSON array of tasks', async () => {
      mockTaskFindMany.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Test Task',
          description: 'A test task',
          status: 'todo',
          priority: 'high',
          progress: 0,
          type: 'general',
          source: 'manual',
          creator: 'admin',
          assignee: null,
          dueDate: null,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          tags: [],
        },
      ]);

      const request = createMockRequest('http://localhost:3000/api/export/tasks?format=json');
      const response = await GET(request);
      const data = JSON.parse(await response.text());

      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(1);
      expect(data[0].id).toBe('task-1');
      expect(data[0].title).toBe('Test Task');
    });

    it('should set Content-Disposition header for JSON download', async () => {
      const request = createMockRequest('http://localhost:3000/api/export/tasks?format=json');
      const response = await GET(request);

      const disposition = response.headers.get('Content-Disposition');
      expect(disposition).toContain('attachment');
      expect(disposition).toContain('tasks_');
      expect(disposition).toContain('.json');
    });

    it('should flatten task tags into comma-separated string', async () => {
      mockTaskFindMany.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Tagged Task',
          description: null,
          status: 'todo',
          priority: 'medium',
          progress: 0,
          type: 'general',
          source: 'manual',
          creator: null,
          assignee: null,
          dueDate: null,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          tags: [
            { tag: { name: 'bug' } },
            { tag: { name: 'urgent' } },
          ],
        },
      ]);

      const request = createMockRequest('http://localhost:3000/api/export/tasks?format=json');
      const response = await GET(request);
      const data = JSON.parse(await response.text());

      expect(data[0].tags).toBe('bug, urgent');
    });

    it('should return empty array when no tasks', async () => {
      mockTaskFindMany.mockResolvedValue([]);

      const request = createMockRequest('http://localhost:3000/api/export/tasks?format=json');
      const response = await GET(request);
      const data = JSON.parse(await response.text());

      expect(data).toEqual([]);
    });

    it('should handle null fields with defaults', async () => {
      mockTaskFindMany.mockResolvedValue([
        {
          id: 'task-null',
          title: 'Null Fields',
          description: null,
          status: 'todo',
          priority: 'low',
          progress: 0,
          type: 'general',
          source: 'manual',
          creator: null,
          assignee: null,
          dueDate: null,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          tags: null,
        },
      ]);

      const request = createMockRequest('http://localhost:3000/api/export/tasks?format=json');
      const response = await GET(request);
      const data = JSON.parse(await response.text());

      expect(data[0].description).toBe('');
      expect(data[0].creator).toBe('');
      expect(data[0].assignee).toBe('');
      expect(data[0].dueDate).toBe('');
      expect(data[0].tags).toBe('');
    });
  });

  // ==================== CSV Format Tests ====================

  describe('CSV format', () => {
    it('should return CSV content type when format=csv', async () => {
      const request = createMockRequest('http://localhost:3000/api/export/tasks?format=csv');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('text/csv');
      expect(response.headers.get('Content-Type')).toContain('charset=utf-8');
    });

    it('should include BOM for UTF-8 CSV', async () => {
      mockTaskFindMany.mockResolvedValue([]);

      const request = createMockRequest('http://localhost:3000/api/export/tasks?format=csv');
      const response = await GET(request);
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      // BOM is EF BB BF in UTF-8
      expect(bytes[0]).toBe(0xEF);
      expect(bytes[1]).toBe(0xBB);
      expect(bytes[2]).toBe(0xBF);
    });

    it('should include CSV headers in Chinese', async () => {
      mockTaskFindMany.mockResolvedValue([]);

      const request = createMockRequest('http://localhost:3000/api/export/tasks?format=csv');
      const response = await GET(request);
      const text = await response.text();

      expect(text).toContain('ID');
      expect(text).toContain('标题');
      expect(text).toContain('描述');
      expect(text).toContain('状态');
      expect(text).toContain('优先级');
      expect(text).toContain('进度');
      expect(text).toContain('类型');
      expect(text).toContain('来源');
      expect(text).toContain('创建者');
      expect(text).toContain('负责人');
      expect(text).toContain('截止日期');
      expect(text).toContain('标签');
      expect(text).toContain('创建时间');
      expect(text).toContain('更新时间');
    });

    it('should set Content-Disposition header for CSV download', async () => {
      const request = createMockRequest('http://localhost:3000/api/export/tasks?format=csv');
      const response = await GET(request);

      const disposition = response.headers.get('Content-Disposition');
      expect(disposition).toContain('attachment');
      expect(disposition).toContain('.csv');
    });

    it('should escape double quotes in CSV fields', async () => {
      mockTaskFindMany.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Task with "quotes"',
          description: null,
          status: 'todo',
          priority: 'medium',
          progress: 0,
          type: 'general',
          source: 'manual',
          creator: null,
          assignee: null,
          dueDate: null,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          tags: [],
        },
      ]);

      const request = createMockRequest('http://localhost:3000/api/export/tasks?format=csv');
      const response = await GET(request);
      const text = await response.text();

      expect(text).toContain('Task with ""quotes""');
    });
  });

  // ==================== Filter Tests ====================

  describe('query filters', () => {
    it('should pass status filter to query', async () => {
      const request = createMockRequest('http://localhost:3000/api/export/tasks?status=done');
      await GET(request);

      expect(mockTaskFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'done' }),
        }),
      );
    });

    it('should pass priority filter to query', async () => {
      const request = createMockRequest('http://localhost:3000/api/export/tasks?priority=high');
      await GET(request);

      expect(mockTaskFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ priority: 'high' }),
        }),
      );
    });

    it('should pass creator filter to query', async () => {
      const request = createMockRequest('http://localhost:3000/api/export/tasks?creator=agent-1');
      await GET(request);

      expect(mockTaskFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ creator: 'agent-1' }),
        }),
      );
    });

    it('should pass search filter with OR condition', async () => {
      const request = createMockRequest('http://localhost:3000/api/export/tasks?search=bug');
      await GET(request);

      expect(mockTaskFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { title: { contains: 'bug' } },
              { description: { contains: 'bug' } },
            ],
          }),
        }),
      );
    });

    it('should always include deletedAt: null filter', async () => {
      const request = createMockRequest('http://localhost:3000/api/export/tasks');
      await GET(request);

      expect(mockTaskFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deletedAt: null }),
        }),
      );
    });

    it('should order by createdAt desc', async () => {
      const request = createMockRequest('http://localhost:3000/api/export/tasks');
      await GET(request);

      expect(mockTaskFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should include tags relation in query', async () => {
      const request = createMockRequest('http://localhost:3000/api/export/tasks');
      await GET(request);

      expect(mockTaskFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { tags: { include: { tag: true } } },
        }),
      );
    });

    it('should combine multiple filters', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/export/tasks?status=todo&priority=high&creator=agent-1&search=fix',
      );
      await GET(request);

      const callArgs = mockTaskFindMany.mock.calls[0][0];
      expect(callArgs.where.status).toBe('todo');
      expect(callArgs.where.priority).toBe('high');
      expect(callArgs.where.creator).toBe('agent-1');
      expect(callArgs.where.OR).toBeDefined();
    });
  });

  // ==================== Error Tests ====================

  describe('error handling', () => {
    it('should return 500 when database query fails', async () => {
      mockTaskFindMany.mockRejectedValue(new Error('Database error'));

      const request = createMockRequest('http://localhost:3000/api/export/tasks');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });
  });
});
