import { getPrisma } from '@/lib/db';
import type { ILogger } from '@/lib/core/types';
import type {
  CreateReleaseInput,
  UpdateReleaseInput,
  AddChangelogInput,
  ReleaseApprovalInput,
  ReleaseMilestoneInput,
  ReleaseFilter,
  VersionCompareResult,
  CreateChangelogInput,
} from './types';

export class VersionMgmtService {
  constructor(private logger: ILogger) {}

  // ================================================================
  // Release CRUD
  // ================================================================

  async createRelease(input: CreateReleaseInput) {
    const prisma = getPrisma();
    try {
      const { projectId, version, title, description, channel, type, releaseNotes, changelogs, tags, createdBy } = input;

      // Auto-generate version if not provided
      let releaseVersion = version;
      if (!releaseVersion) {
        releaseVersion = await this.getNextVersion(projectId, type || 'minor');
      }

      // Check for duplicate version
      const existing = await prisma.release.findUnique({
        where: { projectId_version: { projectId, version: releaseVersion } },
      });
      if (existing) {
        throw new Error(`Version "${releaseVersion}" already exists for this project`);
      }

      // Find previous release
      const previousRelease = await prisma.release.findFirst({
        where: { projectId, status: 'published' },
        orderBy: { publishedAt: 'desc' },
      });

      const releaseTitle = title || `v${releaseVersion} - New Release`;

      const release = await prisma.release.create({
        data: {
          projectId,
          version: releaseVersion,
          previousVersion: previousRelease?.version ?? null,
          title: releaseTitle,
          description: description ?? null,
          channel: channel || 'stable',
          type: type || 'minor',
          releaseNotes: releaseNotes ?? null,
          createdBy: createdBy ?? null,
        },
      });

      // Create changelogs if provided
      if (changelogs && changelogs.length > 0) {
        for (let i = 0; i < changelogs.length; i++) {
          const cl = changelogs[i];
          await prisma.releaseChangelog.create({
            data: {
              releaseId: release.id,
              category: cl.category,
              title: cl.title,
              description: cl.description ?? null,
              impact: cl.impact || 'patch',
              metadata: cl.metadata ? JSON.stringify(cl.metadata) : null,
              order: i,
            },
          });
        }
      }

      // Create tags if provided
      if (tags && tags.length > 0) {
        for (const tagName of tags) {
          await prisma.releaseTag.create({
            data: {
              releaseId: release.id,
              name: tagName,
            },
          });
        }
      }

      this.logger.info(`Release created: ${release.id} - v${releaseVersion}`);

      // Return the full release with relations
      return await this.getRelease(release.id);
    } finally {
      await prisma.$disconnect();
    }
  }

  async getRelease(id: string) {
    const prisma = getPrisma();
    try {
      const release = await prisma.release.findUnique({
        where: { id },
        include: {
          changelogs: { orderBy: { order: 'asc' } },
          tags: true,
          approvals: { orderBy: { createdAt: 'desc' } },
          milestones: { orderBy: { createdAt: 'asc' } },
          project: { select: { id: true, name: true } },
        },
      });

      if (!release) {
        throw new Error(`Release not found: ${id}`);
      }

      return release;
    } finally {
      await prisma.$disconnect();
    }
  }

  async updateRelease(id: string, input: UpdateReleaseInput) {
    const prisma = getPrisma();
    try {
      const existing = await prisma.release.findUnique({ where: { id } });
      if (!existing) {
        throw new Error(`Release not found: ${id}`);
      }

      const data: any = {};
      if (input.title !== undefined) data.title = input.title;
      if (input.description !== undefined) data.description = input.description;
      if (input.status !== undefined) data.status = input.status;
      if (input.channel !== undefined) data.channel = input.channel;
      if (input.releaseNotes !== undefined) data.releaseNotes = input.releaseNotes;
      if (input.metadata !== undefined) data.metadata = JSON.stringify(input.metadata);

      const release = await prisma.release.update({
        where: { id },
        data,
      });

      this.logger.info(`Release updated: ${id}`);
      return release;
    } finally {
      await prisma.$disconnect();
    }
  }

  async deleteRelease(id: string) {
    const prisma = getPrisma();
    try {
      const release = await prisma.release.findUnique({ where: { id } });
      if (!release) {
        throw new Error(`Release not found: ${id}`);
      }

      if (release.status !== 'draft') {
        throw new Error(`Cannot delete release with status "${release.status}". Only draft releases can be deleted.`);
      }

      await prisma.release.delete({ where: { id } });
      this.logger.info(`Release deleted: ${id}`);
      return { success: true, message: `Release ${id} deleted` };
    } finally {
      await prisma.$disconnect();
    }
  }

  async listReleases(filter: ReleaseFilter) {
    const prisma = getPrisma();
    try {
      const where: any = {};
      if (filter.projectId) where.projectId = filter.projectId;
      if (filter.status) where.status = filter.status;
      if (filter.channel) where.channel = filter.channel;
      if (filter.type) where.type = filter.type;
      if (filter.search) {
        where.OR = [
          { title: { contains: filter.search } },
          { version: { contains: filter.search } },
          { description: { contains: filter.search } },
        ];
      }

      const releases = await prisma.release.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filter.limit || 50,
        skip: filter.offset || 0,
        include: {
          _count: { select: { changelogs: true, tags: true, approvals: true } },
        },
      });

      const total = await prisma.release.count({ where });

      return { releases, total };
    } finally {
      await prisma.$disconnect();
    }
  }

  // ================================================================
  // Version Auto-Increment
  // ================================================================

  async getNextVersion(projectId: string, type: 'major' | 'minor' | 'patch'): Promise<string> {
    const prisma = getPrisma();
    try {
      const latestRelease = await prisma.release.findFirst({
        where: { projectId, status: 'published' },
        orderBy: { publishedAt: 'desc' },
      });

      if (!latestRelease) {
        return '1.0.0';
      }

      const parts = latestRelease.version.split('.').map(Number);
      const major = parts[0] || 0;
      const minor = parts[1] || 0;
      const patch = parts[2] || 0;

      switch (type) {
        case 'major':
          return `${major + 1}.0.0`;
        case 'minor':
          return `${major}.${minor + 1}.0`;
        case 'patch':
          return `${major}.${minor}.${patch + 1}`;
        default:
          return `${major}.${minor}.${patch + 1}`;
      }
    } finally {
      await prisma.$disconnect();
    }
  }

  // ================================================================
  // Changelog Management
  // ================================================================

  async addChangelog(releaseId: string, input: AddChangelogInput) {
    const prisma = getPrisma();
    try {
      const release = await prisma.release.findUnique({ where: { id: releaseId } });
      if (!release) {
        throw new Error(`Release not found: ${releaseId}`);
      }

      // Get the current max order
      const maxOrder = await prisma.releaseChangelog.findFirst({
        where: { releaseId },
        orderBy: { order: 'desc' },
        select: { order: true },
      });

      const changelog = await prisma.releaseChangelog.create({
        data: {
          releaseId,
          category: input.category,
          title: input.title,
          description: input.description ?? null,
          impact: input.impact || 'patch',
          metadata: input.metadata ? JSON.stringify(input.metadata) : null,
          order: (maxOrder?.order ?? -1) + 1,
        },
      });

      return changelog;
    } finally {
      await prisma.$disconnect();
    }
  }

  async updateChangelog(id: string, data: Partial<AddChangelogInput>) {
    const prisma = getPrisma();
    try {
      const existing = await prisma.releaseChangelog.findUnique({ where: { id } });
      if (!existing) {
        throw new Error(`Changelog entry not found: ${id}`);
      }

      const updateData: any = {};
      if (data.category !== undefined) updateData.category = data.category;
      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.impact !== undefined) updateData.impact = data.impact;
      if (data.metadata !== undefined) updateData.metadata = data.metadata ? JSON.stringify(data.metadata) : null;

      return await prisma.releaseChangelog.update({
        where: { id },
        data: updateData,
      });
    } finally {
      await prisma.$disconnect();
    }
  }

  async removeChangelog(id: string) {
    const prisma = getPrisma();
    try {
      const existing = await prisma.releaseChangelog.findUnique({ where: { id } });
      if (!existing) {
        throw new Error(`Changelog entry not found: ${id}`);
      }

      await prisma.releaseChangelog.delete({ where: { id } });
      return { success: true, message: `Changelog entry ${id} removed` };
    } finally {
      await prisma.$disconnect();
    }
  }

  async reorderChangelogs(releaseId: string, orderedIds: string[]) {
    const prisma = getPrisma();
    try {
      const release = await prisma.release.findUnique({ where: { id: releaseId } });
      if (!release) {
        throw new Error(`Release not found: ${releaseId}`);
      }

      for (let i = 0; i < orderedIds.length; i++) {
        await prisma.releaseChangelog.update({
          where: { id: orderedIds[i] },
          data: { order: i },
        });
      }

      return { success: true, message: `Reordered ${orderedIds.length} changelog entries` };
    } finally {
      await prisma.$disconnect();
    }
  }

  // ================================================================
  // Tag Management
  // ================================================================

  async addTag(releaseId: string, name: string, color?: string) {
    const prisma = getPrisma();
    try {
      const release = await prisma.release.findUnique({ where: { id: releaseId } });
      if (!release) {
        throw new Error(`Release not found: ${releaseId}`);
      }

      const tag = await prisma.releaseTag.create({
        data: {
          releaseId,
          name,
          color: color || '#6B7280',
        },
      });

      return tag;
    } finally {
      await prisma.$disconnect();
    }
  }

  async removeTag(id: string) {
    const prisma = getPrisma();
    try {
      const existing = await prisma.releaseTag.findUnique({ where: { id } });
      if (!existing) {
        throw new Error(`Tag not found: ${id}`);
      }

      await prisma.releaseTag.delete({ where: { id } });
      return { success: true, message: `Tag ${id} removed` };
    } finally {
      await prisma.$disconnect();
    }
  }

  // ================================================================
  // Release Lifecycle
  // ================================================================

  async submitForReview(releaseId: string) {
    const prisma = getPrisma();
    try {
      const release = await prisma.release.findUnique({ where: { id: releaseId } });
      if (!release) {
        throw new Error(`Release not found: ${releaseId}`);
      }

      if (release.status !== 'draft') {
        throw new Error(`Cannot submit release for review from status "${release.status}". Only draft releases can be submitted.`);
      }

      const updated = await prisma.release.update({
        where: { id: releaseId },
        data: { status: 'review' },
      });

      this.logger.info(`Release ${releaseId} submitted for review`);
      return updated;
    } finally {
      await prisma.$disconnect();
    }
  }

  async approveRelease(releaseId: string, input: ReleaseApprovalInput) {
    const prisma = getPrisma();
    try {
      const release = await prisma.release.findUnique({ where: { id: releaseId } });
      if (!release) {
        throw new Error(`Release not found: ${releaseId}`);
      }

      if (release.status !== 'review') {
        throw new Error(`Cannot approve release with status "${release.status}". Release must be in review status.`);
      }

      // Create approval record
      await prisma.releaseApproval.create({
        data: {
          releaseId,
          approverId: input.approverId ?? null,
          role: input.role || 'reviewer',
          decision: input.decision,
          comment: input.comment ?? null,
          decidedAt: new Date(),
        },
      });

      // If approved, update release status
      if (input.decision === 'approved') {
        // Check if there are any rejections
        const rejections = await prisma.releaseApproval.count({
          where: { releaseId, decision: 'rejected' },
        });

        if (rejections === 0) {
          const updated = await prisma.release.update({
            where: { id: releaseId },
            data: { status: 'approved' },
          });
          this.logger.info(`Release ${releaseId} approved`);
          return updated;
        }
      }

      if (input.decision === 'rejected') {
        const updated = await prisma.release.update({
          where: { id: releaseId },
          data: { status: 'draft' },
        });
        this.logger.info(`Release ${releaseId} rejected, reverted to draft`);
        return updated;
      }

      // For 'skipped' decision, keep in review
      return await prisma.release.findUnique({ where: { id: releaseId } });
    } finally {
      await prisma.$disconnect();
    }
  }

  async rejectRelease(releaseId: string, input: ReleaseApprovalInput) {
    return this.approveRelease(releaseId, { ...input, decision: 'rejected' });
  }

  async publishRelease(releaseId: string) {
    const prisma = getPrisma();
    try {
      const release = await prisma.release.findUnique({
        where: { id: releaseId },
        include: { approvals: true },
      });

      if (!release) {
        throw new Error(`Release not found: ${releaseId}`);
      }

      // Allow hotfix channel to bypass approval
      const canBypassApproval = release.channel === 'hotfix' || release.type === 'hotfix';

      if (!canBypassApproval) {
        if (release.status !== 'approved') {
          throw new Error(`Cannot publish release with status "${release.status}". Release must be approved first.`);
        }

        // Validate at least one approval exists
        const approvals = await prisma.releaseApproval.count({
          where: { releaseId, decision: 'approved' },
        });

        if (approvals === 0) {
          throw new Error(`Release must have at least one approval before publishing.`);
        }
      }

      // For hotfix, allow from draft or approved
      if (canBypassApproval && release.status !== 'draft' && release.status !== 'approved') {
        throw new Error(`Cannot publish release with status "${release.status}".`);
      }

      const updated = await prisma.release.update({
        where: { id: releaseId },
        data: {
          status: 'published',
          publishedAt: new Date(),
        },
      });

      this.logger.info(`Release ${releaseId} published as v${release.version}`);
      return updated;
    } finally {
      await prisma.$disconnect();
    }
  }

  async archiveRelease(releaseId: string) {
    const prisma = getPrisma();
    try {
      const release = await prisma.release.findUnique({ where: { id: releaseId } });
      if (!release) {
        throw new Error(`Release not found: ${releaseId}`);
      }

      const updated = await prisma.release.update({
        where: { id: releaseId },
        data: {
          status: 'archived',
          archivedAt: new Date(),
        },
      });

      this.logger.info(`Release ${releaseId} archived`);
      return updated;
    } finally {
      await prisma.$disconnect();
    }
  }

  async rollbackRelease(releaseId: string) {
    const prisma = getPrisma();
    try {
      const release = await prisma.release.findUnique({ where: { id: releaseId } });
      if (!release) {
        throw new Error(`Release not found: ${releaseId}`);
      }

      if (release.status !== 'published') {
        throw new Error(`Cannot rollback release with status "${release.status}". Only published releases can be rolled back.`);
      }

      const updated = await prisma.release.update({
        where: { id: releaseId },
        data: { status: 'rolled_back' },
      });

      this.logger.info(`Release ${releaseId} rolled back`);
      return updated;
    } finally {
      await prisma.$disconnect();
    }
  }

  // ================================================================
  // Milestone Management
  // ================================================================

  async addMilestone(releaseId: string, input: ReleaseMilestoneInput) {
    const prisma = getPrisma();
    try {
      const release = await prisma.release.findUnique({ where: { id: releaseId } });
      if (!release) {
        throw new Error(`Release not found: ${releaseId}`);
      }

      const milestone = await prisma.releaseMilestone.create({
        data: {
          releaseId,
          name: input.name,
          status: input.status || 'pending',
        },
      });

      return milestone;
    } finally {
      await prisma.$disconnect();
    }
  }

  async updateMilestone(id: string, data: Partial<ReleaseMilestoneInput>) {
    const prisma = getPrisma();
    try {
      const existing = await prisma.releaseMilestone.findUnique({ where: { id } });
      if (!existing) {
        throw new Error(`Milestone not found: ${id}`);
      }

      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.status !== undefined) updateData.status = data.status;

      return await prisma.releaseMilestone.update({
        where: { id },
        data: updateData,
      });
    } finally {
      await prisma.$disconnect();
    }
  }

  async completeMilestone(id: string) {
    const prisma = getPrisma();
    try {
      const existing = await prisma.releaseMilestone.findUnique({ where: { id } });
      if (!existing) {
        throw new Error(`Milestone not found: ${id}`);
      }

      return await prisma.releaseMilestone.update({
        where: { id },
        data: {
          status: 'completed',
          completedAt: new Date(),
        },
      });
    } finally {
      await prisma.$disconnect();
    }
  }

  // ================================================================
  // Version Comparison
  // ================================================================

  async compareVersions(projectId: string, baseVersion: string, targetVersion: string): Promise<VersionCompareResult> {
    const prisma = getPrisma();
    try {
      const baseRelease = await prisma.release.findUnique({
        where: { projectId_version: { projectId, version: baseVersion } },
        include: { changelogs: { orderBy: { order: 'asc' } } },
      });

      const targetRelease = await prisma.release.findUnique({
        where: { projectId_version: { projectId, version: targetVersion } },
        include: { changelogs: { orderBy: { order: 'asc' } } },
      });

      if (!baseRelease) {
        throw new Error(`Base version "${baseVersion}" not found for this project`);
      }
      if (!targetRelease) {
        throw new Error(`Target version "${targetVersion}" not found for this project`);
      }

      const baseChangelogs = baseRelease.changelogs;
      const targetChangelogs = targetRelease.changelogs;

      // Identify new entries (in target but not in base)
      const baseKeys = new Set(baseChangelogs.map(cl => `${cl.category}:${cl.title}`));
      const targetKeys = new Set(targetChangelogs.map(cl => `${cl.category}:${cl.title}`));

      const newEntries = targetChangelogs.filter(cl => !baseKeys.has(`${cl.category}:${cl.title}`));
      const removedEntries = baseChangelogs.filter(cl => !targetKeys.has(`${cl.category}:${cl.title}`));

      // Generate summary
      const categoryCounts: Record<string, number> = {};
      for (const entry of newEntries) {
        categoryCounts[entry.category] = (categoryCounts[entry.category] || 0) + 1;
      }

      const summaryParts: string[] = [];
      for (const [category, count] of Object.entries(categoryCounts)) {
        summaryParts.push(`${count} ${category}`);
      }

      const summary = newEntries.length > 0
        ? `v${baseVersion} -> v${targetVersion}: ${newEntries.length} changes (${summaryParts.join(', ')})`
        : `v${baseVersion} -> v${targetVersion}: No changes`;

      return {
        base: {
          version: baseRelease.version,
          releaseDate: baseRelease.publishedAt?.toISOString(),
        },
        target: {
          version: targetRelease.version,
          releaseDate: targetRelease.publishedAt?.toISOString(),
        },
        changelogs: {
          base: baseChangelogs,
          target: targetChangelogs,
        },
        newEntries,
        removedEntries,
        summary,
      };
    } finally {
      await prisma.$disconnect();
    }
  }

  // ================================================================
  // Changelog Generation
  // ================================================================

  async generateChangelog(projectId: string, fromVersion?: string, toVersion?: string) {
    const prisma = getPrisma();
    try {
      let startDate: Date | undefined;
      let endDate: Date | undefined;

      if (fromVersion) {
        const fromRelease = await prisma.release.findUnique({
          where: { projectId_version: { projectId, version: fromVersion } },
        });
        if (fromRelease?.publishedAt) {
          startDate = fromRelease.publishedAt;
        }
      }

      if (toVersion) {
        const toRelease = await prisma.release.findUnique({
          where: { projectId_version: { projectId, version: toVersion } },
        });
        if (toRelease?.publishedAt) {
          endDate = toRelease.publishedAt;
        }
      }

      // Query activity logs for the project
      const where: any = { projectId };
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = startDate;
        if (endDate) where.createdAt.lte = endDate;
      }

      const activities = await prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        take: 200,
      });

      // Categorize activities into changelog entries
      const categoryMap: Record<string, string> = {
        task_created: 'added',
        task_updated: 'changed',
        task_completed: 'changed',
        phase_changed: 'changed',
        project_created: 'added',
        code_committed: 'changed',
        requirement_added: 'added',
        architecture_chosen: 'added',
        test_passed: 'fixed',
        test_failed: 'fixed',
        deploy_started: 'added',
        deploy_completed: 'changed',
        file_created: 'added',
        file_modified: 'changed',
        error_occurred: 'fixed',
        note_added: 'docs',
      };

      const changelogs: any[] = [];
      const seen = new Set<string>();

      for (const activity of activities) {
        const category = categoryMap[activity.action] || 'chore';
        const key = `${category}:${activity.title}`;
        if (seen.has(key)) continue;
        seen.add(key);

        changelogs.push({
          category,
          title: activity.title,
          description: activity.details || null,
          impact: 'patch' as const,
          sourceAction: activity.action,
          createdAt: activity.createdAt,
        });
      }

      return {
        fromVersion: fromVersion || null,
        toVersion: toVersion || null,
        startDate: startDate?.toISOString() || null,
        endDate: endDate?.toISOString() || null,
        totalActivities: activities.length,
        changelogs,
        summary: `Generated ${changelogs.length} changelog entries from ${activities.length} activities`,
      };
    } finally {
      await prisma.$disconnect();
    }
  }

  // ================================================================
  // Release Statistics
  // ================================================================

  async getReleaseStats(projectId: string) {
    const prisma = getPrisma();
    try {
      const releases = await prisma.release.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
      });

      const total = releases.length;
      const byStatus: Record<string, number> = {};
      const byChannel: Record<string, number> = {};
      const byType: Record<string, number> = {};

      for (const r of releases) {
        byStatus[r.status] = (byStatus[r.status] || 0) + 1;
        byChannel[r.channel] = (byChannel[r.channel] || 0) + 1;
        byType[r.type] = (byType[r.type] || 0) + 1;
      }

      // Latest published version
      const latestPublished = releases.find(r => r.status === 'published');

      // Changelog counts
      const changelogCounts = await prisma.releaseChangelog.groupBy({
        by: ['category'],
        where: { release: { projectId } },
        _count: { id: true },
      });

      const changelogByCategory: Record<string, number> = {};
      for (const cc of changelogCounts) {
        changelogByCategory[cc.category] = cc._count.id;
      }

      return {
        total,
        byStatus,
        byChannel,
        byType,
        latestVersion: latestPublished?.version || null,
        latestPublishedAt: latestPublished?.publishedAt?.toISOString() || null,
        changelogByCategory,
      };
    } finally {
      await prisma.$disconnect();
    }
  }

  // ================================================================
  // Bulk Operations
  // ================================================================

  async bulkUpdateStatus(releaseIds: string[], status: string) {
    const prisma = getPrisma();
    try {
      const result = await prisma.release.updateMany({
        where: { id: { in: releaseIds } },
        data: { status },
      });

      this.logger.info(`Bulk updated ${result.count} releases to status "${status}"`);
      return { success: true, updated: result.count };
    } finally {
      await prisma.$disconnect();
    }
  }
}
