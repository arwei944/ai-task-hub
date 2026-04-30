// ============================================================
// Knowledge Service - CRUD, search, stats for knowledge entries
// ============================================================

import { getPrisma } from '@/lib/db';
import type { ILogger, IEventBus, DomainEvent } from '@/lib/core/types';
import type { PrismaClient } from '@/generated/prisma/client';
import type {
  CreateKnowledgeInput,
  UpdateKnowledgeInput,
  KnowledgeFilter,
} from './types';

export class KnowledgeService {
  constructor(
    private logger: ILogger,
    private eventBus?: IEventBus,
    private prismaFn?: () => PrismaClient,
  ) {}

  private getPrismaClient(): PrismaClient {
    return this.prismaFn ? this.prismaFn() : getPrisma();
  }

  // ================================================================
  // CRUD Operations
  // ================================================================

  async createEntry(input: CreateKnowledgeInput) {
    const prisma = this.getPrismaClient();
    try {
      const entry = await prisma.knowledgeEntry.create({
        data: {
          projectId: input.projectId ?? null,
          type: input.type,
          title: input.title,
          content: input.content,
          tags: JSON.stringify(input.tags ?? []),
          sourceEvent: input.sourceEvent ?? null,
          aiGenerated: input.aiGenerated ?? false,
          createdBy: input.createdBy ?? null,
        },
      });

      this.logger.info(`Knowledge entry created: ${entry.id} - ${entry.title}`);

      this.emitEvent('knowledge.created', {
        entryId: entry.id,
        projectId: entry.projectId,
        type: entry.type,
        title: entry.title,
      });

      return entry;
    } finally {
      if (!this.prismaFn) await prisma.$disconnect();
    }
  }

  async getEntry(id: string) {
    const prisma = this.getPrismaClient();
    try {
      const entry = await prisma.knowledgeEntry.findUnique({
        where: { id },
        include: {
          project: { select: { id: true, name: true } },
        },
      });

      if (!entry) {
        throw new Error(`Knowledge entry not found: ${id}`);
      }

      return entry;
    } finally {
      if (!this.prismaFn) await prisma.$disconnect();
    }
  }

  async updateEntry(id: string, input: UpdateKnowledgeInput) {
    const prisma = this.getPrismaClient();
    try {
      const existing = await prisma.knowledgeEntry.findUnique({ where: { id } });
      if (!existing) {
        throw new Error(`Knowledge entry not found: ${id}`);
      }

      const data: Record<string, unknown> = {};
      if (input.title !== undefined) data.title = input.title;
      if (input.content !== undefined) data.content = input.content;
      if (input.tags !== undefined) data.tags = JSON.stringify(input.tags);
      if (input.type !== undefined) data.type = input.type;

      const entry = await prisma.knowledgeEntry.update({
        where: { id },
        data,
      });

      this.logger.info(`Knowledge entry updated: ${id}`);
      return entry;
    } finally {
      if (!this.prismaFn) await prisma.$disconnect();
    }
  }

  async deleteEntry(id: string) {
    const prisma = this.getPrismaClient();
    try {
      const existing = await prisma.knowledgeEntry.findUnique({ where: { id } });
      if (!existing) {
        throw new Error(`Knowledge entry not found: ${id}`);
      }

      await prisma.knowledgeEntry.delete({ where: { id } });

      this.logger.info(`Knowledge entry deleted: ${id}`);

      this.emitEvent('knowledge.deleted', {
        entryId: id,
        projectId: existing.projectId,
      });

      return { success: true, message: `Knowledge entry ${id} deleted` };
    } finally {
      if (!this.prismaFn) await prisma.$disconnect();
    }
  }

  async listEntries(filter: KnowledgeFilter) {
    const prisma = this.getPrismaClient();
    try {
      const where: Record<string, unknown> = {};

      if (filter.projectId) where.projectId = filter.projectId;
      if (filter.type) where.type = filter.type;
      if (filter.aiGenerated !== undefined) where.aiGenerated = filter.aiGenerated;

      if (filter.search) {
        where.OR = [
          { title: { contains: filter.search } },
          { content: { contains: filter.search } },
        ];
      }

      if (filter.tags && filter.tags.length > 0) {
        // SQLite: tags is a JSON string, use contains for each tag
        const tagConditions = filter.tags.map(tag => ({
          tags: { contains: tag },
        }));
        if (where.OR) {
          // Combine with existing OR conditions
          where.AND = [
            { OR: where.OR as object[] },
            ...tagConditions,
          ];
          delete where.OR;
        } else {
          where.OR = tagConditions;
        }
      }

      const entries = await prisma.knowledgeEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filter.limit || 50,
        skip: filter.offset || 0,
      });

      const total = await prisma.knowledgeEntry.count({ where });

      return { entries, total };
    } finally {
      if (!this.prismaFn) await prisma.$disconnect();
    }
  }

  // ================================================================
  // Search
  // ================================================================

  async searchEntries(query: string) {
    const prisma = this.getPrismaClient();
    try {
      const entries = await prisma.knowledgeEntry.findMany({
        where: {
          OR: [
            { title: { contains: query } },
            { content: { contains: query } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });

      return entries;
    } finally {
      if (!this.prismaFn) await prisma.$disconnect();
    }
  }

  // ================================================================
  // Usefulness
  // ================================================================

  async incrementUsefulness(id: string) {
    const prisma = this.getPrismaClient();
    try {
      const existing = await prisma.knowledgeEntry.findUnique({ where: { id } });
      if (!existing) {
        throw new Error(`Knowledge entry not found: ${id}`);
      }

      const entry = await prisma.knowledgeEntry.update({
        where: { id },
        data: { usefulness: { increment: 1 } },
      });

      this.logger.info(`Knowledge entry usefulness incremented: ${id} -> ${entry.usefulness}`);
      return entry;
    } finally {
      if (!this.prismaFn) await prisma.$disconnect();
    }
  }

  // ================================================================
  // Project Knowledge
  // ================================================================

  async getProjectKnowledge(projectId: string) {
    const prisma = this.getPrismaClient();
    try {
      const entries = await prisma.knowledgeEntry.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
      });

      return entries;
    } finally {
      if (!this.prismaFn) await prisma.$disconnect();
    }
  }

  // ================================================================
  // Statistics
  // ================================================================

  async getStats(projectId?: string) {
    const prisma = this.getPrismaClient();
    try {
      const where: Record<string, unknown> = {};
      if (projectId) where.projectId = projectId;

      const entries = await prisma.knowledgeEntry.findMany({
        where,
      });

      const total = entries.length;
      const byType: Record<string, number> = {};
      const byAiGenerated: Record<string, number> = { true: 0, false: 0 };
      let totalUsefulness = 0;

      for (const entry of entries) {
        byType[entry.type] = (byType[entry.type] || 0) + 1;
        byAiGenerated[entry.aiGenerated ? 'true' : 'false']++;
        totalUsefulness += entry.usefulness;
      }

      // Count unique tags
      const allTags = new Set<string>();
      for (const entry of entries) {
        try {
          const tags: string[] = JSON.parse(entry.tags);
          for (const tag of tags) {
            allTags.add(tag);
          }
        } catch {
          // ignore invalid JSON
        }
      }

      return {
        total,
        byType,
        byAiGenerated,
        totalUsefulness,
        avgUsefulness: total > 0 ? Math.round((totalUsefulness / total) * 100) / 100 : 0,
        uniqueTags: allTags.size,
      };
    } finally {
      if (!this.prismaFn) await prisma.$disconnect();
    }
  }

  // ================================================================
  // Event Emission
  // ================================================================

  private emitEvent(type: string, payload: unknown): void {
    if (!this.eventBus) return;
    const event: DomainEvent = {
      type,
      payload,
      timestamp: new Date(),
      source: 'knowledge',
    };
    this.eventBus.emit(event);
  }
}
