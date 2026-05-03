// ============================================================
// Project Hub Service - 项目中心编排服务
// ============================================================

import type { ILogger, IEventBus } from '@/lib/core/types';
import type {
  DashboardOverview,
  HealthMatrix,
  ProjectListQuery,
} from './types';
import { MilestoneService } from './milestone.service';
import { ProjectAgentService } from './agent.service';
import { ProjectDependencyService } from './project-dependency.service';
import { WorkLogService } from './work-log.service';
import { DocService } from './doc.service';
import { TemplateService } from './template.service';

/**
 * 创建项目的数据
 */
export interface CreateProjectDTO {
  name: string;
  description?: string;
  phase?: string;
  priority?: string;
  techStack?: string[];
  repository?: string;
  creatorId?: string;
  creatorType?: string;
}

/**
 * 更新项目的数据
 */
export interface UpdateProjectDTO {
  name?: string;
  description?: string;
  status?: string;
  phase?: string;
  priority?: string;
  techStack?: string[];
  repository?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 项目详情（含关联数据）
 */
export interface ProjectDetail {
  id: string;
  name: string;
  description: string | null;
  status: string;
  phase: string;
  priority: string;
  techStack: string | null;
  repository: string | null;
  creatorId: string | null;
  creatorType: string;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  milestones: any[];
  agents: any[];
  dependencies: any[];
  taskStats: {
    total: number;
    done: number;
    inProgress: number;
    todo: number;
  };
}

/**
 * 项目中心编排服务
 * 聚合里程碑、Agent 分配、依赖关系等子服务，提供统一的项目管理入口
 */
export class ProjectHubService {
  constructor(
    private prisma: any,
    private eventBus: IEventBus,
    private logger: ILogger,
    private milestoneService: MilestoneService,
    private projectAgentService: ProjectAgentService,
    private projectDependencyService: ProjectDependencyService,
    private workLogService: WorkLogService,
    private docService: DocService,
    private templateService: TemplateService,
  ) {}

  /**
   * 获取仪表盘概览数据
   * 聚合所有项目的统计数据，包括状态分布、优先级分布、逾期里程碑等
   * @returns 仪表盘概览数据
   */
  async getDashboardOverview(): Promise<DashboardOverview> {
    this.logger.info('[ProjectHubService] Getting dashboard overview');

    const [
      allProjects,
      statusGroups,
      priorityGroups,
      phaseGroups,
      overdueMilestones,
      recentActivities,
    ] = await Promise.all([
      this.prisma.project.findMany({
        where: { status: { not: 'archived' } },
        select: { id: true, name: true, status: true, phase: true, priority: true },
      }),
      this.prisma.project.groupBy({
        by: ['status'],
        where: { status: { not: 'archived' } },
        _count: true,
      }),
      this.prisma.project.groupBy({
        by: ['priority'],
        where: { status: { not: 'archived' } },
        _count: true,
      }),
      this.prisma.project.groupBy({
        by: ['phase'],
        where: { status: { not: 'archived' } },
        _count: true,
      }),
      this.milestoneService.getOverdue(),
      this.prisma.activityLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          project: {
            select: { id: true, name: true },
          },
        },
      }),
    ]);

    // 统计各状态项目数
    const projectsByStatus: Record<string, number> = {};
    for (const group of statusGroups) {
      projectsByStatus[group.status] = group._count;
    }

    const projectsByPriority: Record<string, number> = {};
    for (const group of priorityGroups) {
      projectsByPriority[group.priority] = group._count;
    }

    const projectsByPhase: Record<string, number> = {};
    for (const group of phaseGroups) {
      projectsByPhase[group.phase] = group._count;
    }

    const activeProjects = projectsByStatus['active'] ?? 0;
    const completedProjects = projectsByStatus['completed'] ?? 0;
    const pausedProjects = projectsByStatus['paused'] ?? 0;

    // 获取即将到期的里程碑（未来 7 天内）
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const upcomingMilestones = await this.prisma.projectMilestone.findMany({
      where: {
        status: { notIn: ['completed', 'overdue'] },
        dueDate: {
          gte: new Date(),
          lte: sevenDaysFromNow,
        },
      },
      include: {
        project: {
          select: { id: true, name: true },
        },
      },
      orderBy: { dueDate: 'asc' },
      take: 10,
    });

    const upcomingDeadlines = upcomingMilestones.map((m: any) => ({
      projectId: m.project.id,
      projectName: m.project.name,
      milestoneTitle: m.title,
      dueDate: m.dueDate.toISOString(),
      daysLeft: Math.ceil(
        (m.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      ),
    }));

    // 最近活动
    const recentActivity = recentActivities.map((a: any) => ({
      id: a.id,
      projectId: a.projectId,
      projectName: a.project?.name ?? '',
      action: a.action,
      title: a.title ?? '',
      createdAt: a.createdAt.toISOString(),
    }));

    // 获取重点项目（按任务完成度排序）
    const topProjectsRaw = await this.prisma.project.findMany({
      where: { status: 'active' },
      take: 5,
      orderBy: { updatedAt: 'desc' },
      include: {
        tasks: {
          select: { status: true },
        },
      },
    });

    const topProjects = await Promise.all(
      topProjectsRaw.map(async (project: any) => {
        const tasks = project.tasks;
        const total = tasks.length;
        const done = tasks.filter((t: any) => t.status === 'done').length;
        const inProgress = tasks.filter((t: any) => t.status === 'in_progress').length;
        const progress = total > 0 ? Math.round((done / total) * 100) : 0;

        const health = await this.computeProjectHealth(project.id, total, done);

        return {
          id: project.id,
          name: project.name,
          progress,
          healthScore: health.healthScore,
          taskStats: { total, done, inProgress },
        };
      }),
    );

    // 计算整体健康评分
    const overallHealthScore =
      topProjects.length > 0
        ? Math.round(
            topProjects.reduce((sum: number, p: any) => sum + p.healthScore, 0) /
              topProjects.length,
          )
        : 100;

    const overview: DashboardOverview = {
      totalProjects: allProjects.length,
      activeProjects,
      completedProjects,
      pausedProjects,
      overallHealthScore,
      projectsByStatus,
      projectsByPriority,
      projectsByPhase,
      overdueMilestones: overdueMilestones.length,
      upcomingDeadlines,
      recentActivity,
      topProjects,
    };

    this.logger.info('[ProjectHubService] Dashboard overview generated');

    return overview;
  }

  /**
   * 获取健康矩阵
   * 计算所有活跃项目的健康评分，包括进度、时间线和工作负载三个维度
   * @returns 健康矩阵数据
   */
  async getHealthMatrix(): Promise<HealthMatrix> {
    this.logger.info('[ProjectHubService] Getting health matrix');

    const activeProjects = await this.prisma.project.findMany({
      where: { status: 'active' },
      select: { id: true, name: true, status: true },
    });

    const projects = await Promise.all(
      activeProjects.map(async (project: any) => {
        const health = await this.computeProjectHealthById(project.id);

        return {
          id: project.id,
          name: project.name,
          status: project.status,
          ...health,
        };
      }),
    );

    this.logger.info('[ProjectHubService] Health matrix generated', {
      count: projects.length,
    });

    return { projects };
  }

  /**
   * 获取项目详情
   * 包含里程碑、Agent、依赖关系和任务统计
   * @param id - 项目 ID
   * @returns 项目详情
   */
  async getProjectDetail(id: string): Promise<ProjectDetail | null> {
    this.logger.info('[ProjectHubService] Getting project detail', { id });

    const project = await this.prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      return null;
    }

    const [milestones, agents, dependencies, taskStatsResult] = await Promise.all([
      this.milestoneService.list({ projectId: id }),
      this.projectAgentService.list(id),
      this.projectDependencyService.list(id),
      this.getProjectTaskStats(id),
    ]);

    const detail: ProjectDetail = {
      ...project,
      milestones,
      agents,
      dependencies,
      taskStats: taskStatsResult,
    };

    return detail;
  }

  /**
   * 列出项目（支持筛选、排序和分页）
   * @param query - 查询参数
   * @returns 分页结果
   */
  async listProjects(query: ProjectListQuery) {
    this.logger.info('[ProjectHubService] Listing projects', { query });

    const where: any = {};

    if (query.status) {
      where.status = query.status;
    }
    if (query.phase) {
      where.phase = query.phase;
    }
    if (query.priority) {
      where.priority = query.priority;
    }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const orderBy: any = {};
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';
    orderBy[sortBy] = sortOrder;

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
      }),
      this.prisma.project.count({ where }),
    ]);

    this.logger.info('[ProjectHubService] Projects listed', {
      total,
      page,
      pageSize,
    });

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 创建项目
   * @param data - 创建数据
   * @returns 新创建的项目
   */
  async createProject(data: CreateProjectDTO) {
    this.logger.info('[ProjectHubService] Creating project', { name: data.name });

    const project = await this.prisma.project.create({
      data: {
        name: data.name,
        description: data.description,
        phase: data.phase ?? 'requirements',
        priority: data.priority ?? 'medium',
        techStack: data.techStack ? JSON.stringify(data.techStack) : null,
        repository: data.repository,
        creatorId: data.creatorId,
        creatorType: data.creatorType ?? 'agent',
        startedAt: new Date(),
      },
    });

    this.eventBus.emit({
      type: 'project.created',
      payload: {
        projectId: project.id,
        name: project.name,
        phase: project.phase,
        priority: project.priority,
        creatorId: data.creatorId,
      },
      timestamp: new Date(),
      source: 'project-hub',
    });

    this.logger.info('[ProjectHubService] Project created', {
      id: project.id,
      name: project.name,
    });

    return project;
  }

  /**
   * 更新项目
   * @param id - 项目 ID
   * @param data - 更新数据
   * @returns 更新后的项目
   */
  async updateProject(id: string, data: UpdateProjectDTO) {
    this.logger.info('[ProjectHubService] Updating project', { id, data });

    const existing = await this.prisma.project.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new Error(`Project not found: ${id}`);
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.phase !== undefined) updateData.phase = data.phase;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.techStack !== undefined) updateData.techStack = JSON.stringify(data.techStack);
    if (data.repository !== undefined) updateData.repository = data.repository;
    if (data.metadata !== undefined) updateData.metadata = JSON.stringify(data.metadata);

    // 如果项目标记为完成，设置完成时间
    if (data.status === 'completed') {
      updateData.completedAt = new Date();
    }

    const project = await this.prisma.project.update({
      where: { id },
      data: updateData,
    });

    this.eventBus.emit({
      type: 'project.updated',
      payload: {
        projectId: id,
        changes: Object.keys(updateData),
      },
      timestamp: new Date(),
      source: 'project-hub',
    });

    this.logger.info('[ProjectHubService] Project updated', { id });

    return project;
  }

  /**
   * 归档项目
   * @param id - 项目 ID
   * @returns 归档后的项目
   */
  async archiveProject(id: string) {
    this.logger.info('[ProjectHubService] Archiving project', { id });

    const existing = await this.prisma.project.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new Error(`Project not found: ${id}`);
    }

    const project = await this.prisma.project.update({
      where: { id },
      data: { status: 'archived' },
    });

    this.eventBus.emit({
      type: 'project.archived',
      payload: {
        projectId: id,
        name: project.name,
      },
      timestamp: new Date(),
      source: 'project-hub',
    });

    this.logger.info('[ProjectHubService] Project archived', { id });

    return project;
  }

  // ================================================================
  // Private Helpers
  // ================================================================

  /**
   * 计算项目健康评分（基于已知任务数）
   * healthScore = progressScore * 0.4 + timelineScore * 0.35 + workloadScore * 0.25
   */
  private async computeProjectHealth(
    projectId: string,
    totalTasks: number,
    doneTasks: number,
  ) {
    // 进度评分
    const progressScore =
      totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 50;

    // 时间线评分
    const milestones = await this.prisma.projectMilestone.findMany({
      where: { projectId },
    });
    const totalMilestones = milestones.length;
    const overdueMilestones = milestones.filter(
      (m: any) => m.status === 'overdue',
    ).length;
    const timelineScore =
      totalMilestones > 0
        ? Math.max(0, 100 - (overdueMilestones / totalMilestones) * 100)
        : 100;

    // 工作负载评分
    const agents = await this.prisma.projectAgent.findMany({
      where: { projectId, isActive: true },
    });
    const totalAgents = agents.length;
    // 简化：假设每个 Agent 超过 10 个进行中的任务即为过载
    const inProgressTasks = await this.prisma.task.count({
      where: { projectId, status: 'in_progress' },
    });
    const overloadedAgents = Math.max(
      0,
      totalAgents > 0 ? Math.floor(inProgressTasks / 10) - totalAgents : 0,
    );
    const workloadScore =
      totalAgents > 0
        ? 100 - Math.min(100, (overloadedAgents / totalAgents) * 150)
        : 100;

    const healthScore = Math.round(
      progressScore * 0.4 + timelineScore * 0.35 + workloadScore * 0.25,
    );

    // 确定风险等级
    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    const risks: string[] = [];

    if (healthScore >= 75) {
      riskLevel = 'low';
    } else if (healthScore >= 50) {
      riskLevel = 'medium';
    } else if (healthScore >= 25) {
      riskLevel = 'high';
    } else {
      riskLevel = 'critical';
    }

    if (overdueMilestones > 0) {
      risks.push(`${overdueMilestones} 个里程碑已逾期`);
    }
    if (progressScore < 30 && totalMilestones > 0) {
      risks.push('项目进度严重滞后');
    }
    if (workloadScore < 50) {
      risks.push('工作负载过高');
    }
    if (totalAgents === 0 && totalTasks > 5) {
      risks.push('项目缺少 Agent 分配');
    }

    return {
      healthScore,
      progressScore: Math.round(progressScore),
      timelineScore: Math.round(timelineScore),
      workloadScore: Math.round(workloadScore),
      riskLevel,
      risks,
    };
  }

  /**
   * 通过项目 ID 计算健康评分（自动查询任务数）
   */
  private async computeProjectHealthById(projectId: string) {
    const tasks = await this.prisma.task.groupBy({
      by: ['status'],
      where: { projectId },
      _count: true,
    });

    const totalTasks = tasks.reduce((sum: number, t: any) => sum + t._count, 0);
    const doneTasks = tasks.find((t: any) => t.status === 'done')?._count ?? 0;

    return this.computeProjectHealth(projectId, totalTasks, doneTasks);
  }

  /**
   * 获取项目任务统计
   */
  private async getProjectTaskStats(projectId: string) {
    const tasks = await this.prisma.task.groupBy({
      by: ['status'],
      where: { projectId },
      _count: true,
    });

    const total = tasks.reduce((sum: number, t: any) => sum + t._count, 0);
    const done = tasks.find((t: any) => t.status === 'done')?._count ?? 0;
    const inProgress = tasks.find((t: any) => t.status === 'in_progress')?._count ?? 0;
    const todo = tasks.find((t: any) => t.status === 'todo')?._count ?? 0;

    return { total, done, inProgress, todo };
  }
}
