// ============================================================
// Project Dependency Service - 项目依赖关系管理服务
// ============================================================

import type { ILogger, IEventBus } from '@/lib/core/types';
import type { DependencyGraph } from './types';

/**
 * 创建项目依赖的数据
 */
export interface CreateDependencyDTO {
  /** 依赖方项目 ID（需要对方完成） */
  sourceProjectId: string;
  /** 被依赖方项目 ID（需要先完成） */
  targetProjectId: string;
  /** 依赖类型 */
  dependencyType?: string;
  /** 描述 */
  description?: string;
}

/**
 * 项目依赖关系管理服务
 * 提供项目间依赖的增删查和循环依赖检测功能
 */
export class ProjectDependencyService {
  constructor(
    private prisma: any,
    private eventBus: IEventBus,
    private logger: ILogger,
  ) {}

  /**
   * 获取项目依赖列表
   * @param projectId - 可选的项目 ID，不传则返回所有依赖关系
   * @returns 依赖关系列表
   */
  async list(projectId?: string) {
    this.logger.info('[ProjectDependencyService] Listing dependencies', { projectId });

    const where: any = {};
    if (projectId) {
      where.OR = [
        { sourceProjectId: projectId },
        { targetProjectId: projectId },
      ];
    }

    const dependencies = await this.prisma.projectDependency.findMany({
      where,
      include: {
        sourceProject: {
          select: { id: true, name: true, status: true },
        },
        targetProject: {
          select: { id: true, name: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return dependencies;
  }

  /**
   * 创建项目依赖关系（含循环依赖检测）
   * @param data - 创建数据
   * @returns 新创建的依赖关系
   * @throws Error 当检测到循环依赖时抛出错误
   */
  async create(data: CreateDependencyDTO) {
    this.logger.info('[ProjectDependencyService] Creating dependency', {
      source: data.sourceProjectId,
      target: data.targetProjectId,
    });

    // 循环依赖检测：从 targetProjectId 出发，沿着现有依赖关系做 DFS，
    // 如果能到达 sourceProjectId，则添加此依赖会形成环
    const hasCycle = await this.detectCycle(
      data.targetProjectId,
      data.sourceProjectId,
    );

    if (hasCycle) {
      throw new Error('Circular dependency detected');
    }

    const dependency = await this.prisma.projectDependency.create({
      data: {
        sourceProjectId: data.sourceProjectId,
        targetProjectId: data.targetProjectId,
        dependencyType: data.dependencyType ?? 'finish_to_start',
        description: data.description,
      },
      include: {
        sourceProject: {
          select: { id: true, name: true, status: true },
        },
        targetProject: {
          select: { id: true, name: true, status: true },
        },
      },
    });

    this.eventBus.emit({
      type: 'project.dependency.created',
      payload: {
        dependencyId: dependency.id,
        sourceProjectId: data.sourceProjectId,
        targetProjectId: data.targetProjectId,
        dependencyType: dependency.dependencyType,
      },
      timestamp: new Date(),
      source: 'project-hub',
    });

    this.logger.info('[ProjectDependencyService] Dependency created', {
      id: dependency.id,
      source: data.sourceProjectId,
      target: data.targetProjectId,
    });

    return dependency;
  }

  /**
   * 删除项目依赖关系
   * @param id - 依赖关系 ID
   */
  async delete(id: string) {
    this.logger.info('[ProjectDependencyService] Deleting dependency', { id });

    const existing = await this.prisma.projectDependency.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new Error(`Dependency not found: ${id}`);
    }

    await this.prisma.projectDependency.delete({
      where: { id },
    });

    this.logger.info('[ProjectDependencyService] Dependency deleted', {
      id,
      source: existing.sourceProjectId,
      target: existing.targetProjectId,
    });
  }

  /**
   * 获取完整的依赖关系图（用于可视化）
   * @returns 依赖关系图数据，包含节点和边
   */
  async getGraph(): Promise<DependencyGraph> {
    this.logger.info('[ProjectDependencyService] Getting dependency graph');

    const dependencies = await this.prisma.projectDependency.findMany({
      where: { isActive: true },
      include: {
        sourceProject: {
          select: { id: true, name: true, status: true },
        },
        targetProject: {
          select: { id: true, name: true, status: true },
        },
      },
    });

    // Get ALL projects as nodes (not just ones with dependencies)
    const allProjects = await this.prisma.project.findMany({
      select: { id: true, name: true, status: true },
    });

    // Calculate health score for each project
    const nodes = await Promise.all(
      allProjects.map(async (project: any) => {
        const tasks = await this.prisma.task.groupBy({
          by: ['status'],
          where: { projectId: project.id },
          _count: true,
        });

        const totalTasks = tasks.reduce((sum: number, t: any) => sum + t._count, 0);
        const doneTasks = tasks.find((t: any) => t.status === 'done')?._count ?? 0;
        const progressScore = totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 50;

        return {
          id: project.id,
          name: project.name,
          status: project.status,
          healthScore: Math.round(progressScore),
        };
      }),
    );

    const edges = dependencies.map((dep: any) => ({
      source: dep.sourceProjectId,
      target: dep.targetProjectId,
      type: dep.dependencyType,
      description: dep.description ?? undefined,
    }));

    this.logger.info('[ProjectDependencyService] Graph generated', {
      nodes: nodes.length,
      edges: edges.length,
    });

    return { nodes, edges };
  }

  /**
   * 使用 DFS 检测从 startId 出发是否能到达 targetId
   * @param startId - 起始节点
   * @param targetId - 目标节点
   * @returns 是否存在路径（即是否会产生循环）
   */
  private async detectCycle(startId: string, targetId: string): Promise<boolean> {
    const visited = new Set<string>();

    const dfs = async (currentId: string): Promise<boolean> => {
      if (currentId === targetId) {
        return true;
      }

      if (visited.has(currentId)) {
        return false;
      }

      visited.add(currentId);

      // 查找当前项目作为 sourceProject 的所有依赖
      // 即当前项目依赖了哪些其他项目
      const outgoingDeps = await this.prisma.projectDependency.findMany({
        where: { sourceProjectId: currentId, isActive: true },
        select: { targetProjectId: true },
      });

      for (const dep of outgoingDeps) {
        if (await dfs(dep.targetProjectId)) {
          return true;
        }
      }

      return false;
    };

    return dfs(startId);
  }
}
