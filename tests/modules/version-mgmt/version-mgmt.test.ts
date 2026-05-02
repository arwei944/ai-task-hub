import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { VersionMgmtService } from '@/lib/modules/version-mgmt/version-mgmt.service';
import { Logger } from '@/lib/core/logger';
import { join } from 'node:path';

// Use a test database - set DATABASE_URL so getPrisma() in the service uses the same db
const TEST_DB_PATH = join(process.cwd(), 'test-db', 'test-version-mgmt.db');
process.env.DATABASE_URL = `file:${TEST_DB_PATH}`;

function createTestServices() {
  const adapter = new PrismaBetterSqlite3({ url: TEST_DB_PATH });
  const prisma = new PrismaClient({ adapter });
  const logger = new Logger('test');
  const service = new VersionMgmtService(logger);
  return { prisma, logger, service };
}

describe('VersionMgmtModule', () => {
  let services: ReturnType<typeof createTestServices>;
  let projectId: string;

  beforeEach(async () => {
    services = createTestServices();

    // Clean up all version-related data (order matters due to foreign keys)
    await services.prisma.releaseMilestone.deleteMany();
    await services.prisma.releaseApproval.deleteMany();
    await services.prisma.releaseTag.deleteMany();
    await services.prisma.releaseChangelog.deleteMany();
    await services.prisma.release.deleteMany();

    // Create a test project
    const project = await services.prisma.project.create({
      data: {
        name: `Test Project ${Date.now()}`,
        description: 'Test project for version management',
      },
    });
    projectId = project.id;
  });

  afterEach(async () => {
    // Clean up
    await services.prisma.releaseMilestone.deleteMany();
    await services.prisma.releaseApproval.deleteMany();
    await services.prisma.releaseTag.deleteMany();
    await services.prisma.releaseChangelog.deleteMany();
    await services.prisma.release.deleteMany();
    await services.prisma.$disconnect();
  });

  // ================================================================
  // Release CRUD
  // ================================================================

  describe('createRelease', () => {
    it('should create a release with explicit version', async () => {
      const release = await services.service.createRelease({
        projectId,
        version: '1.0.0',
        title: 'v1.0.0 - Initial Release',
        description: 'First release',
      });

      expect(release).toBeDefined();
      expect(release.version).toBe('1.0.0');
      expect(release.title).toBe('v1.0.0 - Initial Release');
      expect(release.status).toBe('draft');
      expect(release.channel).toBe('stable');
      expect(release.type).toBe('minor');
    });

    it('should create a release with auto-generated version', async () => {
      const release = await services.service.createRelease({
        projectId,
        title: 'Auto Version Release',
      });

      expect(release).toBeDefined();
      expect(release.version).toBe('1.0.0'); // No previous release, defaults to 1.0.0
    });

    it('should create a release with changelogs and tags', async () => {
      const release = await services.service.createRelease({
        projectId,
        version: '2.0.0',
        changelogs: [
          { category: 'added', title: 'New feature', description: 'Added a new feature' },
          { category: 'fixed', title: 'Bug fix', impact: 'patch' },
        ],
        tags: ['breaking', 'feature'],
      });

      expect(release.changelogs).toHaveLength(2);
      expect(release.changelogs[0].category).toBe('added');
      expect(release.changelogs[1].category).toBe('fixed');
      expect(release.tags).toHaveLength(2);
      expect(release.tags.map((t: any) => t.name)).toContain('breaking');
      expect(release.tags.map((t: any) => t.name)).toContain('feature');
    });

    it('should throw on duplicate version', async () => {
      await services.service.createRelease({ projectId, version: '1.0.0' });

      await expect(
        services.service.createRelease({ projectId, version: '1.0.0' })
      ).rejects.toThrow('already exists');
    });
  });

  describe('getRelease', () => {
    it('should get a release by id', async () => {
      const created = await services.service.createRelease({
        projectId,
        version: '1.0.0',
        title: 'Test Release',
      });

      const fetched = await services.service.getRelease(created.id);
      expect(fetched).toBeDefined();
      expect(fetched!.version).toBe('1.0.0');
      expect(fetched!.title).toBe('Test Release');
    });

    it('should throw for non-existent release', async () => {
      await expect(
        services.service.getRelease('non-existent-id')
      ).rejects.toThrow('not found');
    });
  });

  describe('updateRelease', () => {
    it('should update release fields', async () => {
      const created = await services.service.createRelease({
        projectId,
        version: '1.0.0',
      });

      const updated = await services.service.updateRelease(created.id, {
        title: 'Updated Title',
        description: 'Updated description',
      });

      expect(updated.title).toBe('Updated Title');
      expect(updated.description).toBe('Updated description');
    });

    it('should throw for non-existent release', async () => {
      await expect(
        services.service.updateRelease('non-existent-id', { title: 'test' })
      ).rejects.toThrow('not found');
    });
  });

  describe('deleteRelease', () => {
    it('should delete a draft release', async () => {
      const created = await services.service.createRelease({
        projectId,
        version: '1.0.0',
      });

      const result = await services.service.deleteRelease(created.id);
      expect(result.success).toBe(true);

      await expect(
        services.service.getRelease(created.id)
      ).rejects.toThrow('not found');
    });

    it('should not delete a published release', async () => {
      const created = await services.service.createRelease({
        projectId,
        version: '1.0.0',
      });

      // Manually set to published to bypass approval
      await services.prisma.release.update({
        where: { id: created.id },
        data: { status: 'published', publishedAt: new Date() },
      });

      await expect(
        services.service.deleteRelease(created.id)
      ).rejects.toThrow('Only draft releases can be deleted');
    });
  });

  describe('listReleases', () => {
    it('should list releases for a project', async () => {
      await services.service.createRelease({ projectId, version: '1.0.0' });
      await services.service.createRelease({ projectId, version: '1.1.0' });
      await services.service.createRelease({ projectId, version: '2.0.0' });

      const result = await services.service.listReleases({ projectId });
      expect(result.releases).toHaveLength(3);
      expect(result.total).toBe(3);
    });

    it('should filter by status', async () => {
      await services.service.createRelease({ projectId, version: '1.0.0' });

      const r2 = await services.service.createRelease({ projectId, version: '2.0.0' });
      await services.service.submitForReview(r2.id);
      await services.service.approveRelease(r2.id, { decision: 'approved' });

      const draftResult = await services.service.listReleases({ projectId, status: 'draft' });
      expect(draftResult.releases).toHaveLength(1);

      const approvedResult = await services.service.listReleases({ projectId, status: 'approved' });
      expect(approvedResult.releases).toHaveLength(1);
    });

    it('should filter by channel', async () => {
      await services.service.createRelease({ projectId, version: '1.0.0', channel: 'stable' });
      await services.service.createRelease({ projectId, version: '1.1.0-beta', channel: 'beta' });

      const result = await services.service.listReleases({ projectId, channel: 'beta' });
      expect(result.releases).toHaveLength(1);
      expect(result.releases[0].channel).toBe('beta');
    });

    it('should filter by search', async () => {
      await services.service.createRelease({ projectId, version: '1.0.0', title: 'Initial Release' });
      await services.service.createRelease({ projectId, version: '2.0.0', title: 'Major Update' });

      const result = await services.service.listReleases({ projectId, search: 'Major' });
      expect(result.releases).toHaveLength(1);
    });
  });

  // ================================================================
  // Version Auto-Increment
  // ================================================================

  describe('getNextVersion', () => {
    it('should return 1.0.0 when no previous release', async () => {
      const version = await services.service.getNextVersion(projectId, 'minor');
      expect(version).toBe('1.0.0');
    });

    it('should increment patch version', async () => {
      await services.prisma.release.create({
        data: {
          projectId,
          version: '1.2.3',
          title: 'v1.2.3',
          status: 'published',
          publishedAt: new Date(),
        },
      });

      const version = await services.service.getNextVersion(projectId, 'patch');
      expect(version).toBe('1.2.4');
    });

    it('should increment minor version', async () => {
      await services.prisma.release.create({
        data: {
          projectId,
          version: '1.2.3',
          title: 'v1.2.3',
          status: 'published',
          publishedAt: new Date(),
        },
      });

      const version = await services.service.getNextVersion(projectId, 'minor');
      expect(version).toBe('1.3.0');
    });

    it('should increment major version', async () => {
      await services.prisma.release.create({
        data: {
          projectId,
          version: '1.2.3',
          title: 'v1.2.3',
          status: 'published',
          publishedAt: new Date(),
        },
      });

      const version = await services.service.getNextVersion(projectId, 'major');
      expect(version).toBe('2.0.0');
    });
  });

  // ================================================================
  // Changelog Management
  // ================================================================

  describe('Changelog Management', () => {
    let releaseId: string;

    beforeEach(async () => {
      const release = await services.service.createRelease({
        projectId,
        version: '1.0.0',
      });
      releaseId = release.id;
    });

    it('should add a changelog entry', async () => {
      const changelog = await services.service.addChangelog(releaseId, {
        category: 'added',
        title: 'New feature',
        description: 'Added something cool',
      });

      expect(changelog).toBeDefined();
      expect(changelog.category).toBe('added');
      expect(changelog.title).toBe('New feature');
      expect(changelog.description).toBe('Added something cool');
    });

    it('should update a changelog entry', async () => {
      const cl = await services.service.addChangelog(releaseId, {
        category: 'added',
        title: 'Original title',
      });

      const updated = await services.service.updateChangelog(cl.id, {
        title: 'Updated title',
        description: 'Now with description',
      });

      expect(updated.title).toBe('Updated title');
      expect(updated.description).toBe('Now with description');
    });

    it('should remove a changelog entry', async () => {
      const cl = await services.service.addChangelog(releaseId, {
        category: 'fixed',
        title: 'Bug fix',
      });

      const result = await services.service.removeChangelog(cl.id);
      expect(result.success).toBe(true);
    });

    it('should reorder changelogs', async () => {
      const cl1 = await services.service.addChangelog(releaseId, { category: 'added', title: 'First' });
      const cl2 = await services.service.addChangelog(releaseId, { category: 'fixed', title: 'Second' });
      const cl3 = await services.service.addChangelog(releaseId, { category: 'changed', title: 'Third' });

      // Reverse order
      await services.service.reorderChangelogs(releaseId, [cl3.id, cl2.id, cl1.id]);

      const release = await services.service.getRelease(releaseId);
      expect(release.changelogs[0].id).toBe(cl3.id);
      expect(release.changelogs[1].id).toBe(cl2.id);
      expect(release.changelogs[2].id).toBe(cl1.id);
    });
  });

  // ================================================================
  // Tag Management
  // ================================================================

  describe('Tag Management', () => {
    let releaseId: string;

    beforeEach(async () => {
      const release = await services.service.createRelease({
        projectId,
        version: '1.0.0',
      });
      releaseId = release.id;
    });

    it('should add a tag', async () => {
      const tag = await services.service.addTag(releaseId, 'breaking', '#EF4444');
      expect(tag.name).toBe('breaking');
      expect(tag.color).toBe('#EF4444');
    });

    it('should add a tag with default color', async () => {
      const tag = await services.service.addTag(releaseId, 'feature');
      expect(tag.color).toBe('#6B7280');
    });

    it('should remove a tag', async () => {
      const tag = await services.service.addTag(releaseId, 'bugfix');
      const result = await services.service.removeTag(tag.id);
      expect(result.success).toBe(true);
    });
  });

  // ================================================================
  // Release Lifecycle
  // ================================================================

  describe('Release Lifecycle', () => {
    it('should submit draft for review', async () => {
      const release = await services.service.createRelease({ projectId, version: '1.0.0' });
      const updated = await services.service.submitForReview(release.id);
      expect(updated.status).toBe('review');
    });

    it('should not submit non-draft for review', async () => {
      const release = await services.service.createRelease({ projectId, version: '1.0.0' });
      await services.service.submitForReview(release.id);

      await expect(
        services.service.submitForReview(release.id)
      ).rejects.toThrow('Only draft releases can be submitted');
    });

    it('should approve a release in review', async () => {
      const release = await services.service.createRelease({ projectId, version: '1.0.0' });
      await services.service.submitForReview(release.id);

      const updated = await services.service.approveRelease(release.id, {
        decision: 'approved',
        comment: 'Looks good!',
        approverId: 'agent-1',
      });

      expect(updated!.status).toBe('approved');
    });

    it('should reject a release and revert to draft', async () => {
      const release = await services.service.createRelease({ projectId, version: '1.0.0' });
      await services.service.submitForReview(release.id);

      const updated = await services.service.approveRelease(release.id, {
        decision: 'rejected',
        comment: 'Needs more work',
      });

      expect(updated!.status).toBe('draft');
    });

    it('should publish an approved release', async () => {
      const release = await services.service.createRelease({ projectId, version: '1.0.0' });
      await services.service.submitForReview(release.id);
      await services.service.approveRelease(release.id, { decision: 'approved' });

      const updated = await services.service.publishRelease(release.id);
      expect(updated.status).toBe('published');
      expect(updated.publishedAt).toBeDefined();
    });

    it('should not publish a release without approval', async () => {
      const release = await services.service.createRelease({ projectId, version: '1.0.0' });
      await services.service.submitForReview(release.id);

      await expect(
        services.service.publishRelease(release.id)
      ).rejects.toThrow('must be approved first');
    });

    it('should publish a hotfix from draft without approval', async () => {
      const release = await services.service.createRelease({
        projectId,
        version: '1.0.1',
        channel: 'hotfix',
        type: 'hotfix',
      });

      const updated = await services.service.publishRelease(release.id);
      expect(updated.status).toBe('published');
      expect(updated.publishedAt).toBeDefined();
    });

    it('should archive a release', async () => {
      const release = await services.service.createRelease({ projectId, version: '1.0.0' });
      await services.service.submitForReview(release.id);
      await services.service.approveRelease(release.id, { decision: 'approved' });
      await services.service.publishRelease(release.id);

      const archived = await services.service.archiveRelease(release.id);
      expect(archived.status).toBe('archived');
      expect(archived.archivedAt).toBeDefined();
    });

    it('should rollback a published release', async () => {
      const release = await services.service.createRelease({ projectId, version: '1.0.0' });
      await services.service.submitForReview(release.id);
      await services.service.approveRelease(release.id, { decision: 'approved' });
      await services.service.publishRelease(release.id);

      const rolledBack = await services.service.rollbackRelease(release.id);
      expect(rolledBack.status).toBe('rolled_back');
    });

    it('should not rollback a non-published release', async () => {
      const release = await services.service.createRelease({ projectId, version: '1.0.0' });

      await expect(
        services.service.rollbackRelease(release.id)
      ).rejects.toThrow('Only published releases can be rolled back');
    });
  });

  // ================================================================
  // Milestone Management
  // ================================================================

  describe('Milestone Management', () => {
    let releaseId: string;

    beforeEach(async () => {
      const release = await services.service.createRelease({ projectId, version: '1.0.0' });
      releaseId = release.id;
    });

    it('should add a milestone', async () => {
      const milestone = await services.service.addMilestone(releaseId, {
        name: 'Code Freeze',
        status: 'pending',
      });

      expect(milestone.name).toBe('Code Freeze');
      expect(milestone.status).toBe('pending');
    });

    it('should update a milestone', async () => {
      const ms = await services.service.addMilestone(releaseId, { name: 'QA Complete' });
      const updated = await services.service.updateMilestone(ms.id, { status: 'in_progress' });
      expect(updated.status).toBe('in_progress');
    });

    it('should complete a milestone', async () => {
      const ms = await services.service.addMilestone(releaseId, { name: 'Deployed' });
      const completed = await services.service.completeMilestone(ms.id);
      expect(completed.status).toBe('completed');
      expect(completed.completedAt).toBeDefined();
    });
  });

  // ================================================================
  // Version Comparison
  // ================================================================

  describe('compareVersions', () => {
    it('should compare two versions', async () => {
      // Create two published releases
      await services.prisma.release.create({
        data: {
          projectId,
          version: '1.0.0',
          title: 'v1.0.0',
          status: 'published',
          publishedAt: new Date('2024-01-01'),
          changelogs: {
            create: [
              { category: 'added', title: 'Feature A', order: 0 },
              { category: 'fixed', title: 'Bug A', order: 1 },
            ],
          },
        },
      });

      await services.prisma.release.create({
        data: {
          projectId,
          version: '1.1.0',
          title: 'v1.1.0',
          status: 'published',
          publishedAt: new Date('2024-02-01'),
          changelogs: {
            create: [
              { category: 'added', title: 'Feature B', order: 0 },
              { category: 'fixed', title: 'Bug A', order: 1 },
              { category: 'changed', title: 'Updated API', order: 2 },
            ],
          },
        },
      });

      const result = await services.service.compareVersions(projectId, '1.0.0', '1.1.0');

      expect(result.base.version).toBe('1.0.0');
      expect(result.target.version).toBe('1.1.0');
      expect(result.newEntries).toHaveLength(2); // Feature B and Updated API (Bug A exists in both)
      expect(result.summary).toContain('2 changes');
    });

    it('should throw for non-existent version', async () => {
      await expect(
        services.service.compareVersions(projectId, '1.0.0', '9.9.9')
      ).rejects.toThrow('not found');
    });
  });

  // ================================================================
  // Changelog Generation
  // ================================================================

  describe('generateChangelog', () => {
    it('should generate changelog from activity logs', async () => {
      // Create some activity logs
      await services.prisma.activityLog.createMany({
        data: [
          {
            projectId,
            action: 'task_created',
            title: 'Created login feature',
            phase: 'implementation',
          },
          {
            projectId,
            action: 'task_completed',
            title: 'Completed database migration',
            phase: 'implementation',
          },
          {
            projectId,
            action: 'phase_changed',
            title: 'Phase moved to testing',
          },
        ],
      });

      const result = await services.service.generateChangelog(projectId);

      expect(result.totalActivities).toBe(3);
      expect(result.changelogs.length).toBeGreaterThan(0);
      expect(result.summary).toContain('changelog entries');
    });

    it('should generate changelog between versions', async () => {
      await services.prisma.release.create({
        data: {
          projectId,
          version: '1.0.0',
          title: 'v1.0.0',
          status: 'published',
          publishedAt: new Date('2024-01-01'),
        },
      });

      await services.prisma.release.create({
        data: {
          projectId,
          version: '2.0.0',
          title: 'v2.0.0',
          status: 'published',
          publishedAt: new Date('2024-06-01'),
        },
      });

      // Create activity logs between the two dates
      await services.prisma.activityLog.create({
        data: {
          projectId,
          action: 'task_created',
          title: 'New feature in v2',
          createdAt: new Date('2024-03-01'),
        },
      });

      const result = await services.service.generateChangelog(projectId, '1.0.0', '2.0.0');

      expect(result.fromVersion).toBe('1.0.0');
      expect(result.toVersion).toBe('2.0.0');
    });
  });

  // ================================================================
  // Release Statistics
  // ================================================================

  describe('getReleaseStats', () => {
    it('should return stats for a project', async () => {
      await services.service.createRelease({ projectId, version: '1.0.0' });
      await services.service.createRelease({ projectId, version: '1.1.0', channel: 'beta' });

      const stats = await services.service.getReleaseStats(projectId);

      expect(stats.total).toBe(2);
      expect(stats.byStatus.draft).toBe(2);
      expect(stats.byChannel.stable).toBe(1);
      expect(stats.byChannel.beta).toBe(1);
    });

    it('should return latest published version', async () => {
      await services.prisma.release.create({
        data: {
          projectId,
          version: '1.0.0',
          title: 'v1.0.0',
          status: 'published',
          publishedAt: new Date('2024-01-01'),
        },
      });

      await services.prisma.release.create({
        data: {
          projectId,
          version: '2.0.0',
          title: 'v2.0.0',
          status: 'published',
          publishedAt: new Date('2024-06-01'),
        },
      });

      const stats = await services.service.getReleaseStats(projectId);
      expect(stats.latestVersion).toBe('2.0.0');
    });
  });

  // ================================================================
  // Bulk Operations
  // ================================================================

  describe('bulkUpdateStatus', () => {
    it('should update multiple releases at once', async () => {
      const r1 = await services.service.createRelease({ projectId, version: '1.0.0' });
      const r2 = await services.service.createRelease({ projectId, version: '1.1.0' });
      const r3 = await services.service.createRelease({ projectId, version: '1.2.0' });

      const result = await services.service.bulkUpdateStatus(
        [r1.id, r2.id, r3.id],
        'archived',
      );

      expect(result.success).toBe(true);
      expect(result.updated).toBe(3);
    });
  });
});

// ================================================================
// MCP Tool Definitions Tests
// ================================================================

describe('Version MCP Tool Definitions', () => {
  it('should have 14 tools defined', async () => {
    const { versionMcpTools } = await import('@/lib/modules/mcp-server/tools/version-tools');
    expect(versionMcpTools).toHaveLength(14);
  });

  it('should have correct tool names', async () => {
    const { versionMcpTools } = await import('@/lib/modules/mcp-server/tools/version-tools');
    const names = versionMcpTools.map(t => t.name);

    expect(names).toContain('create_release');
    expect(names).toContain('get_release');
    expect(names).toContain('list_releases');
    expect(names).toContain('update_release');
    expect(names).toContain('delete_release');
    expect(names).toContain('publish_release');
    expect(names).toContain('add_changelog');
    expect(names).toContain('compare_versions');
    expect(names).toContain('get_next_version');
    expect(names).toContain('get_release_stats');
    expect(names).toContain('submit_for_review');
    expect(names).toContain('approve_release');
    expect(names).toContain('rollback_release');
    expect(names).toContain('generate_changelog');
  });

  it('all tools should have descriptions and input schemas', async () => {
    const { versionMcpTools } = await import('@/lib/modules/mcp-server/tools/version-tools');

    for (const tool of versionMcpTools) {
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeDefined();
    }
  });

  it('required fields should be defined correctly', async () => {
    const { versionMcpTools } = await import('@/lib/modules/mcp-server/tools/version-tools');

    const createTool = versionMcpTools.find(t => t.name === 'create_release')!;
    expect((createTool.inputSchema as any).required).toContain('projectId');

    const getTool = versionMcpTools.find(t => t.name === 'get_release')!;
    expect((getTool.inputSchema as any).required).toContain('id');

    const compareTool = versionMcpTools.find(t => t.name === 'compare_versions')!;
    expect((compareTool.inputSchema as any).required).toContain('projectId');
    expect((compareTool.inputSchema as any).required).toContain('baseVersion');
    expect((compareTool.inputSchema as any).required).toContain('targetVersion');
  });
});

// ================================================================
// Version Tool Handlers Tests
// ================================================================

describe('Version Tool Handlers', () => {
  it('should create handlers for all 14 tools', async () => {
    const { createVersionToolHandlers } = await import('@/lib/modules/mcp-server/tools/version-handlers');
    const mockService = {} as any;
    const mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      child: vi.fn(),
    };

    const handlers = createVersionToolHandlers(mockService, mockLogger);

    const expectedTools = [
      'create_release', 'get_release', 'list_releases', 'update_release',
      'delete_release', 'publish_release', 'add_changelog', 'compare_versions',
      'get_next_version', 'get_release_stats', 'submit_for_review',
      'approve_release', 'rollback_release', 'generate_changelog',
    ];

    for (const toolName of expectedTools) {
      expect(handlers).toHaveProperty(toolName);
      expect(typeof handlers[toolName as keyof typeof handlers]).toBe('function');
    }
  });
});
