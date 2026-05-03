// ============================================================
// Project Agent Service - 项目 Agent 分配管理服务
// ============================================================

import type { ILogger, IEventBus } from '@/lib/core/types';

/**
 * 分配 Agent 到项目的数据
 */
export interface AssignAgentDTO {
  /** 项目 ID */
  projectId: string;
  /** Agent ID */
  agentId: string;
  /** 角色 */
  role?: string;
  /** 能力配置 */
  capabilities?: string[];
  /** 分配人 */
  assignedBy?: string;
}

/**
 * 项目 Agent 分配管理服务
 * 提供 Agent 与项目的关联管理，包括分配、角色更新、移除和跨项目视图
 */
export class ProjectAgentService {
  constructor(
    private prisma: any,
    private eventBus: IEventBus,
    private logger: ILogger,
  ) {}

  /**
   * 获取项目中的 Agent 列表（含 Agent 详情）
   * @param projectId - 项目 ID
   * @returns 项目 Agent 列表
   */
  async list(projectId: string) {
    this.logger.info('[ProjectAgentService] Listing agents for project', { projectId });

    return this.prisma.projectAgent.findMany({
      where: { projectId, isActive: true },
      include: {
        agent: true,
      },
      orderBy: { joinedAt: 'desc' },
    });
  }

  /**
   * 分配 Agent 到项目（使用 upsert 支持重新分配）
   * @param data - 分配数据
   * @returns 项目 Agent 关联记录
   */
  async assign(data: AssignAgentDTO) {
    this.logger.info('[ProjectAgentService] Assigning agent to project', {
      projectId: data.projectId,
      agentId: data.agentId,
      role: data.role,
    });

    const projectAgent = await this.prisma.projectAgent.upsert({
      where: {
        projectId_agentId: {
          projectId: data.projectId,
          agentId: data.agentId,
        },
      },
      create: {
        projectId: data.projectId,
        agentId: data.agentId,
        role: data.role ?? 'developer',
        capabilities: data.capabilities ? JSON.stringify(data.capabilities) : null,
        assignedBy: data.assignedBy,
        isActive: true,
      },
      update: {
        role: data.role ?? 'developer',
        capabilities: data.capabilities ? JSON.stringify(data.capabilities) : undefined,
        assignedBy: data.assignedBy,
        isActive: true,
      },
      include: {
        agent: true,
      },
    });

    this.eventBus.emit({
      type: 'project.agent.assigned',
      payload: {
        projectAgentId: projectAgent.id,
        projectId: data.projectId,
        agentId: data.agentId,
        role: projectAgent.role,
        assignedBy: data.assignedBy,
      },
      timestamp: new Date(),
      source: 'project-hub',
    });

    this.logger.info('[ProjectAgentService] Agent assigned', {
      id: projectAgent.id,
      projectId: data.projectId,
      agentId: data.agentId,
    });

    return projectAgent;
  }

  /**
   * 更新 Agent 在项目中的角色
   * @param id - 项目 Agent 关联 ID
   * @param role - 新角色
   * @returns 更新后的关联记录
   */
  async updateRole(id: string, role: string) {
    this.logger.info('[ProjectAgentService] Updating agent role', { id, role });

    const existing = await this.prisma.projectAgent.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new Error(`ProjectAgent not found: ${id}`);
    }

    const projectAgent = await this.prisma.projectAgent.update({
      where: { id },
      data: { role },
      include: {
        agent: true,
      },
    });

    this.eventBus.emit({
      type: 'project.agent.roleChanged',
      payload: {
        projectAgentId: id,
        projectId: existing.projectId,
        agentId: existing.agentId,
        oldRole: existing.role,
        newRole: role,
      },
      timestamp: new Date(),
      source: 'project-hub',
    });

    this.logger.info('[ProjectAgentService] Agent role updated', {
      id,
      projectId: existing.projectId,
      agentId: existing.agentId,
      oldRole: existing.role,
      newRole: role,
    });

    return projectAgent;
  }

  /**
   * 从项目中移除 Agent
   * @param id - 项目 Agent 关联 ID
   */
  async remove(id: string) {
    this.logger.info('[ProjectAgentService] Removing agent from project', { id });

    const existing = await this.prisma.projectAgent.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new Error(`ProjectAgent not found: ${id}`);
    }

    await this.prisma.projectAgent.delete({
      where: { id },
    });

    this.eventBus.emit({
      type: 'project.agent.removed',
      payload: {
        projectAgentId: id,
        projectId: existing.projectId,
        agentId: existing.agentId,
      },
      timestamp: new Date(),
      source: 'project-hub',
    });

    this.logger.info('[ProjectAgentService] Agent removed', {
      id,
      projectId: existing.projectId,
      agentId: existing.agentId,
    });
  }

  /**
   * 获取所有 Agent 及其项目分配情况（跨项目视图）
   * @returns 所有项目 Agent 关联记录（含 Agent 详情）
   */
  async crossProjectView() {
    this.logger.info('[ProjectAgentService] Getting cross-project agent view');

    const projectAgents = await this.prisma.projectAgent.findMany({
      where: { isActive: true },
      include: {
        agent: true,
        project: {
          select: { id: true, name: true, status: true },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    this.logger.info('[ProjectAgentService] Cross-project view retrieved', {
      count: projectAgents.length,
    });

    return projectAgents;
  }

  /**
   * 在项目中快速创建并分配 Agent
   * @param data - 创建和分配数据
   * @returns 项目 Agent 关联记录（含新创建的 Agent）
   */
  async createAndAssign(data: {
    projectId: string;
    name: string;
    description?: string;
    clientType?: string;
    role?: string;
    capabilities?: string[];
    assignedBy?: string;
  }) {
    this.logger.info('[ProjectAgentService] Creating and assigning agent', {
      projectId: data.projectId,
      name: data.name,
    });

    // Create the Agent
    const agent = await this.prisma.agent.create({
      data: {
        name: data.name,
        description: data.description || `${data.name} - 自动创建`,
        apiKey: `auto_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        clientType: data.clientType || 'mcp',
        capabilities: data.capabilities ? JSON.stringify(data.capabilities) : null,
        isActive: true,
      },
    });

    // Assign to project
    const projectAgent = await this.prisma.projectAgent.create({
      data: {
        projectId: data.projectId,
        agentId: agent.id,
        role: data.role || 'developer',
        capabilities: data.capabilities ? JSON.stringify(data.capabilities) : null,
        assignedBy: data.assignedBy,
        isActive: true,
      },
      include: { agent: true },
    });

    this.eventBus.emit({
      type: 'project.agent.assigned',
      payload: {
        projectAgentId: projectAgent.id,
        projectId: data.projectId,
        agentId: agent.id,
        agentName: agent.name,
        role: projectAgent.role,
        assignedBy: data.assignedBy,
      },
      timestamp: new Date(),
      source: 'project-hub',
    });

    return projectAgent;
  }

  /**
   * 获取尚未分配到指定项目的可用 Agent 列表
   * @param projectId - 项目 ID
   * @returns 可用 Agent 列表
   */
  async getAvailableAgents(projectId: string) {
    this.logger.info('[ProjectAgentService] Getting available agents', { projectId });

    // 获取已分配到该项目的 Agent ID 列表
    const assignedAgents = await this.prisma.projectAgent.findMany({
      where: { projectId, isActive: true },
      select: { agentId: true },
    });

    const assignedAgentIds = assignedAgents.map((a: any) => a.agentId);

    // 获取所有活跃 Agent 中未被分配的
    const availableAgents = await this.prisma.agent.findMany({
      where: {
        isActive: true,
        ...(assignedAgentIds.length > 0 && {
          id: { notIn: assignedAgentIds },
        }),
      },
    });

    this.logger.info('[ProjectAgentService] Available agents found', {
      projectId,
      count: availableAgents.length,
    });

    return availableAgents;
  }
}
