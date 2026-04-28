import { PrismaClient } from '@/generated/prisma/client';

export interface AgentOperationData {
  id: string;
  agentId: string;
  action: string;
  target: string | null;
  details: Record<string, unknown> | null;
  success: boolean;
  error: string | null;
  createdAt: Date;
}

export class AgentOperationRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: {
    agentId: string;
    action: string;
    target?: string;
    details?: Record<string, unknown>;
    success?: boolean;
    error?: string;
  }): Promise<AgentOperationData> {
    const op = await this.prisma.agentOperation.create({
      data: {
        agentId: data.agentId,
        action: data.action,
        target: data.target,
        details: data.details ? JSON.stringify(data.details) : null,
        success: data.success ?? true,
        error: data.error,
      },
    });
    return this.toOperationData(op);
  }

  async findByAgent(agentId: string, options?: {
    action?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ operations: AgentOperationData[]; total: number }> {
    const where: any = { agentId };
    if (options?.action) {
      where.action = options.action;
    }

    const total = await this.prisma.agentOperation.count({ where });
    const operations = await this.prisma.agentOperation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: options?.offset ?? 0,
      take: options?.limit ?? 50,
    });

    return {
      operations: operations.map(this.toOperationData),
      total,
    };
  }

  async findRecent(limit = 50): Promise<AgentOperationData[]> {
    const operations = await this.prisma.agentOperation.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { agent: { select: { id: true, name: true } } },
    });

    return operations.map((op: any) => ({
      ...this.toOperationData(op),
      agentName: op.agent?.name,
    }));
  }

  async getStatsByAgent(agentId: string): Promise<{
    total: number;
    success: number;
    failed: number;
    byAction: Record<string, number>;
  }> {
    const [total, success, failed, byActionRaw] = await Promise.all([
      this.prisma.agentOperation.count({ where: { agentId } }),
      this.prisma.agentOperation.count({ where: { agentId, success: true } }),
      this.prisma.agentOperation.count({ where: { agentId, success: false } }),
      this.prisma.agentOperation.groupBy({
        by: ['action'],
        where: { agentId },
        _count: { id: true },
      }),
    ]);

    const byAction: Record<string, number> = {};
    for (const item of byActionRaw) {
      byAction[item.action] = item._count.id;
    }

    return { total, success, failed, byAction };
  }

  async deleteByAgent(agentId: string): Promise<void> {
    await this.prisma.agentOperation.deleteMany({ where: { agentId } });
  }

  private toOperationData(op: any): AgentOperationData {
    return {
      ...op,
      details: op.details ? JSON.parse(op.details) : null,
    };
  }
}
