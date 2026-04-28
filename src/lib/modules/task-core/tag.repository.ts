import { PrismaClient } from '@/generated/prisma/client';

export class TagRepository {
  constructor(private prisma: PrismaClient) {}

  async findAll() {
    return this.prisma.tag.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { tasks: true } } },
    });
  }

  async findById(id: string) {
    return this.prisma.tag.findUnique({ where: { id } });
  }

  async findByName(name: string) {
    return this.prisma.tag.findUnique({ where: { name } });
  }

  async create(data: { name: string; color?: string }) {
    return this.prisma.tag.create({
      data: { name: data.name, color: data.color ?? '#6B7280' },
    });
  }

  async update(id: string, data: { name?: string; color?: string }) {
    return this.prisma.tag.update({ where: { id }, data });
  }

  async delete(id: string) {
    return this.prisma.tag.delete({ where: { id } });
  }
}
