import { z } from 'zod';
import { createTRPCRouter, publicProcedure, protectedProcedure, adminProcedure } from './server';
import { AuthService } from '@/lib/modules/auth/auth.service';
import { UserRepository } from '@/lib/modules/auth/user.repository';
import { Logger } from '@/lib/core/logger';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

// Lazy-initialized
let _authService: AuthService | null = null;
let _userRepo: UserRepository | null = null;

function getServices() {
  if (_authService && _userRepo) return { authService: _authService, userRepo: _userRepo };

  const dbPath = process.env.DATABASE_URL?.replace(/^file:/, '') ?? './prisma/dev.db';
  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  const prisma = new PrismaClient({ adapter });
  const logger = new Logger('auth');

  _userRepo = new UserRepository(prisma);
  _authService = new AuthService(_userRepo, logger);

  return { authService: _authService, userRepo: _userRepo };
}

export const authRouter = createTRPCRouter({
  // Register new user
  register: publicProcedure
    .input(z.object({
      username: z.string().min(3).max(32),
      email: z.string().email(),
      password: z.string().min(6).max(128),
      displayName: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { authService } = getServices();
      return authService.register(input);
    }),

  // Login
  login: publicProcedure
    .input(z.object({
      username: z.string(),
      password: z.string(),
    }))
    .mutation(async ({ input }) => {
      const { authService } = getServices();
      return authService.login(input);
    }),

  // Get current user
  me: protectedProcedure.query(({ ctx }) => {
    return ctx.user;
  }),

  // Change password
  changePassword: protectedProcedure
    .input(z.object({
      oldPassword: z.string(),
      newPassword: z.string().min(6).max(128),
    }))
    .mutation(async ({ input, ctx }) => {
      const { authService } = getServices();
      await authService.changePassword(ctx.user.id, input.oldPassword, input.newPassword);
      return { success: true };
    }),

  // List all users (admin only)
  listUsers: adminProcedure
    .input(z.object({
      role: z.string().optional(),
      isActive: z.boolean().optional(),
    }).optional())
    .query(async ({ input }) => {
      const { userRepo } = getServices();
      return userRepo.list(input);
    }),

  // Update user role (admin only)
  updateRole: adminProcedure
    .input(z.object({
      userId: z.string(),
      role: z.enum(['admin', 'user', 'agent']),
    }))
    .mutation(async ({ input }) => {
      const { userRepo } = getServices();
      return userRepo.update(input.userId, { role: input.role });
    }),

  // Toggle user active status (admin only)
  toggleUser: adminProcedure
    .input(z.object({
      userId: z.string(),
      isActive: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      const { userRepo } = getServices();
      return userRepo.update(input.userId, { isActive: input.isActive });
    }),
});
