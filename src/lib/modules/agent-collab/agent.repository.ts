import { PrismaClient } from '@/generated/prisma/client';

export interface AgentData {
  id: string;
  name: string;
  description: string | null;
  apiKey: string;
  capabilities: string[] | null;
  permissionLevel: 'user' | 'agent';
  isActive: boolean;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class AgentRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: {
    name: string;
    description?: string;
    apiKey: string;
    capabilities?: string[];
    permissionLevel?: 'user' | 'agent';
  }): Promise<AgentData> {
    const agent = await this.prisma.agent.create({
      data: {
        name: data.name,
        description: data.description,
        apiKey: data.apiKey,
        capabilities: data.capabilities ? JSON.stringify(data.capabilities) : null,
        permissionLevel: data.permissionLevel ?? 'agent',
      },
    });
    return this.toAgentData(agent);
  }

  async findById(id: string): Promise<AgentData | null> {
    const agent = await this.prisma.agent.findUnique({ where: { id } });
    return agent ? this.toAgentData(agent) : null;
  }

  async findByApiKey(apiKey: string): Promise<AgentData | null> {
    const agent = await this.prisma.agent.findUnique({ where: { apiKey } });
    return agent ? this.toAgentData(agent) : null;
  }

  async findMany(options?: {
    isActive?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<{ agents: AgentData[]; total: number }> {
    const where: any = {};
    if (options?.isActive !== undefined) {
      where.isActive = options.isActive;
    }

    const total = await this.prisma.agent.count({ where });
    const agents = await this.prisma.agent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: options?.page ? (options.page - 1) * (options.pageSize ?? 20) : undefined,
      take: options?.pageSize ?? 20,
    });

    return {
      agents: agents.map(this.toAgentData),
      total,
    };
  }

  async update(id: string, data: {
    name?: string;
    description?: string;
    capabilities?: string[];
    permissionLevel?: 'user' | 'agent';
    isActive?: boolean;
  }): Promise<AgentData | null> {
    const agent = await this.prisma.agent.update({
      where: { id },
      data: {
        ...data,
        capabilities: data.capabilities ? JSON.stringify(data.capabilities) : undefined,
      },
    });
    return this.toAgentData(agent);
  }

  async updateLastSeen(id: string): Promise<void> {
    await this.prisma.agent.update({
      where: { id },
      data: { lastSeenAt: new Date() },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.agent.delete({ where: { id } });
  }

  async deactivate(id: string): Promise<void> {
    await this.prisma.agent.update({
      where: { id },
      data: { isActive: false },
    });
  }

  private toAgentData(agent: any): AgentData {
    return {
      ...agent,
      capabilities: agent.capabilities ? JSON.parse(agent.capabilities) : null,
    };
  }
}
