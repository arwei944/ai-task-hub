import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { KnowledgeService } from '@/lib/modules/knowledge/knowledge.service';
import { Logger } from '@/lib/core/logger';
import { join } from 'node:path';

// Use a test database
const TEST_DB_PATH = join(process.cwd(), 'test-db', 'test-task-core.db');

function createTestServices() {
  const adapter = new PrismaBetterSqlite3({ url: TEST_DB_PATH });
  const prisma = new PrismaClient({ adapter });
  const logger = new Logger('test');
  const eventBus = {
    emit: vi.fn(),
    emitAsync: vi.fn(),
    on: vi.fn(() => vi.fn()),
    once: vi.fn(() => vi.fn()),
    off: vi.fn(),
    removeAllListeners: vi.fn(),
  };
  const service = new KnowledgeService(logger, eventBus as any, () => prisma);
  return { prisma, logger, service, eventBus };
}

describe('KnowledgeService', () => {
  let services: ReturnType<typeof createTestServices>;
  let projectId: string;

  beforeEach(async () => {
    services = createTestServices();

    // Clean up knowledge data
    await services.prisma.knowledgeEntry.deleteMany();

    // Create a test project
    const project = await services.prisma.project.create({
      data: {
        name: `Test Project ${Date.now()}`,
        description: 'Test project for knowledge',
      },
    });
    projectId = project.id;
  });

  afterEach(async () => {
    await services.prisma.knowledgeEntry.deleteMany();
    await services.prisma.$disconnect();
  });

  // ================================================================
  // CRUD Operations
  // ================================================================

  describe('createEntry', () => {
    it('should create a knowledge entry with default values', async () => {
      const entry = await services.service.createEntry({
        type: 'lesson_learned',
        title: 'Test Lesson',
        content: 'This is a test lesson learned',
      });

      expect(entry).toBeDefined();
      expect(entry.title).toBe('Test Lesson');
      expect(entry.content).toBe('This is a test lesson learned');
      expect(entry.type).toBe('lesson_learned');
      expect(entry.tags).toBe('[]');
      expect(entry.aiGenerated).toBe(false);
      expect(entry.usefulness).toBe(0);
      expect(entry.projectId).toBeNull();
    });

    it('should create a knowledge entry with all fields', async () => {
      const entry = await services.service.createEntry({
        projectId,
        type: 'decision',
        title: 'Architecture Decision',
        content: 'We chose PostgreSQL for the database',
        tags: ['database', 'architecture'],
        sourceEvent: 'project.phase_changed',
        aiGenerated: true,
        createdBy: 'agent-1',
      });

      expect(entry.projectId).toBe(projectId);
      expect(entry.type).toBe('decision');
      expect(entry.tags).toBe(JSON.stringify(['database', 'architecture']));
      expect(entry.sourceEvent).toBe('project.phase_changed');
      expect(entry.aiGenerated).toBe(true);
      expect(entry.createdBy).toBe('agent-1');
    });

    it('should emit knowledge.created event', async () => {
      await services.service.createEntry({
        type: 'pattern',
        title: 'Test Pattern',
        content: 'A reusable pattern',
      });

      expect(services.eventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'knowledge.created',
          source: 'knowledge',
        }),
      );
    });
  });

  describe('getEntry', () => {
    it('should get an entry by id', async () => {
      const created = await services.service.createEntry({
        type: 'solution',
        title: 'Test Solution',
        content: 'A solution to a problem',
        projectId,
      });

      const fetched = await services.service.getEntry(created.id);
      expect(fetched).toBeDefined();
      expect(fetched!.title).toBe('Test Solution');
      expect(fetched!.project).toBeDefined();
      expect(fetched!.project!.id).toBe(projectId);
    });

    it('should throw for non-existent entry', async () => {
      await expect(
        services.service.getEntry('non-existent-id')
      ).rejects.toThrow('not found');
    });
  });

  describe('updateEntry', () => {
    it('should update entry fields', async () => {
      const created = await services.service.createEntry({
        type: 'lesson_learned',
        title: 'Original Title',
        content: 'Original content',
      });

      const updated = await services.service.updateEntry(created.id, {
        title: 'Updated Title',
        content: 'Updated content',
        tags: ['updated'],
        type: 'decision',
      });

      expect(updated.title).toBe('Updated Title');
      expect(updated.content).toBe('Updated content');
      expect(updated.tags).toBe(JSON.stringify(['updated']));
      expect(updated.type).toBe('decision');
    });

    it('should throw for non-existent entry', async () => {
      await expect(
        services.service.updateEntry('non-existent-id', { title: 'test' })
      ).rejects.toThrow('not found');
    });
  });

  describe('deleteEntry', () => {
    it('should delete an entry', async () => {
      const created = await services.service.createEntry({
        type: 'lesson_learned',
        title: 'To Delete',
        content: 'Will be deleted',
      });

      const result = await services.service.deleteEntry(created.id);
      expect(result.success).toBe(true);

      await expect(
        services.service.getEntry(created.id)
      ).rejects.toThrow('not found');
    });

    it('should emit knowledge.deleted event', async () => {
      const created = await services.service.createEntry({
        type: 'lesson_learned',
        title: 'To Delete',
        content: 'Will be deleted',
        projectId,
      });

      await services.service.deleteEntry(created.id);

      expect(services.eventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'knowledge.deleted',
        }),
      );
    });

    it('should throw for non-existent entry', async () => {
      await expect(
        services.service.deleteEntry('non-existent-id')
      ).rejects.toThrow('not found');
    });
  });

  describe('listEntries', () => {
    it('should list entries for a project', async () => {
      await services.service.createEntry({ type: 'lesson_learned', title: 'Entry 1', content: 'C1', projectId });
      await services.service.createEntry({ type: 'decision', title: 'Entry 2', content: 'C2', projectId });
      await services.service.createEntry({ type: 'pattern', title: 'Entry 3', content: 'C3', projectId });

      const result = await services.service.listEntries({ projectId });
      expect(result.entries).toHaveLength(3);
      expect(result.total).toBe(3);
    });

    it('should filter by type', async () => {
      await services.service.createEntry({ type: 'lesson_learned', title: 'Lesson', content: 'C1', projectId });
      await services.service.createEntry({ type: 'decision', title: 'Decision', content: 'C2', projectId });
      await services.service.createEntry({ type: 'lesson_learned', title: 'Lesson 2', content: 'C3', projectId });

      const result = await services.service.listEntries({ projectId, type: 'lesson_learned' });
      expect(result.entries).toHaveLength(2);
    });

    it('should filter by aiGenerated', async () => {
      await services.service.createEntry({ type: 'lesson_learned', title: 'Manual', content: 'C1', aiGenerated: false });
      await services.service.createEntry({ type: 'lesson_learned', title: 'AI', content: 'C2', aiGenerated: true });

      const result = await services.service.listEntries({ aiGenerated: true });
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].title).toBe('AI');
    });

    it('should filter by search', async () => {
      await services.service.createEntry({ type: 'lesson_learned', title: 'Database Optimization', content: 'C1' });
      await services.service.createEntry({ type: 'lesson_learned', title: 'Cache Strategy', content: 'C2' });

      const result = await services.service.listEntries({ search: 'Database' });
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].title).toBe('Database Optimization');
    });

    it('should filter by tags', async () => {
      await services.service.createEntry({ type: 'lesson_learned', title: 'Entry 1', content: 'C1', tags: ['database', 'sql'] });
      await services.service.createEntry({ type: 'lesson_learned', title: 'Entry 2', content: 'C2', tags: ['frontend', 'react'] });
      await services.service.createEntry({ type: 'lesson_learned', title: 'Entry 3', content: 'C3', tags: ['database', 'nosql'] });

      const result = await services.service.listEntries({ tags: ['database'] });
      expect(result.entries).toHaveLength(2);
    });

    it('should respect limit', async () => {
      await services.service.createEntry({ type: 'lesson_learned', title: 'Entry 1', content: 'C1' });
      await services.service.createEntry({ type: 'lesson_learned', title: 'Entry 2', content: 'C2' });
      await services.service.createEntry({ type: 'lesson_learned', title: 'Entry 3', content: 'C3' });

      const result = await services.service.listEntries({ limit: 2 });
      expect(result.entries).toHaveLength(2);
      expect(result.total).toBe(3);
    });
  });

  // ================================================================
  // Search
  // ================================================================

  describe('searchEntries', () => {
    it('should search by title', async () => {
      await services.service.createEntry({ type: 'lesson_learned', title: 'Database Performance', content: 'Optimize queries' });
      await services.service.createEntry({ type: 'lesson_learned', title: 'Cache Strategy', content: 'Use Redis' });

      const results = await services.service.searchEntries('Database');
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Database Performance');
    });

    it('should search by content', async () => {
      await services.service.createEntry({ type: 'lesson_learned', title: 'Title A', content: 'Use PostgreSQL for relational data' });
      await services.service.createEntry({ type: 'lesson_learned', title: 'Title B', content: 'Use MongoDB for document storage' });

      const results = await services.service.searchEntries('PostgreSQL');
      expect(results).toHaveLength(1);
    });

    it('should return empty array for no matches', async () => {
      await services.service.createEntry({ type: 'lesson_learned', title: 'Title A', content: 'Content A' });

      const results = await services.service.searchEntries('nonexistent');
      expect(results).toHaveLength(0);
    });
  });

  // ================================================================
  // Usefulness
  // ================================================================

  describe('incrementUsefulness', () => {
    it('should increment usefulness counter', async () => {
      const created = await services.service.createEntry({
        type: 'lesson_learned',
        title: 'Useful Entry',
        content: 'Very useful content',
      });

      const incremented = await services.service.incrementUsefulness(created.id);
      expect(incremented.usefulness).toBe(1);

      const incremented2 = await services.service.incrementUsefulness(created.id);
      expect(incremented2.usefulness).toBe(2);
    });

    it('should throw for non-existent entry', async () => {
      await expect(
        services.service.incrementUsefulness('non-existent-id')
      ).rejects.toThrow('not found');
    });
  });

  // ================================================================
  // Project Knowledge
  // ================================================================

  describe('getProjectKnowledge', () => {
    it('should get all knowledge for a project', async () => {
      await services.service.createEntry({ type: 'lesson_learned', title: 'Entry 1', content: 'C1', projectId });
      await services.service.createEntry({ type: 'decision', title: 'Entry 2', content: 'C2', projectId });
      // Entry without project
      await services.service.createEntry({ type: 'pattern', title: 'Entry 3', content: 'C3' });

      const entries = await services.service.getProjectKnowledge(projectId);
      expect(entries).toHaveLength(2);
    });

    it('should return empty array for project with no entries', async () => {
      const entries = await services.service.getProjectKnowledge(projectId);
      expect(entries).toHaveLength(0);
    });
  });

  // ================================================================
  // Statistics
  // ================================================================

  describe('getStats', () => {
    it('should return stats for all entries', async () => {
      await services.service.createEntry({ type: 'lesson_learned', title: 'L1', content: 'C1', tags: ['db'] });
      await services.service.createEntry({ type: 'lesson_learned', title: 'L2', content: 'C2', tags: ['db', 'perf'] });
      await services.service.createEntry({ type: 'decision', title: 'D1', content: 'C3', tags: ['arch'] });

      const stats = await services.service.getStats();

      expect(stats.total).toBe(3);
      expect(stats.byType.lesson_learned).toBe(2);
      expect(stats.byType.decision).toBe(1);
      expect(stats.byAiGenerated.false).toBe(3);
      expect(stats.uniqueTags).toBe(3); // db, perf, arch
    });

    it('should return stats for a specific project', async () => {
      await services.service.createEntry({ type: 'lesson_learned', title: 'L1', content: 'C1', projectId });
      await services.service.createEntry({ type: 'decision', title: 'D1', content: 'C2', projectId });
      await services.service.createEntry({ type: 'pattern', title: 'P1', content: 'C3' }); // no project

      const stats = await services.service.getStats(projectId);

      expect(stats.total).toBe(2);
      expect(stats.byType.lesson_learned).toBe(1);
      expect(stats.byType.decision).toBe(1);
    });

    it('should calculate average usefulness', async () => {
      const e1 = await services.service.createEntry({ type: 'lesson_learned', title: 'L1', content: 'C1' });
      await services.service.incrementUsefulness(e1.id);
      await services.service.incrementUsefulness(e1.id);
      const e2 = await services.service.createEntry({ type: 'lesson_learned', title: 'L2', content: 'C2' });
      await services.service.incrementUsefulness(e2.id);

      const stats = await services.service.getStats();
      expect(stats.totalUsefulness).toBe(3);
      expect(stats.avgUsefulness).toBe(1.5);
    });

    it('should return zero stats when no entries', async () => {
      const stats = await services.service.getStats();

      expect(stats.total).toBe(0);
      expect(stats.byType).toEqual({});
      expect(stats.avgUsefulness).toBe(0);
      expect(stats.uniqueTags).toBe(0);
    });
  });
});

// ================================================================
// MCP Tool Definitions Tests
// ============================================================

describe('Knowledge MCP Tool Definitions', () => {
  it('should have 9 tools defined', async () => {
    const { knowledgeMcpTools } = await import('@/lib/modules/mcp-server/tools/knowledge-tools');
    expect(knowledgeMcpTools).toHaveLength(9);
  });

  it('should have correct tool names', async () => {
    const { knowledgeMcpTools } = await import('@/lib/modules/mcp-server/tools/knowledge-tools');
    const names = knowledgeMcpTools.map(t => t.name);

    expect(names).toContain('create_knowledge_entry');
    expect(names).toContain('get_knowledge_entry');
    expect(names).toContain('update_knowledge_entry');
    expect(names).toContain('delete_knowledge_entry');
    expect(names).toContain('list_knowledge_entries');
    expect(names).toContain('search_knowledge');
    expect(names).toContain('increment_usefulness');
    expect(names).toContain('get_knowledge_stats');
    expect(names).toContain('extract_knowledge');
  });

  it('all tools should have descriptions and input schemas', async () => {
    const { knowledgeMcpTools } = await import('@/lib/modules/mcp-server/tools/knowledge-tools');

    for (const tool of knowledgeMcpTools) {
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeDefined();
    }
  });

  it('required fields should be defined correctly', async () => {
    const { knowledgeMcpTools } = await import('@/lib/modules/mcp-server/tools/knowledge-tools');

    const createTool = knowledgeMcpTools.find(t => t.name === 'create_knowledge_entry')!;
    expect((createTool.inputSchema as any).required).toContain('title');
    expect((createTool.inputSchema as any).required).toContain('content');

    const getTool = knowledgeMcpTools.find(t => t.name === 'get_knowledge_entry')!;
    expect((getTool.inputSchema as any).required).toContain('id');

    const searchTool = knowledgeMcpTools.find(t => t.name === 'search_knowledge')!;
    expect((searchTool.inputSchema as any).required).toContain('query');

    const extractTool = knowledgeMcpTools.find(t => t.name === 'extract_knowledge')!;
    expect((extractTool.inputSchema as any).required).toContain('projectId');
  });
});

// ================================================================
// Knowledge Tool Handlers Tests
// ============================================================

describe('Knowledge Tool Handlers', () => {
  it('should create handlers for all 9 tools', async () => {
    const { createKnowledgeToolHandlers } = await import('@/lib/modules/mcp-server/tools/knowledge-handlers');
    const mockService = {} as any;
    const mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      child: vi.fn(),
    };

    const handlers = createKnowledgeToolHandlers(mockService, mockLogger);

    const expectedTools = [
      'create_knowledge_entry', 'get_knowledge_entry', 'update_knowledge_entry',
      'delete_knowledge_entry', 'list_knowledge_entries', 'search_knowledge',
      'increment_usefulness', 'get_knowledge_stats', 'extract_knowledge',
    ];

    for (const toolName of expectedTools) {
      expect(handlers).toHaveProperty(toolName);
      expect(typeof handlers[toolName as keyof typeof handlers]).toBe('function');
    }
  });
});
