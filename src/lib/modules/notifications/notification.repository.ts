import { PrismaClient } from '@/generated/prisma/client';
import type { NotificationData } from './types';

export class NotificationRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: {
    type: string;
    title: string;
    message: string;
    level?: string;
    channel?: string;
    metadata?: Record<string, unknown>;
  }): Promise<NotificationData> {
    const notification = await this.prisma.notification.create({
      data: {
        type: data.type,
        title: data.title,
        message: data.message,
        level: data.level ?? 'info',
        channel: data.channel ?? 'system',
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      },
    });
    return this.toData(notification);
  }

  async findMany(options?: {
    type?: string;
    isRead?: boolean;
    level?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ notifications: NotificationData[]; total: number }> {
    const where: any = {};
    if (options?.type) where.type = options.type;
    if (options?.isRead !== undefined) where.isRead = options.isRead;
    if (options?.level) where.level = options.level;

    const total = await this.prisma.notification.count({ where });
    const notifications = await this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: options?.offset ?? 0,
      take: options?.limit ?? 50,
    });

    return {
      notifications: notifications.map(this.toData),
      total,
    };
  }

  async findUnreadCount(): Promise<number> {
    return this.prisma.notification.count({ where: { isRead: false } });
  }

  async markAsRead(id: string): Promise<void> {
    await this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllAsRead(): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { isRead: false },
      data: { isRead: true },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.notification.delete({ where: { id } });
  }

  async deleteOlderThan(days: number): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const result = await this.prisma.notification.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    return result.count;
  }

  private toData(n: any): NotificationData {
    return {
      ...n,
      metadata: n.metadata ? JSON.parse(n.metadata) : null,
    };
  }
}
