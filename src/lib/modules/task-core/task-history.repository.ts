import { PrismaClient } from '@/generated/prisma/client';

export class TaskHistoryRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: {
    taskId: string;
    field: string;
    oldValue?: string;
    newValue?: string;
    actor?: string;
  }) {
    return this.prisma.taskHistory.create({ data });
  }

  async findByTaskId(taskId: string, limit = 50) {
    return this.prisma.taskHistory.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async deleteByTaskId(taskId: string) {
    return this.prisma.taskHistory.deleteMany({ where: { taskId } });
  }
}
