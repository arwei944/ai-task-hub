import { z } from 'zod';
import { createTRPCRouter, publicProcedure, protectedProcedure, adminProcedure } from './server';

export const authRouter = createTRPCRouter({
  // Register new user
  register: publicProcedure
    .input(z.object({
      username: z.string().min(3).max(32),
      email: z.string().email(),
      password: z.string().min(6).max(128),
      displayName: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      return ctx.services.authService.register(input);
    }),

  // Login
  login: publicProcedure
    .input(z.object({
      username: z.string(),
      password: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      return ctx.services.authService.login(input);
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
      await ctx.services.authService.changePassword(ctx.user.id, input.oldPassword, input.newPassword);
      return { success: true };
    }),

  // List all users (admin only)
  listUsers: adminProcedure
    .input(z.object({
      role: z.string().optional(),
      isActive: z.boolean().optional(),
    }).optional())
    .query(async ({ input, ctx }) => {
      return ctx.services.userRepo.list(input);
    }),

  // Update user role (admin only)
  updateRole: adminProcedure
    .input(z.object({
      userId: z.string(),
      role: z.enum(['admin', 'user', 'agent']),
    }))
    .mutation(async ({ input, ctx }) => {
      return ctx.services.userRepo.update(input.userId, { role: input.role });
    }),

  // Toggle user active status (admin only)
  toggleUser: adminProcedure
    .input(z.object({
      userId: z.string(),
      isActive: z.boolean(),
    }))
    .mutation(async ({ input, ctx }) => {
      return ctx.services.userRepo.update(input.userId, { isActive: input.isActive });
    }),
});
