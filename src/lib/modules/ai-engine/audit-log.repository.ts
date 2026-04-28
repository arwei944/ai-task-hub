import { PrismaClient } from '@/generated/prisma/client';
import type { AICallLog } from './types';

export class AuditLogRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: {
    processor: string;
    input: string;
    output: string;
    model: string;
    tokensUsed?: number;
    duration: number;
    success: boolean;
    error?: string;
  }): Promise<AICallLog> {
    return this.prisma.aIAuditLog.create({
      data,
    }) as any;
  }

  async findByProcessor(processor: string, limit = 50) {
    return this.prisma.aIAuditLog.findMany({
      where: { processor },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }) as Promise<AICallLog[]>;
  }

  async getStats() {
    const total = await this.prisma.aIAuditLog.count();
    const success = await this.prisma.aIAuditLog.count({ where: { success: true } });
    const failed = await this.prisma.aIAuditLog.count({ where: { success: false } });
    const totalTokens = await this.prisma.aIAuditLog.aggregate({
      _sum: { tokensUsed: true },
    });

    return {
      total,
      success,
      failed,
      totalTokens: totalTokens._sum.tokensUsed ?? 0,
    };
  }
}
