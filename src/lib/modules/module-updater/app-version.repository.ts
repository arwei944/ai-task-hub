// ============================================================
// App Version Repository
// ============================================================

import type { PrismaClient } from '@/generated/prisma/client';

export class AppVersionRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: {
    version: string;
    channel?: string;
    releaseNotes?: string;
    checksum?: string;
    isCurrent?: boolean;
  }) {
    // If this version is marked as current, unset previous current
    if (data.isCurrent) {
      await this.prisma.appVersion.updateMany({
        where: { isCurrent: true },
        data: { isCurrent: false },
      });
    }

    return this.prisma.appVersion.create({
      data: {
        version: data.version,
        channel: data.channel ?? 'stable',
        releaseNotes: data.releaseNotes,
        checksum: data.checksum,
        isCurrent: data.isCurrent ?? false,
      },
    });
  }

  async getCurrent() {
    return this.prisma.appVersion.findFirst({
      where: { isCurrent: true },
    });
  }

  async getLatest(channel?: string) {
    return this.prisma.appVersion.findFirst({
      where: channel ? { channel } : undefined,
      orderBy: { publishedAt: 'desc' },
    });
  }

  async list(channel?: string) {
    return this.prisma.appVersion.findMany({
      where: channel ? { channel } : undefined,
      orderBy: { publishedAt: 'desc' },
    });
  }

  async setCurrent(version: string) {
    await this.prisma.appVersion.updateMany({
      where: { isCurrent: true },
      data: { isCurrent: false },
    });

    return this.prisma.appVersion.update({
      where: { version },
      data: { isCurrent: true },
    });
  }

  async delete(version: string) {
    return this.prisma.appVersion.delete({
      where: { version },
    });
  }
}
