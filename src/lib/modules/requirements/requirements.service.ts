// ============================================================
// Requirements Service - Core service for requirement management
// ============================================================

import { getPrisma } from '@/lib/db';
import type { ILogger, IEventBus, DomainEvent } from '@/lib/core/types';
import type {
  CreateRequirementInput,
  UpdateRequirementInput,
  RequirementFilter,
} from './types';

export class RequirementsService {
  constructor(
    private logger: ILogger,
    private eventBus?: IEventBus,
    private prismaFn: () => ReturnType<typeof getPrisma> = getPrisma,
  ) {}

  // ================================================================
  // CRUD
  // ================================================================

  async createRequirement(input: CreateRequirementInput) {
    const prisma = this.prismaFn();
    try {
      const {
        projectId, title, description, type, priority,
        complexity, acceptance, source, parentReqId, createdBy, tags,
      } = input;

      // Verify project exists
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project) {
        throw new Error(`Project not found: ${projectId}`);
      }

      // Verify parent requirement if provided
      if (parentReqId) {
        const parent = await prisma.requirement.findUnique({ where: { id: parentReqId } });
        if (!parent) {
          throw new Error(`Parent requirement not found: ${parentReqId}`);
        }
      }

      const requirement = await prisma.requirement.create({
        data: {
          projectId,
          title,
          description,
          type: type || 'feature',
          priority: priority ?? 0,
          complexity: complexity ?? null,
          acceptance: acceptance ?? null,
          source: source ?? null,
          parentReqId: parentReqId ?? null,
          createdBy: createdBy ?? null,
        },
        include: {
          tags: true,
          _count: { select: { children: true } },
        },
      });

      // Create tags if provided
      if (tags && tags.length > 0) {
        for (const tagName of tags) {
          await prisma.requirementTag.create({
            data: {
              requirementId: requirement.id,
              name: tagName,
            },
          });
        }
        // Re-fetch with tags
        const withTags = await this.getRequirement(requirement.id);
        this.logger.info(`Requirement created: ${requirement.id} - ${title}`);

        this.emitEvent('requirement.created', {
          requirementId: requirement.id,
          projectId,
          title,
          type: type || 'feature',
          createdBy,
        });

        return withTags;
      }

      this.logger.info(`Requirement created: ${requirement.id} - ${title}`);

      this.emitEvent('requirement.created', {
        requirementId: requirement.id,
        projectId,
        title,
        type: type || 'feature',
        createdBy,
      });

      return requirement;
    } finally {
      await prisma.$disconnect();
    }
  }

  async getRequirement(id: string) {
    const prisma = this.prismaFn();
    try {
      const requirement = await prisma.requirement.findUnique({
        where: { id },
        include: {
          tags: true,
          _count: { select: { children: true } },
          project: { select: { id: true, name: true } },
        },
      });

      if (!requirement) {
        throw new Error(`Requirement not found: ${id}`);
      }

      return requirement;
    } finally {
      await prisma.$disconnect();
    }
  }

  async updateRequirement(id: string, input: UpdateRequirementInput) {
    const prisma = this.prismaFn();
    try {
      const existing = await prisma.requirement.findUnique({ where: { id } });
      if (!existing) {
        throw new Error(`Requirement not found: ${id}`);
      }

      const data: any = {};
      if (input.title !== undefined) data.title = input.title;
      if (input.description !== undefined) data.description = input.description;
      if (input.type !== undefined) data.type = input.type;
      if (input.priority !== undefined) data.priority = input.priority;
      if (input.status !== undefined) data.status = input.status;
      if (input.complexity !== undefined) data.complexity = input.complexity;
      if (input.acceptance !== undefined) data.acceptance = input.acceptance;
      if (input.source !== undefined) data.source = input.source;
      if (input.parentReqId !== undefined) data.parentReqId = input.parentReqId;

      const requirement = await prisma.requirement.update({
        where: { id },
        data,
        include: {
          tags: true,
          _count: { select: { children: true } },
        },
      });

      this.logger.info(`Requirement updated: ${id}`);
      return requirement;
    } finally {
      await prisma.$disconnect();
    }
  }

  async deleteRequirement(id: string) {
    const prisma = this.prismaFn();
    try {
      const existing = await prisma.requirement.findUnique({ where: { id } });
      if (!existing) {
        throw new Error(`Requirement not found: ${id}`);
      }

      // Soft delete: set status to 'rejected'
      const requirement = await prisma.requirement.update({
        where: { id },
        data: { status: 'rejected' },
      });

      this.logger.info(`Requirement soft-deleted (rejected): ${id}`);
      return { success: true, message: `Requirement ${id} marked as rejected` };
    } finally {
      await prisma.$disconnect();
    }
  }

  async listRequirements(filter: RequirementFilter) {
    const prisma = this.prismaFn();
    try {
      const where: any = {};
      if (filter.projectId) where.projectId = filter.projectId;
      if (filter.status) where.status = filter.status;
      if (filter.type) where.type = filter.type;
      if (filter.complexity) where.complexity = filter.complexity;
      if (filter.parentReqId !== undefined) where.parentReqId = filter.parentReqId;
      if (filter.search) {
        where.OR = [
          { title: { contains: filter.search } },
          { description: { contains: filter.search } },
        ];
      }

      const requirements = await prisma.requirement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filter.limit || 50,
        skip: filter.offset || 0,
        include: {
          tags: true,
          _count: { select: { children: true } },
        },
      });

      const total = await prisma.requirement.count({ where });

      return { requirements, total };
    } finally {
      await prisma.$disconnect();
    }
  }

  // ================================================================
  // Status Management
  // ================================================================

  async updateStatus(id: string, status: string) {
    const prisma = this.prismaFn();
    try {
      const existing = await prisma.requirement.findUnique({ where: { id } });
      if (!existing) {
        throw new Error(`Requirement not found: ${id}`);
      }

      const previousStatus = existing.status;

      const requirement = await prisma.requirement.update({
        where: { id },
        data: { status },
        include: {
          tags: true,
          _count: { select: { children: true } },
        },
      });

      this.logger.info(`Requirement ${id} status changed: ${previousStatus} -> ${status}`);

      this.emitEvent('requirement.status.changed', {
        requirementId: id,
        projectId: existing.projectId,
        status,
        previousStatus,
      });

      return requirement;
    } finally {
      await prisma.$disconnect();
    }
  }

  // ================================================================
  // Tag Management
  // ================================================================

  async addTag(requirementId: string, tagName: string) {
    const prisma = this.prismaFn();
    try {
      const requirement = await prisma.requirement.findUnique({ where: { id: requirementId } });
      if (!requirement) {
        throw new Error(`Requirement not found: ${requirementId}`);
      }

      const tag = await prisma.requirementTag.create({
        data: {
          requirementId,
          name: tagName,
        },
      });

      return tag;
    } finally {
      await prisma.$disconnect();
    }
  }

  async removeTag(requirementId: string, tagName: string) {
    const prisma = this.prismaFn();
    try {
      const tag = await prisma.requirementTag.findUnique({
        where: {
          requirementId_name: { requirementId, name: tagName },
        },
      });

      if (!tag) {
        throw new Error(`Tag "${tagName}" not found on requirement ${requirementId}`);
      }

      await prisma.requirementTag.delete({
        where: {
          requirementId_name: { requirementId, name: tagName },
        },
      });

      return { success: true, message: `Tag "${tagName}" removed from requirement ${requirementId}` };
    } finally {
      await prisma.$disconnect();
    }
  }

  // ================================================================
  // Decomposition
  // ================================================================

  async decomposeRequirement(id: string, subRequirements: CreateRequirementInput[]) {
    const prisma = this.prismaFn();
    try {
      const parent = await prisma.requirement.findUnique({ where: { id } });
      if (!parent) {
        throw new Error(`Requirement not found: ${id}`);
      }

      const created: any[] = [];
      for (const sub of subRequirements) {
        const subReq = await prisma.requirement.create({
          data: {
            projectId: sub.projectId || parent.projectId,
            title: sub.title,
            description: sub.description,
            type: sub.type || 'feature',
            priority: sub.priority ?? 0,
            complexity: sub.complexity ?? null,
            acceptance: sub.acceptance ?? null,
            source: sub.source ?? null,
            parentReqId: id,
            createdBy: sub.createdBy ?? parent.createdBy,
          },
          include: {
            tags: true,
            _count: { select: { children: true } },
          },
        });

        // Create tags if provided
        if (sub.tags && sub.tags.length > 0) {
          for (const tagName of sub.tags) {
            await prisma.requirementTag.create({
              data: {
                requirementId: subReq.id,
                name: tagName,
              },
            });
          }
        }

        created.push(subReq);
      }

      this.logger.info(`Requirement ${id} decomposed into ${created.length} sub-requirements`);
      return created;
    } finally {
      await prisma.$disconnect();
    }
  }

  // ================================================================
  // Task Mapping
  // ================================================================

  async mapToTask(requirementId: string, taskData: {
    title?: string;
    description?: string;
    priority?: string;
    assignee?: string;
    createdBy?: string;
  }) {
    const prisma = this.prismaFn();
    try {
      const requirement = await prisma.requirement.findUnique({
        where: { id: requirementId },
      });

      if (!requirement) {
        throw new Error(`Requirement not found: ${requirementId}`);
      }

      // Map priority from requirement (int) to task (string)
      const priorityMap: Record<number, string> = {
        5: 'urgent',
        4: 'high',
        3: 'medium',
        2: 'low',
        1: 'low',
        0: 'medium',
      };

      const task = await prisma.task.create({
        data: {
          title: taskData.title || requirement.title,
          description: taskData.description || requirement.description,
          status: 'todo',
          priority: taskData.priority || priorityMap[requirement.priority] || 'medium',
          projectId: requirement.projectId,
          assignee: taskData.assignee ?? null,
          creator: taskData.createdBy ?? requirement.createdBy ?? null,
          source: 'requirement',
          phase: 'requirements',
        },
      });

      // Update requirement status to 'implemented'
      await prisma.requirement.update({
        where: { id: requirementId },
        data: { status: 'implemented' },
      });

      this.logger.info(`Requirement ${requirementId} mapped to task ${task.id}`);

      this.emitEvent('requirement.mapped.to.task', {
        requirementId,
        taskId: task.id,
        projectId: requirement.projectId,
        title: task.title,
      });

      return task;
    } finally {
      await prisma.$disconnect();
    }
  }

  // ================================================================
  // Statistics
  // ================================================================

  async getRequirementStats(projectId: string) {
    const prisma = this.prismaFn();
    try {
      const requirements = await prisma.requirement.findMany({
        where: { projectId },
      });

      const total = requirements.length;
      const byStatus: Record<string, number> = {};
      const byType: Record<string, number> = {};
      const byComplexity: Record<string, number> = {};

      for (const r of requirements) {
        byStatus[r.status] = (byStatus[r.status] || 0) + 1;
        byType[r.type] = (byType[r.type] || 0) + 1;
        if (r.complexity) {
          byComplexity[r.complexity] = (byComplexity[r.complexity] || 0) + 1;
        }
      }

      // Count root requirements (no parent)
      const rootCount = requirements.filter((r: any) => !r.parentReqId).length;

      return {
        total,
        rootCount,
        byStatus,
        byType,
        byComplexity,
      };
    } finally {
      await prisma.$disconnect();
    }
  }

  // ================================================================
  // Private Helpers
  // ================================================================

  private emitEvent(type: string, payload: unknown): void {
    if (!this.eventBus) return;
    const event: DomainEvent = {
      type,
      payload,
      timestamp: new Date(),
      source: 'requirements',
    };
    this.eventBus.emit(event);
  }
}
