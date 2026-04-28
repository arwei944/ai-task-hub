// ============================================================
// User Repository
// ============================================================

import type { PrismaClient } from '@/generated/prisma/client';
import type { AuthUser, UserRole } from './types';

export class UserRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async count() {
    return this.prisma.user.count();
  }

  async create(data: {
    username: string;
    email: string;
    passwordHash: string;
    displayName?: string;
    role?: string;
  }) {
    return this.prisma.user.create({
      data: {
        username: data.username,
        email: data.email,
        passwordHash: data.passwordHash,
        displayName: data.displayName ?? null,
        role: (data.role as UserRole) ?? 'user',
      },
    });
  }

  async updateLastLogin(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }

  async update(id: string, data: {
    displayName?: string;
    avatar?: string;
    role?: string;
    isActive?: boolean;
  }) {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async list(filters?: { role?: string; isActive?: boolean }) {
    return this.prisma.user.findMany({
      where: {
        ...(filters?.role && { role: filters.role }),
        ...(filters?.isActive !== undefined && { isActive: filters.isActive }),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        role: true,
        avatar: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async delete(id: string) {
    return this.prisma.user.delete({ where: { id } });
  }

  toAuthUser(user: any): AuthUser {
    return {
      id: String(user.id),
      username: String(user.username ?? ''),
      email: String(user.email ?? ''),
      displayName: user.displayName ? String(user.displayName) : null,
      role: String(user.role ?? 'user') as UserRole,
      avatar: user.avatar ? String(user.avatar) : null,
      isActive: Boolean(user.isActive),
    };
  }
}
