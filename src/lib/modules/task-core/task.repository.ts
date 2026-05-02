import { PrismaClient } from '@/generated/prisma/client';
import type { CreateTaskDTO, UpdateTaskDTO, TaskQuery, PaginatedResult, TaskWithRelations } from './types';

export class TaskRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string) {
    return this.prisma.task.findUnique({
      where: { id },
      include: {
        tags: { include: { tag: true } },
        dependencies: { include: { dependsOn: { select: { id: true, title: true, status: true } } } },
        dependents: { include: { task: { select: { id: true, title: true, status: true } } } },
        _count: { select: { subTasks: true, dependencies: true, dependents: true, history: true } },
      },
    }) as Promise<TaskWithRelations | null>;
  }

  async findMany(query: TaskQuery): Promise<PaginatedResult<TaskWithRelations>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: any = {};

    if (query.status?.length) where.status = { in: query.status };
    if (query.priority?.length) where.priority = { in: query.priority };
    if (query.type) where.type = query.type;
    if (query.creator) where.creator = query.creator;
    if (query.assignee) where.assignee = query.assignee;
    if (query.parentTaskId !== undefined) where.parentTaskId = query.parentTaskId;
    if (query.tags?.length) {
      where.tags = {
        some: { tagId: { in: query.tags } },
      };
    }
    if (query.search) {
      where.OR = [
        { title: { contains: query.search } },
        { description: { contains: query.search } },
      ];
    }
    if (query.dueBefore || query.dueAfter) {
      where.dueDate = {};
      if (query.dueBefore) where.dueDate.lte = query.dueBefore;
      if (query.dueAfter) where.dueDate.gte = query.dueAfter;
    }
    // Exclude deleted tasks by default
    if (query.status?.includes('deleted' as any)) {
      // User explicitly wants deleted tasks, keep status filter as-is
    } else if (where.status && where.status.in) {
      // Status filter already set (e.g. { in: ['in_progress'] }), add deleted exclusion
      where.status = { ...where.status, notIn: ['deleted'] };
    } else {
      // No status filter, exclude deleted by default
      where.status = { not: 'deleted' };
    }

    const orderBy: any = {};
    const sortField = query.sortBy ?? 'updatedAt';
    const sortOrder = query.sortOrder ?? 'desc';
    orderBy[sortField] = sortOrder;

    const [items, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          tags: { include: { tag: true } },
          _count: { select: { subTasks: true, dependencies: true, dependents: true, history: true } },
        },
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      items: items as TaskWithRelations[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async create(data: CreateTaskDTO, creator?: string) {
    const { tags, metadata, ...taskData } = data;

    return this.prisma.task.create({
      data: {
        ...taskData,
        creator: creator ?? data.creator,
        metadata: metadata ? JSON.stringify(metadata) : null,
        tags: tags?.length
          ? {
              create: tags.map((tagId) => ({
                tag: { connectOrCreate: { where: { id: tagId }, create: { id: tagId, name: tagId } } },
              })),
            }
          : undefined,
      },
      include: {
        tags: { include: { tag: true } },
        _count: { select: { subTasks: true, dependencies: true, dependents: true, history: true } },
      },
    }) as Promise<TaskWithRelations>;
  }

  async update(id: string, data: UpdateTaskDTO) {
    const { tags, metadata, status, ...updateData } = data;
    const extraData: Record<string, unknown> = updateData;

    // Handle status-specific timestamps
    if (status === 'in_progress' && !extraData.startedAt) {
      extraData.startedAt = new Date();
    }
    if (status === 'done' && !extraData.completedAt) {
      extraData.completedAt = new Date();
    }
    if (status === 'todo') {
      extraData.startedAt = null;
      extraData.completedAt = null;
    }

    return this.prisma.task.update({
      where: { id },
      data: {
        ...extraData,
        status,
        metadata: metadata ? JSON.stringify(metadata) : undefined,
        tags: tags
          ? {
              deleteMany: {},
              create: tags.map((tagId) => ({
                tag: { connectOrCreate: { where: { id: tagId }, create: { id: tagId, name: tagId } } },
              })),
            }
          : undefined,
      },
      include: {
        tags: { include: { tag: true } },
        dependencies: { include: { dependsOn: { select: { id: true, title: true, status: true } } } },
        dependents: { include: { task: { select: { id: true, title: true, status: true } } } },
        _count: { select: { subTasks: true, dependencies: true, dependents: true, history: true } },
      },
    }) as Promise<TaskWithRelations>;
  }

  async delete(id: string) {
    return this.prisma.task.update({
      where: { id },
      data: { status: 'deleted' },
    });
  }

  async hardDelete(id: string) {
    return this.prisma.task.delete({ where: { id } });
  }

  async getSubTasks(parentTaskId: string) {
    return this.prisma.task.findMany({
      where: { parentTaskId, status: { not: 'deleted' } },
      orderBy: { createdAt: 'asc' },
      include: {
        tags: { include: { tag: true } },
        _count: { select: { subTasks: true, dependencies: true, dependents: true, history: true } },
      },
    }) as Promise<TaskWithRelations[]>;
  }

  async countByStatus(): Promise<Record<string, number>> {
    const result = await this.prisma.task.groupBy({
      by: ['status'],
      where: { status: { not: 'deleted' } },
      _count: { status: true },
    });
    const counts: Record<string, number> = {
      todo: 0,
      in_progress: 0,
      done: 0,
      closed: 0,
      blocked: 0,
    };
    for (const r of result) {
      counts[r.status] = r._count.status;
    }
    return counts;
  }
}
