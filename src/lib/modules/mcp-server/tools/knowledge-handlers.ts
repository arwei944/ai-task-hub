// ============================================================
// Knowledge Management MCP Tool Handlers
// ============================================================

import type { ILogger } from '@/lib/core/types';
import type { KnowledgeService } from '@/lib/modules/knowledge/knowledge.service';
import { extractFromProjectCompletion } from '@/lib/modules/knowledge/ai-extractor';
import { getPrisma } from '@/lib/db';

export function createKnowledgeToolHandlers(service: KnowledgeService, logger: ILogger) {
  return {
    create_knowledge_entry: async (args: Record<string, unknown>) => {
      const { projectId, type, title, content, tags, sourceEvent, aiGenerated, agentId } = args as any;
      const result = await service.createEntry({
        projectId,
        type: type || 'lesson_learned',
        title,
        content,
        tags,
        sourceEvent,
        aiGenerated,
        createdBy: agentId,
      });
      return { success: true, ...result };
    },

    get_knowledge_entry: async (args: Record<string, unknown>) => {
      const { id } = args as any;
      return service.getEntry(id);
    },

    update_knowledge_entry: async (args: Record<string, unknown>) => {
      const { id, ...updates } = args as any;
      return service.updateEntry(id, updates);
    },

    delete_knowledge_entry: async (args: Record<string, unknown>) => {
      const { id } = args as any;
      return service.deleteEntry(id);
    },

    list_knowledge_entries: async (args: Record<string, unknown>) => {
      const { projectId, type, tags, aiGenerated, search, limit } = args as any;
      return service.listEntries({ projectId, type, tags, aiGenerated, search, limit });
    },

    search_knowledge: async (args: Record<string, unknown>) => {
      const { query } = args as any;
      return service.searchEntries(query);
    },

    increment_usefulness: async (args: Record<string, unknown>) => {
      const { id } = args as any;
      return service.incrementUsefulness(id);
    },

    get_knowledge_stats: async (args: Record<string, unknown>) => {
      const { projectId } = args as any;
      return service.getStats(projectId);
    },

    extract_knowledge: async (args: Record<string, unknown>) => {
      const { projectId } = args as any;
      const prisma = getPrisma();
      try {
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          include: {
            _count: {
              select: {
                tasks: true,
                phaseTransitions: true,
              },
            },
          },
        });

        if (!project) {
          throw new Error(`Project not found: ${projectId}`);
        }

        const extracted = extractFromProjectCompletion({
          id: project.id,
          name: project.name,
          description: project.description,
          phase: project.phase,
          techStack: project.techStack,
          startedAt: project.startedAt,
          completedAt: project.completedAt,
          _count: project._count,
        });

        // Create all extracted entries
        const created = [];
        for (const entry of extracted) {
          const result = await service.createEntry(entry);
          created.push(result);
        }

        return {
          success: true,
          extracted: created.length,
          entries: created,
        };
      } finally {
        await prisma.$disconnect();
      }
    },
  };
}
