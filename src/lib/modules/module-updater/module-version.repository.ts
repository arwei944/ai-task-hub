// ============================================================
// Module Version Repository
// ============================================================

import type { PrismaClient } from '@/generated/prisma/client';

export class ModuleVersionRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: {
    moduleId: string;
    version: string;
    previousVersion?: string;
    changelog?: string;
    configSnapshot?: string;
  }) {
    return this.prisma.moduleVersion.create({
      data: {
        moduleId: data.moduleId,
        version: data.version,
        previousVersion: data.previousVersion,
        changelog: data.changelog,
        configSnapshot: data.configSnapshot,
      },
    });
  }

  async findByModuleId(moduleId: string) {
    return this.prisma.moduleVersion.findMany({
      where: { moduleId },
      orderBy: { deployedAt: 'desc' },
    });
  }

  async findLatest(moduleId: string) {
    return this.prisma.moduleVersion.findFirst({
      where: { moduleId, status: 'active' },
      orderBy: { deployedAt: 'desc' },
    });
  }

  async findPrevious(moduleId: string, currentVersion: string) {
    return this.prisma.moduleVersion.findFirst({
      where: {
        moduleId,
        version: { not: currentVersion },
        status: { in: ['active', 'rollback'] },
      },
      orderBy: { deployedAt: 'desc' },
    });
  }

  async updateStatus(id: string, status: string) {
    return this.prisma.moduleVersion.update({
      where: { id },
      data: { status },
    });
  }

  async archiveAll(moduleId: string) {
    return this.prisma.moduleVersion.updateMany({
      where: { moduleId, status: 'active' },
      data: { status: 'archived' },
    });
  }

  async listAll() {
    return this.prisma.moduleVersion.findMany({
      orderBy: { deployedAt: 'desc' },
    });
  }
}
