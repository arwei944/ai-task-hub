import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, adminProcedure } from './server';
import { getPrisma } from '@/lib/db';

export const workspacesRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const prisma = getPrisma();
    const members = await prisma.workspaceMember.findMany({
      where: { userId: ctx.user.id },
      include: { workspace: true },
      orderBy: { joinedAt: 'desc' },
    });
    await prisma.$disconnect();
    return members.map(m => ({
      ...m.workspace,
      role: m.role,
      joinedAt: m.joinedAt,
    }));
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const prisma = getPrisma();
      const member = await prisma.workspaceMember.findFirst({
        where: { workspaceId: input.id, userId: ctx.user.id },
        include: { workspace: true },
      });
      await prisma.$disconnect();
      if (!member) return null;
      return { ...member.workspace, role: member.role };
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(64),
      description: z.string().optional(),
      icon: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const prisma = getPrisma();
      const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

      const workspace = await prisma.workspace.create({
        data: {
          name: input.name,
          description: input.description,
          icon: input.icon,
          slug,
          owner: ctx.user.id,
          isDefault: false,
        },
      });

      await prisma.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: ctx.user.id,
          role: 'owner',
        },
      });

      await prisma.$disconnect();
      return workspace;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      icon: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const prisma = getPrisma();
      const member = await prisma.workspaceMember.findFirst({
        where: { workspaceId: input.id, userId: ctx.user.id, role: { in: ['owner', 'admin'] } },
      });
      if (!member) throw new Error('权限不足');

      const workspace = await prisma.workspace.update({
        where: { id: input.id },
        data: {
          ...(input.name && { name: input.name }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.icon !== undefined && { icon: input.icon }),
        },
      });

      await prisma.$disconnect();
      return workspace;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const prisma = getPrisma();
      const member = await prisma.workspaceMember.findFirst({
        where: { workspaceId: input.id, userId: ctx.user.id, role: 'owner' },
      });
      if (!member) throw new Error('仅所有者可删除');

      await prisma.workspace.delete({ where: { id: input.id } });
      await prisma.$disconnect();
      return { success: true };
    }),

  invite: protectedProcedure
    .input(z.object({
      workspaceId: z.string(),
      userId: z.string(),
      role: z.enum(['admin', 'member', 'viewer']).default('member'),
    }))
    .mutation(async ({ input, ctx }) => {
      const prisma = getPrisma();
      const inviter = await prisma.workspaceMember.findFirst({
        where: { workspaceId: input.workspaceId, userId: ctx.user.id, role: { in: ['owner', 'admin'] } },
      });
      if (!inviter) throw new Error('权限不足');

      const member = await prisma.workspaceMember.create({
        data: {
          workspaceId: input.workspaceId,
          userId: input.userId,
          role: input.role,
        },
      });

      await prisma.$disconnect();
      return member;
    }),

  removeMember: protectedProcedure
    .input(z.object({ workspaceId: z.string(), userId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const prisma = getPrisma();
      const remover = await prisma.workspaceMember.findFirst({
        where: { workspaceId: input.workspaceId, userId: ctx.user.id, role: { in: ['owner', 'admin'] } },
      });
      if (!remover) throw new Error('权限不足');

      await prisma.workspaceMember.deleteMany({
        where: { workspaceId: input.workspaceId, userId: input.userId },
      });
      await prisma.$disconnect();
      return { success: true };
    }),

  members: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ input, ctx }) => {
      const prisma = getPrisma();
      const member = await prisma.workspaceMember.findFirst({
        where: { workspaceId: input.workspaceId, userId: ctx.user.id },
      });
      if (!member) throw new Error('无权访问');

      const members = await prisma.workspaceMember.findMany({
        where: { workspaceId: input.workspaceId },
        orderBy: { joinedAt: 'asc' },
      });
      await prisma.$disconnect();
      return members;
    }),
});
