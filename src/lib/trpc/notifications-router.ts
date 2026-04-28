import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from './server';
import { NotificationRepository } from '@/lib/modules/notifications/notification.repository';
import { Logger } from '@/lib/core/logger';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

let _repo: NotificationRepository | null = null;

function getRepo() {
  if (_repo) return _repo;
  const dbPath = process.env.DATABASE_URL?.replace(/^file:/, '') ?? './prisma/dev.db';
  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  const prisma = new PrismaClient({ adapter });
  _repo = new NotificationRepository(prisma);
  return _repo;
}

export const notificationsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({
      type: z.string().optional(),
      isRead: z.boolean().optional(),
      level: z.string().optional(),
      limit: z.number().min(1).max(200).optional(),
      offset: z.number().min(0).optional(),
    }).optional())
    .query(async ({ input }) => {
      const repo = getRepo();
      return repo.findMany(input);
    }),

  unreadCount: protectedProcedure.query(async () => {
    const repo = getRepo();
    return getRepo().findUnreadCount();
  }),

  markAsRead: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    const repo = getRepo();
    await repo.markAsRead(input.id);
    return { success: true };
  }),

  markAllAsRead: protectedProcedure.mutation(async () => {
    const repo = getRepo();
    await repo.markAllAsRead();
    return { success: true };
  }),

  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    const repo = getRepo();
    await repo.delete(input.id);
    return { success: true };
  }),
});
