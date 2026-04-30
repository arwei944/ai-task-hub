// ============================================================
// Requirements MCP Tool Handlers
// ============================================================

import type { ILogger } from '@/lib/core/types';
import type { RequirementsService } from '@/lib/modules/requirements/requirements.service';
import { analyzeRequirement } from '@/lib/modules/requirements/ai-analyzer';

export function createRequirementToolHandlers(service: RequirementsService, logger: ILogger) {
  return {
    create_requirement: async (args: Record<string, unknown>) => {
      const { projectId, title, description, type, priority, complexity, acceptance, source, parentReqId, createdBy, tags } = args as any;
      const result = await service.createRequirement({
        projectId,
        title,
        description,
        type,
        priority,
        complexity,
        acceptance,
        source,
        parentReqId,
        createdBy,
        tags,
      });
      return { success: true, ...result };
    },

    get_requirement: async (args: Record<string, unknown>) => {
      const { id } = args as any;
      return service.getRequirement(id);
    },

    update_requirement: async (args: Record<string, unknown>) => {
      const { id, ...updates } = args as any;
      return service.updateRequirement(id, updates);
    },

    delete_requirement: async (args: Record<string, unknown>) => {
      const { id } = args as any;
      return service.deleteRequirement(id);
    },

    list_requirements: async (args: Record<string, unknown>) => {
      const { projectId, status, type, complexity, parentReqId, search, limit, offset } = args as any;
      return service.listRequirements({ projectId, status, type, complexity, parentReqId, search, limit, offset });
    },

    update_requirement_status: async (args: Record<string, unknown>) => {
      const { id, status } = args as any;
      return service.updateStatus(id, status);
    },

    add_requirement_tag: async (args: Record<string, unknown>) => {
      const { requirementId, tagName } = args as any;
      return service.addTag(requirementId, tagName);
    },

    remove_requirement_tag: async (args: Record<string, unknown>) => {
      const { requirementId, tagName } = args as any;
      return service.removeTag(requirementId, tagName);
    },

    decompose_requirement: async (args: Record<string, unknown>) => {
      const { id, subRequirements } = args as any;
      return service.decomposeRequirement(id, subRequirements);
    },

    map_requirement_to_task: async (args: Record<string, unknown>) => {
      const { requirementId, title, description, priority, assignee, createdBy } = args as any;
      return service.mapToTask(requirementId, { title, description, priority, assignee, createdBy });
    },

    analyze_requirement: async (args: Record<string, unknown>) => {
      const { title, description, type, complexity, priority } = args as any;
      return analyzeRequirement({ title, description, type, complexity, priority });
    },

    get_requirement_stats: async (args: Record<string, unknown>) => {
      const { projectId } = args as any;
      return service.getRequirementStats(projectId);
    },
  };
}
