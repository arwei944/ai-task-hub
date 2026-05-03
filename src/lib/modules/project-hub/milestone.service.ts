// ============================================================
// Milestone Service - 项目里程碑管理服务
// ============================================================

import type { ILogger, IEventBus } from '@/lib/core/types';
import type { MilestoneListQuery } from './types';

/**
 * 创建里程碑的数据
 */
export interface CreateMilestoneDTO {
  projectId: string;
  title: string;
  description?: string;
  dueDate?: Date | string;
}

/**
 * 更新里程碑的数据
 */
export interface UpdateMilestoneDTO {
  title?: string;
  description?: string;
  status?: string;
  dueDate?: Date | string;
  completedAt?: Date | string;
}

/**
 * 里程碑排序项
 */
export interface MilestoneOrderItem {
  id: string;
  sortOrder: number;
}

/**
 * 项目里程碑管理服务
 * 提供里程碑的增删改查、排序和逾期检测功能
 */
export class MilestoneService {
  constructor(
    private prisma: any,
    private eventBus: IEventBus,
    private logger: ILogger,
  ) {}

  /**
   * 获取项目的里程碑列表
   * @param query - 查询参数，包含 projectId 和可选的 status 筛选
   * @returns 里程碑列表
   */
  async list(query: MilestoneListQuery) {
    this.logger.info('[MilestoneService] Listing milestones', { query });

    const where: any = { projectId: query.projectId };
    if (query.status) {
      where.status = query.status;
    }

    return this.prisma.projectMilestone.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * 创建里程碑
   * @param data - 创建数据
   * @returns 新创建的里程碑
   */
  async create(data: CreateMilestoneDTO) {
    this.logger.info('[MilestoneService] Creating milestone', {
      projectId: data.projectId,
      title: data.title,
    });

    const milestone = await this.prisma.projectMilestone.create({
      data: {
        projectId: data.projectId,
        title: data.title,
        description: data.description,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
      },
    });

    this.eventBus.emit({
      type: 'project.milestone.created',
      payload: {
        milestoneId: milestone.id,
        projectId: data.projectId,
        title: data.title,
      },
      timestamp: new Date(),
      source: 'project-hub',
    });

    this.logger.info('[MilestoneService] Milestone created', {
      id: milestone.id,
      projectId: data.projectId,
    });

    return milestone;
  }

  /**
   * 更新里程碑
   * @param id - 里程碑 ID
   * @param data - 更新数据
   * @returns 更新后的里程碑
   */
  async update(id: string, data: UpdateMilestoneDTO) {
    this.logger.info('[MilestoneService] Updating milestone', { id, data });

    const existing = await this.prisma.projectMilestone.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new Error(`Milestone not found: ${id}`);
    }

    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    if (data.completedAt !== undefined) updateData.completedAt = data.completedAt ? new Date(data.completedAt) : null;

    const milestone = await this.prisma.projectMilestone.update({
      where: { id },
      data: updateData,
    });

    // 里程碑完成时发送事件
    if (data.status === 'completed') {
      this.eventBus.emit({
        type: 'project.milestone.completed',
        payload: {
          milestoneId: milestone.id,
          projectId: milestone.projectId,
          title: milestone.title,
          completedAt: milestone.completedAt,
        },
        timestamp: new Date(),
        source: 'project-hub',
      });

      this.logger.info('[MilestoneService] Milestone completed', {
        id: milestone.id,
        projectId: milestone.projectId,
      });
    }

    // 里程碑标记为逾期时发送事件
    if (data.status === 'overdue') {
      this.eventBus.emit({
        type: 'project.milestone.overdue',
        payload: {
          milestoneId: milestone.id,
          projectId: milestone.projectId,
          title: milestone.title,
          dueDate: milestone.dueDate,
        },
        timestamp: new Date(),
        source: 'project-hub',
      });

      this.logger.warn('[MilestoneService] Milestone overdue', {
        id: milestone.id,
        projectId: milestone.projectId,
      });
    }

    return milestone;
  }

  /**
   * 删除里程碑
   * @param id - 里程碑 ID
   */
  async delete(id: string) {
    this.logger.info('[MilestoneService] Deleting milestone', { id });

    const existing = await this.prisma.projectMilestone.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new Error(`Milestone not found: ${id}`);
    }

    await this.prisma.projectMilestone.delete({
      where: { id },
    });

    this.logger.info('[MilestoneService] Milestone deleted', {
      id,
      projectId: existing.projectId,
    });
  }

  /**
   * 重新排序里程碑
   * @param projectId - 项目 ID
   * @param orders - 排序项数组，包含 id 和 sortOrder
   */
  async reorder(projectId: string, orders: MilestoneOrderItem[]) {
    this.logger.info('[MilestoneService] Reordering milestones', {
      projectId,
      count: orders.length,
    });

    const updatePromises = orders.map((item) =>
      this.prisma.projectMilestone.update({
        where: { id: item.id },
        data: { sortOrder: item.sortOrder },
      }),
    );

    await Promise.all(updatePromises);

    this.logger.info('[MilestoneService] Milestones reordered', { projectId });
  }

  /**
   * 获取逾期里程碑
   * @param projectId - 可选的项目 ID，不传则获取所有项目的逾期里程碑
   * @returns 逾期里程碑列表
   */
  async getOverdue(projectId?: string) {
    this.logger.info('[MilestoneService] Getting overdue milestones', { projectId });

    const now = new Date();
    const where: any = {
      status: { notIn: ['completed'] },
      dueDate: { lt: now },
    };

    if (projectId) {
      where.projectId = projectId;
    }

    const overdueMilestones = await this.prisma.projectMilestone.findMany({
      where,
      include: {
        project: {
          select: { id: true, name: true },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    // 更新逾期里程碑的状态
    const updatePromises = overdueMilestones
      .filter((m: any) => m.status !== 'overdue')
      .map((m: any) =>
        this.prisma.projectMilestone.update({
          where: { id: m.id },
          data: { status: 'overdue' },
        }),
      );

    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
    }

    this.logger.info('[MilestoneService] Found overdue milestones', {
      count: overdueMilestones.length,
    });

    return overdueMilestones;
  }
}
