// ============================================================
// Version Management MCP Tool Handlers
// ============================================================

import type { ILogger } from '@/lib/core/types';
import type { VersionMgmtService } from '@/lib/modules/version-mgmt/version-mgmt.service';

export function createVersionToolHandlers(service: VersionMgmtService, logger: ILogger) {
  return {
    create_release: async (args: Record<string, unknown>) => {
      const { projectId, version, title, description, channel, type, releaseNotes, changelogs, tags, agentId } = args as any;
      const result = await service.createRelease({
        projectId,
        version,
        title,
        description,
        channel,
        type,
        releaseNotes,
        changelogs,
        tags,
        createdBy: agentId,
      });
      return { success: true, ...result };
    },

    get_release: async (args: Record<string, unknown>) => {
      const { id } = args as any;
      return service.getRelease(id);
    },

    list_releases: async (args: Record<string, unknown>) => {
      const { projectId, status, channel, type, limit } = args as any;
      return service.listReleases({ projectId, status, channel, type, limit });
    },

    update_release: async (args: Record<string, unknown>) => {
      const { id, ...updates } = args as any;
      return service.updateRelease(id, updates);
    },

    delete_release: async (args: Record<string, unknown>) => {
      const { id } = args as any;
      return service.deleteRelease(id);
    },

    publish_release: async (args: Record<string, unknown>) => {
      const { id, agentId } = args as any;
      return service.publishRelease(id);
    },

    add_changelog: async (args: Record<string, unknown>) => {
      const { releaseId, category, title, description, impact } = args as any;
      return service.addChangelog(releaseId, { category, title, description, impact });
    },

    compare_versions: async (args: Record<string, unknown>) => {
      const { projectId, baseVersion, targetVersion } = args as any;
      return service.compareVersions(projectId, baseVersion, targetVersion);
    },

    get_next_version: async (args: Record<string, unknown>) => {
      const { projectId, type } = args as any;
      return service.getNextVersion(projectId, type);
    },

    get_release_stats: async (args: Record<string, unknown>) => {
      const { projectId } = args as any;
      return service.getReleaseStats(projectId);
    },

    submit_for_review: async (args: Record<string, unknown>) => {
      const { id } = args as any;
      return service.submitForReview(id);
    },

    approve_release: async (args: Record<string, unknown>) => {
      const { id, decision, comment, agentId } = args as any;
      return service.approveRelease(id, { decision, comment, approverId: agentId });
    },

    rollback_release: async (args: Record<string, unknown>) => {
      const { id, reason, agentId } = args as any;
      return service.rollbackRelease(id);
    },

    generate_changelog: async (args: Record<string, unknown>) => {
      const { projectId, fromVersion, toVersion } = args as any;
      return service.generateChangelog(projectId, fromVersion, toVersion);
    },
  };
}
