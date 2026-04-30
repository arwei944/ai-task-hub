import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { RequirementsService } from '@/lib/modules/requirements/requirements.service';
import { Logger } from '@/lib/core/logger';
import { join } from 'node:path';

// Use the same test database created by global-setup
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
  const service = new RequirementsService(logger, eventBus as any, () => prisma);
  return { prisma, logger, service, eventBus };
}

describe('RequirementsService', () => {
  let services: ReturnType<typeof createTestServices>;
  let projectId: string;

  beforeEach(async () => {
    services = createTestServices();

    // Clean up requirement data (order matters due to foreign keys)
    await services.prisma.requirementTag.deleteMany();
    await services.prisma.requirement.deleteMany();

    // Create a test project
    const project = await services.prisma.project.create({
      data: {
        name: `Test Project ${Date.now()}`,
        description: 'Test project for requirements',
      },
    });
    projectId = project.id;
  });

  afterEach(async () => {
    await services.prisma.requirementTag.deleteMany();
    await services.prisma.requirement.deleteMany();
    await services.prisma.$disconnect();
  });

  // ================================================================
  // CRUD Operations
  // ================================================================

  describe('createRequirement', () => {
    it('should create a requirement with default values', async () => {
      const req = await services.service.createRequirement({
        projectId,
        title: 'User Login',
        description: 'Users should be able to log in with email and password',
      });

      expect(req).toBeDefined();
      expect(req.title).toBe('User Login');
      expect(req.description).toBe('Users should be able to log in with email and password');
      expect(req.type).toBe('feature');
      expect(req.priority).toBe(0);
      expect(req.status).toBe('draft');
      expect(req.projectId).toBe(projectId);
    });

    it('should create a requirement with all fields', async () => {
      const req = await services.service.createRequirement({
        projectId,
        title: 'Critical Bug Fix',
        description: 'Security vulnerability in auth module',
        type: 'bug',
        priority: 5,
        complexity: 'critical',
        acceptance: 'Bug no longer reproducible',
        source: 'user-report',
        createdBy: 'agent-1',
        tags: ['security', 'urgent'],
      });

      expect(req.title).toBe('Critical Bug Fix');
      expect(req.type).toBe('bug');
      expect(req.priority).toBe(5);
      expect(req.complexity).toBe('critical');
      expect(req.acceptance).toBe('Bug no longer reproducible');
      expect(req.source).toBe('user-report');
      expect(req.createdBy).toBe('agent-1');
      expect(req.tags).toHaveLength(2);
      expect(req.tags.map((t: any) => t.name)).toContain('security');
      expect(req.tags.map((t: any) => t.name)).toContain('urgent');
    });

    it('should create a requirement with parent', async () => {
      const parent = await services.service.createRequirement({
        projectId,
        title: 'Epic: User Management',
        description: 'Complete user management system',
        type: 'epic',
      });

      const child = await services.service.createRequirement({
        projectId,
        title: 'User Login',
        description: 'Login functionality',
        parentReqId: parent.id,
      });

      expect(child.parentReqId).toBe(parent.id);
    });

    it('should throw for non-existent project', async () => {
      await expect(
        services.service.createRequirement({
          projectId: 'non-existent-id',
          title: 'Test',
          description: 'Test',
        })
      ).rejects.toThrow('Project not found');
    });

    it('should throw for non-existent parent requirement', async () => {
      await expect(
        services.service.createRequirement({
          projectId,
          title: 'Test',
          description: 'Test',
          parentReqId: 'non-existent-id',
        })
      ).rejects.toThrow('Parent requirement not found');
    });

    it('should emit requirement.created event', async () => {
      await services.service.createRequirement({
        projectId,
        title: 'Test Requirement',
        description: 'Test description',
        createdBy: 'agent-1',
      });

      expect(services.eventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'requirement.created',
          source: 'requirements',
        }),
      );
    });
  });

  describe('getRequirement', () => {
    it('should get a requirement by id', async () => {
      const created = await services.service.createRequirement({
        projectId,
        title: 'Test Req',
        description: 'Test description',
      });

      const fetched = await services.service.getRequirement(created.id);
      expect(fetched).toBeDefined();
      expect(fetched!.title).toBe('Test Req');
      expect(fetched!._count).toBeDefined();
    });

    it('should throw for non-existent requirement', async () => {
      await expect(
        services.service.getRequirement('non-existent-id')
      ).rejects.toThrow('Requirement not found');
    });
  });

  describe('updateRequirement', () => {
    it('should update requirement fields', async () => {
      const created = await services.service.createRequirement({
        projectId,
        title: 'Original Title',
        description: 'Original description',
      });

      const updated = await services.service.updateRequirement(created.id, {
        title: 'Updated Title',
        description: 'Updated description',
        priority: 3,
        complexity: 'medium',
      });

      expect(updated.title).toBe('Updated Title');
      expect(updated.description).toBe('Updated description');
      expect(updated.priority).toBe(3);
      expect(updated.complexity).toBe('medium');
    });

    it('should throw for non-existent requirement', async () => {
      await expect(
        services.service.updateRequirement('non-existent-id', { title: 'test' })
      ).rejects.toThrow('Requirement not found');
    });

    it('should allow setting parentReqId to null', async () => {
      const parent = await services.service.createRequirement({
        projectId,
        title: 'Parent',
        description: 'Parent desc',
      });

      const child = await services.service.createRequirement({
        projectId,
        title: 'Child',
        description: 'Child desc',
        parentReqId: parent.id,
      });

      const updated = await services.service.updateRequirement(child.id, {
        parentReqId: null,
      });

      expect(updated.parentReqId).toBeNull();
    });
  });

  describe('deleteRequirement', () => {
    it('should soft delete a requirement (set status to rejected)', async () => {
      const created = await services.service.createRequirement({
        projectId,
        title: 'To Delete',
        description: 'Will be soft deleted',
      });

      const result = await services.service.deleteRequirement(created.id);
      expect(result.success).toBe(true);

      // Verify status changed to rejected
      const fetched = await services.service.getRequirement(created.id);
      expect(fetched.status).toBe('rejected');
    });

    it('should throw for non-existent requirement', async () => {
      await expect(
        services.service.deleteRequirement('non-existent-id')
      ).rejects.toThrow('Requirement not found');
    });
  });

  describe('listRequirements', () => {
    it('should list requirements for a project', async () => {
      await services.service.createRequirement({ projectId, title: 'Req 1', description: 'Desc 1' });
      await services.service.createRequirement({ projectId, title: 'Req 2', description: 'Desc 2' });
      await services.service.createRequirement({ projectId, title: 'Req 3', description: 'Desc 3' });

      const result = await services.service.listRequirements({ projectId });
      expect(result.requirements).toHaveLength(3);
      expect(result.total).toBe(3);
    });

    it('should filter by status', async () => {
      const r1 = await services.service.createRequirement({ projectId, title: 'Req 1', description: 'Desc 1' });
      await services.service.createRequirement({ projectId, title: 'Req 2', description: 'Desc 2' });

      await services.service.updateStatus(r1.id, 'approved');

      const result = await services.service.listRequirements({ projectId, status: 'approved' });
      expect(result.requirements).toHaveLength(1);
      expect(result.requirements[0].id).toBe(r1.id);
    });

    it('should filter by type', async () => {
      await services.service.createRequirement({ projectId, title: 'Feature', description: 'Desc', type: 'feature' });
      await services.service.createRequirement({ projectId, title: 'Bug', description: 'Desc', type: 'bug' });

      const result = await services.service.listRequirements({ projectId, type: 'bug' });
      expect(result.requirements).toHaveLength(1);
      expect(result.requirements[0].type).toBe('bug');
    });

    it('should filter by search', async () => {
      await services.service.createRequirement({ projectId, title: 'User Login', description: 'Login feature' });
      await services.service.createRequirement({ projectId, title: 'User Logout', description: 'Logout feature' });
      await services.service.createRequirement({ projectId, title: 'Admin Panel', description: 'Admin dashboard' });

      const result = await services.service.listRequirements({ projectId, search: 'User' });
      expect(result.requirements).toHaveLength(2);
    });

    it('should support pagination', async () => {
      await services.service.createRequirement({ projectId, title: 'Req 1', description: 'Desc 1' });
      await services.service.createRequirement({ projectId, title: 'Req 2', description: 'Desc 2' });
      await services.service.createRequirement({ projectId, title: 'Req 3', description: 'Desc 3' });

      const page1 = await services.service.listRequirements({ projectId, limit: 2, offset: 0 });
      expect(page1.requirements).toHaveLength(2);

      const page2 = await services.service.listRequirements({ projectId, limit: 2, offset: 2 });
      expect(page2.requirements).toHaveLength(1);
    });

    it('should filter by parentReqId', async () => {
      const parent = await services.service.createRequirement({
        projectId,
        title: 'Parent',
        description: 'Parent desc',
      });

      await services.service.createRequirement({
        projectId,
        title: 'Child 1',
        description: 'Child desc 1',
        parentReqId: parent.id,
      });

      await services.service.createRequirement({
        projectId,
        title: 'Unrelated',
        description: 'Not a child',
      });

      const result = await services.service.listRequirements({ projectId, parentReqId: parent.id });
      expect(result.requirements).toHaveLength(1);
      expect(result.requirements[0].title).toBe('Child 1');
    });
  });

  // ================================================================
  // Status Transitions
  // ================================================================

  describe('updateStatus', () => {
    it('should update requirement status', async () => {
      const req = await services.service.createRequirement({
        projectId,
        title: 'Test',
        description: 'Test',
      });

      const updated = await services.service.updateStatus(req.id, 'reviewing');
      expect(updated.status).toBe('reviewing');
    });

    it('should emit requirement.status.changed event', async () => {
      const req = await services.service.createRequirement({
        projectId,
        title: 'Test',
        description: 'Test',
      });

      await services.service.updateStatus(req.id, 'approved');

      expect(services.eventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'requirement.status.changed',
          source: 'requirements',
        }),
      );
    });

    it('should throw for non-existent requirement', async () => {
      await expect(
        services.service.updateStatus('non-existent-id', 'approved')
      ).rejects.toThrow('Requirement not found');
    });
  });

  // ================================================================
  // Tag Management
  // ================================================================

  describe('addTag', () => {
    it('should add a tag to a requirement', async () => {
      const req = await services.service.createRequirement({
        projectId,
        title: 'Test',
        description: 'Test',
      });

      const tag = await services.service.addTag(req.id, 'frontend');
      expect(tag.name).toBe('frontend');
      expect(tag.requirementId).toBe(req.id);
    });

    it('should throw for non-existent requirement', async () => {
      await expect(
        services.service.addTag('non-existent-id', 'tag')
      ).rejects.toThrow('Requirement not found');
    });
  });

  describe('removeTag', () => {
    it('should remove a tag from a requirement', async () => {
      const req = await services.service.createRequirement({
        projectId,
        title: 'Test',
        description: 'Test',
      });

      await services.service.addTag(req.id, 'removable');

      const result = await services.service.removeTag(req.id, 'removable');
      expect(result.success).toBe(true);
    });

    it('should throw for non-existent tag', async () => {
      const req = await services.service.createRequirement({
        projectId,
        title: 'Test',
        description: 'Test',
      });

      await expect(
        services.service.removeTag(req.id, 'non-existent-tag')
      ).rejects.toThrow('not found');
    });
  });

  // ================================================================
  // Decomposition
  // ================================================================

  describe('decomposeRequirement', () => {
    it('should decompose a requirement into sub-requirements', async () => {
      const parent = await services.service.createRequirement({
        projectId,
        title: 'Epic: User System',
        description: 'Complete user system',
        type: 'epic',
      });

      const children = await services.service.decomposeRequirement(parent.id, [
        { projectId, title: 'Login', description: 'User login', type: 'feature' },
        { projectId, title: 'Register', description: 'User registration', type: 'feature' },
        { projectId, title: 'Profile', description: 'User profile', type: 'feature' },
      ]);

      expect(children).toHaveLength(3);
      for (const child of children) {
        expect(child.parentReqId).toBe(parent.id);
      }

      // Verify parent has 3 children
      const parentWithCount = await services.service.getRequirement(parent.id);
      expect(parentWithCount._count.children).toBe(3);
    });

    it('should throw for non-existent parent', async () => {
      await expect(
        services.service.decomposeRequirement('non-existent-id', [
          { projectId, title: 'Sub', description: 'Sub desc' },
        ])
      ).rejects.toThrow('Requirement not found');
    });

    it('should create sub-requirements with tags', async () => {
      const parent = await services.service.createRequirement({
        projectId,
        title: 'Parent',
        description: 'Parent desc',
      });

      const children = await services.service.decomposeRequirement(parent.id, [
        { projectId, title: 'Sub 1', description: 'Sub desc 1', tags: ['tag-a'] },
      ]);

      // Fetch the child to verify tags
      const child = await services.service.getRequirement(children[0].id);
      expect(child.tags).toHaveLength(1);
      expect(child.tags[0].name).toBe('tag-a');
    });
  });

  // ================================================================
  // Task Mapping
  // ================================================================

  describe('mapToTask', () => {
    it('should create a task from a requirement', async () => {
      const req = await services.service.createRequirement({
        projectId,
        title: 'User Login Feature',
        description: 'Implement user login',
        priority: 4,
        createdBy: 'agent-1',
      });

      const task = await services.service.mapToTask(req.id, {
        assignee: 'dev-1',
      });

      expect(task).toBeDefined();
      expect(task.title).toBe('User Login Feature');
      expect(task.projectId).toBe(projectId);
      expect(task.source).toBe('requirement');
      expect(task.assignee).toBe('dev-1');

      // Verify requirement status changed to implemented
      const updatedReq = await services.service.getRequirement(req.id);
      expect(updatedReq.status).toBe('implemented');
    });

    it('should allow custom title and description for task', async () => {
      const req = await services.service.createRequirement({
        projectId,
        title: 'Big Feature',
        description: 'Long description',
      });

      const task = await services.service.mapToTask(req.id, {
        title: 'Sprint 1: Login',
        description: 'Implement login for sprint 1',
      });

      expect(task.title).toBe('Sprint 1: Login');
      expect(task.description).toBe('Implement login for sprint 1');
    });

    it('should emit requirement.mapped.to.task event', async () => {
      const req = await services.service.createRequirement({
        projectId,
        title: 'Test',
        description: 'Test',
      });

      await services.service.mapToTask(req.id, {});

      expect(services.eventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'requirement.mapped.to.task',
          source: 'requirements',
        }),
      );
    });

    it('should throw for non-existent requirement', async () => {
      await expect(
        services.service.mapToTask('non-existent-id', {})
      ).rejects.toThrow('Requirement not found');
    });
  });

  // ================================================================
  // Statistics
  // ================================================================

  describe('getRequirementStats', () => {
    it('should return stats for a project', async () => {
      await services.service.createRequirement({ projectId, title: 'R1', description: 'D1', type: 'feature' });
      await services.service.createRequirement({ projectId, title: 'R2', description: 'D2', type: 'bug' });
      await services.service.createRequirement({ projectId, title: 'R3', description: 'D3', type: 'feature', complexity: 'high' });

      const stats = await services.service.getRequirementStats(projectId);

      expect(stats.total).toBe(3);
      expect(stats.byType.feature).toBe(2);
      expect(stats.byType.bug).toBe(1);
      expect(stats.byStatus.draft).toBe(3);
      expect(stats.byComplexity.high).toBe(1);
      expect(stats.rootCount).toBe(3);
    });

    it('should count root requirements correctly', async () => {
      const parent = await services.service.createRequirement({
        projectId,
        title: 'Parent',
        description: 'Parent desc',
      });

      await services.service.decomposeRequirement(parent.id, [
        { projectId, title: 'Child 1', description: 'Child 1 desc' },
        { projectId, title: 'Child 2', description: 'Child 2 desc' },
      ]);

      const stats = await services.service.getRequirementStats(projectId);
      expect(stats.total).toBe(3);
      expect(stats.rootCount).toBe(1);
    });
  });
});

// ================================================================
// MCP Tool Definitions Tests
// ================================================================

describe('Requirement MCP Tool Definitions', () => {
  it('should have 12 tools defined', async () => {
    const { requirementMcpTools } = await import('@/lib/modules/mcp-server/tools/requirement-tools');
    expect(requirementMcpTools).toHaveLength(12);
  });

  it('should have correct tool names', async () => {
    const { requirementMcpTools } = await import('@/lib/modules/mcp-server/tools/requirement-tools');
    const names = requirementMcpTools.map((t) => t.name);

    expect(names).toContain('create_requirement');
    expect(names).toContain('get_requirement');
    expect(names).toContain('update_requirement');
    expect(names).toContain('delete_requirement');
    expect(names).toContain('list_requirements');
    expect(names).toContain('update_requirement_status');
    expect(names).toContain('add_requirement_tag');
    expect(names).toContain('remove_requirement_tag');
    expect(names).toContain('decompose_requirement');
    expect(names).toContain('map_requirement_to_task');
    expect(names).toContain('analyze_requirement');
    expect(names).toContain('get_requirement_stats');
  });

  it('all tools should have descriptions and input schemas', async () => {
    const { requirementMcpTools } = await import('@/lib/modules/mcp-server/tools/requirement-tools');

    for (const tool of requirementMcpTools) {
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeDefined();
    }
  });

  it('required fields should be defined correctly', async () => {
    const { requirementMcpTools } = await import('@/lib/modules/mcp-server/tools/requirement-tools');

    const createTool = requirementMcpTools.find((t) => t.name === 'create_requirement')!;
    expect((createTool.inputSchema as any).required).toContain('projectId');
    expect((createTool.inputSchema as any).required).toContain('title');
    expect((createTool.inputSchema as any).required).toContain('description');

    const getTool = requirementMcpTools.find((t) => t.name === 'get_requirement')!;
    expect((getTool.inputSchema as any).required).toContain('id');

    const statusTool = requirementMcpTools.find((t) => t.name === 'update_requirement_status')!;
    expect((statusTool.inputSchema as any).required).toContain('id');
    expect((statusTool.inputSchema as any).required).toContain('status');

    const decomposeTool = requirementMcpTools.find((t) => t.name === 'decompose_requirement')!;
    expect((decomposeTool.inputSchema as any).required).toContain('id');
    expect((decomposeTool.inputSchema as any).required).toContain('subRequirements');
  });
});

// ================================================================
// Requirement Tool Handlers Tests
// ================================================================

describe('Requirement Tool Handlers', () => {
  it('should create handlers for all 12 tools', async () => {
    const { createRequirementToolHandlers } = await import('@/lib/modules/mcp-server/tools/requirement-handlers');
    const mockService = {} as any;
    const mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      child: vi.fn(),
    };

    const handlers = createRequirementToolHandlers(mockService, mockLogger);

    const expectedTools = [
      'create_requirement',
      'get_requirement',
      'update_requirement',
      'delete_requirement',
      'list_requirements',
      'update_requirement_status',
      'add_requirement_tag',
      'remove_requirement_tag',
      'decompose_requirement',
      'map_requirement_to_task',
      'analyze_requirement',
      'get_requirement_stats',
    ];

    for (const toolName of expectedTools) {
      expect(handlers).toHaveProperty(toolName);
      expect(typeof handlers[toolName as keyof typeof handlers]).toBe('function');
    }
  });
});
