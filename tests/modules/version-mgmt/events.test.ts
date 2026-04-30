// ============================================================
// Version-Mgmt Event Emission Tests (Phase 2 - v2.0.0-alpha.2)
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IEventBus, ILogger } from '@/lib/core/types';

// --- Mocks ---

function createMockEventBus(): IEventBus {
  return {
    emit: vi.fn(),
    emitAsync: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    off: vi.fn(),
    removeAllListeners: vi.fn(),
  };
}

function createMockLogger(): ILogger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => createMockLogger()),
  };
}

// --- Mock Prisma Factories ---

function createMockPrismaForCreateRelease() {
  const mockRelease = {
    id: 'release-001',
    projectId: 'proj-001',
    version: '1.0.0',
    title: 'First Release',
    status: 'draft',
    channel: 'stable',
    type: 'minor',
    createdBy: 'user-1',
    previousVersion: null,
    description: null,
    releaseNotes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    publishedAt: null,
    archivedAt: null,
    changelogs: [],
    tags: [],
    approvals: [],
    milestones: [],
    project: { id: 'proj-001', name: 'Test Project' },
  };

  return {
    release: {
      findUnique: vi.fn().mockImplementation((args: any) => {
        // getRelease calls findUnique with { where: { id } }
        if (args?.where?.id === 'release-001') return mockRelease;
        // createRelease duplicate check: { where: { projectId_version } }
        return null;
      }),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(mockRelease),
    },
    $disconnect: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockPrismaForSubmitReview() {
  const draftRelease = {
    id: 'release-001',
    projectId: 'proj-001',
    version: '1.0.0',
    status: 'draft',
  };

  const reviewRelease = {
    ...draftRelease,
    status: 'review',
  };

  return {
    release: {
      findUnique: vi.fn().mockResolvedValue(draftRelease),
      update: vi.fn().mockResolvedValue(reviewRelease),
    },
    $disconnect: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockPrismaForPublishRelease() {
  const approvedRelease = {
    id: 'release-001',
    projectId: 'proj-001',
    version: '1.0.0',
    status: 'approved',
    channel: 'stable',
    approvals: [{ decision: 'approved' }],
  };

  const publishedRelease = {
    ...approvedRelease,
    status: 'published',
    publishedAt: new Date(),
  };

  return {
    release: {
      findUnique: vi.fn().mockResolvedValue(approvedRelease),
      update: vi.fn().mockResolvedValue(publishedRelease),
    },
    releaseApproval: {
      count: vi.fn().mockResolvedValue(1),
    },
    $disconnect: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockPrismaForRollbackRelease() {
  const publishedRelease = {
    id: 'release-001',
    projectId: 'proj-001',
    version: '1.0.0',
    status: 'published',
  };

  const rolledBackRelease = {
    ...publishedRelease,
    status: 'rolled_back',
  };

  return {
    release: {
      findUnique: vi.fn().mockResolvedValue(publishedRelease),
      update: vi.fn().mockResolvedValue(rolledBackRelease),
    },
    $disconnect: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockPrismaForArchiveRelease() {
  const approvedRelease = {
    id: 'release-001',
    projectId: 'proj-001',
    version: '1.0.0',
    status: 'approved',
  };

  const archivedRelease = {
    ...approvedRelease,
    status: 'archived',
    archivedAt: new Date(),
  };

  return {
    release: {
      findUnique: vi.fn().mockResolvedValue(approvedRelease),
      update: vi.fn().mockResolvedValue(archivedRelease),
    },
    $disconnect: vi.fn().mockResolvedValue(undefined),
  };
}

// Helper to extract event calls by type
function getEventCalls(eventBus: IEventBus, type?: string) {
  return (eventBus.emit as any).mock.calls
    .map((call: any) => call[0])
    .filter((e: any) => !type || e.type === type);
}

// --- Tests ---

describe('VersionMgmtService Event Emission', () => {
  let eventBus: IEventBus;
  let logger: ILogger;

  beforeEach(() => {
    eventBus = createMockEventBus();
    logger = createMockLogger();
    vi.resetModules();
  });

  describe('release.created event', () => {
    it('should emit release.created when a release is created', async () => {
      const mockPrisma = createMockPrismaForCreateRelease();
      vi.doMock('@/lib/db', () => ({
        getPrisma: () => mockPrisma,
      }));

      const { VersionMgmtService } = await import('@/lib/modules/version-mgmt/version-mgmt.service');
      const service = new VersionMgmtService(logger, eventBus);

      await service.createRelease({
        projectId: 'proj-001',
        version: '1.0.0',
        title: 'First Release',
        channel: 'stable',
        type: 'minor',
        createdBy: 'user-1',
      });

      const calls = getEventCalls(eventBus, 'release.created');
      expect(calls).toHaveLength(1);
      expect(calls[0].payload).toMatchObject({
        releaseId: 'release-001',
        projectId: 'proj-001',
        version: '1.0.0',
        title: 'First Release',
        channel: 'stable',
        type: 'minor',
        createdBy: 'user-1',
      });
      expect(calls[0].source).toBe('version-mgmt');
      expect(calls[0].timestamp).toBeInstanceOf(Date);
    });
  });

  describe('release.status.changed event', () => {
    it('should emit release.status.changed when submitting for review', async () => {
      const mockPrisma = createMockPrismaForSubmitReview();
      vi.doMock('@/lib/db', () => ({
        getPrisma: () => mockPrisma,
      }));

      const { VersionMgmtService } = await import('@/lib/modules/version-mgmt/version-mgmt.service');
      const service = new VersionMgmtService(logger, eventBus);

      await service.submitForReview('release-001');

      const calls = getEventCalls(eventBus, 'release.status.changed');
      expect(calls).toHaveLength(1);
      expect(calls[0].payload).toMatchObject({
        releaseId: 'release-001',
        projectId: 'proj-001',
        status: 'review',
        previousStatus: 'draft',
      });
    });

    it('should emit release.status.changed when archiving', async () => {
      const mockPrisma = createMockPrismaForArchiveRelease();
      vi.doMock('@/lib/db', () => ({
        getPrisma: () => mockPrisma,
      }));

      const { VersionMgmtService } = await import('@/lib/modules/version-mgmt/version-mgmt.service');
      const service = new VersionMgmtService(logger, eventBus);

      await service.archiveRelease('release-001');

      const calls = getEventCalls(eventBus, 'release.status.changed');
      expect(calls).toHaveLength(1);
      expect(calls[0].payload).toMatchObject({
        releaseId: 'release-001',
        projectId: 'proj-001',
        status: 'archived',
        previousStatus: 'approved',
      });
    });
  });

  describe('release.published event', () => {
    it('should emit both release.status.changed and release.published when publishing', async () => {
      const mockPrisma = createMockPrismaForPublishRelease();
      vi.doMock('@/lib/db', () => ({
        getPrisma: () => mockPrisma,
      }));

      const { VersionMgmtService } = await import('@/lib/modules/version-mgmt/version-mgmt.service');
      const service = new VersionMgmtService(logger, eventBus);

      await service.publishRelease('release-001');

      const statusCalls = getEventCalls(eventBus, 'release.status.changed');
      expect(statusCalls).toHaveLength(1);
      expect(statusCalls[0].payload).toMatchObject({
        releaseId: 'release-001',
        projectId: 'proj-001',
        status: 'published',
        previousStatus: 'approved',
      });

      const publishedCalls = getEventCalls(eventBus, 'release.published');
      expect(publishedCalls).toHaveLength(1);
      expect(publishedCalls[0].payload).toMatchObject({
        releaseId: 'release-001',
        projectId: 'proj-001',
        version: '1.0.0',
      });
    });
  });

  describe('release.rolled.back event', () => {
    it('should emit both release.status.changed and release.rolled.back when rolling back', async () => {
      const mockPrisma = createMockPrismaForRollbackRelease();
      vi.doMock('@/lib/db', () => ({
        getPrisma: () => mockPrisma,
      }));

      const { VersionMgmtService } = await import('@/lib/modules/version-mgmt/version-mgmt.service');
      const service = new VersionMgmtService(logger, eventBus);

      await service.rollbackRelease('release-001');

      const statusCalls = getEventCalls(eventBus, 'release.status.changed');
      expect(statusCalls).toHaveLength(1);
      expect(statusCalls[0].payload).toMatchObject({
        releaseId: 'release-001',
        projectId: 'proj-001',
        status: 'rolled_back',
        previousStatus: 'published',
      });

      const rolledBackCalls = getEventCalls(eventBus, 'release.rolled.back');
      expect(rolledBackCalls).toHaveLength(1);
      expect(rolledBackCalls[0].payload).toMatchObject({
        releaseId: 'release-001',
        projectId: 'proj-001',
      });
    });
  });

  describe('no eventBus', () => {
    it('should not throw when eventBus is not provided', async () => {
      const mockPrisma = createMockPrismaForCreateRelease();
      vi.doMock('@/lib/db', () => ({
        getPrisma: () => mockPrisma,
      }));

      const { VersionMgmtService } = await import('@/lib/modules/version-mgmt/version-mgmt.service');
      const serviceNoBus = new VersionMgmtService(logger);

      await expect(
        serviceNoBus.createRelease({
          projectId: 'proj-001',
          version: '1.0.0',
        })
      ).resolves.toBeDefined();
    });
  });

  describe('event source', () => {
    it('should always set source to version-mgmt', async () => {
      const mockPrisma = createMockPrismaForCreateRelease();
      vi.doMock('@/lib/db', () => ({
        getPrisma: () => mockPrisma,
      }));

      const { VersionMgmtService } = await import('@/lib/modules/version-mgmt/version-mgmt.service');
      const service = new VersionMgmtService(logger, eventBus);

      await service.createRelease({
        projectId: 'proj-001',
        version: '1.0.0',
      });

      const allCalls = getEventCalls(eventBus);
      for (const call of allCalls) {
        expect(call.source).toBe('version-mgmt');
      }
    });
  });
});
