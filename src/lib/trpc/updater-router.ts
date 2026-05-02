import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, adminProcedure } from './server';

export const updaterRouter = createTRPCRouter({
  // List all modules with their update info
  listModules: protectedProcedure.query(({ ctx }) => {
    return ctx.services.moduleUpdaterService.getAllModuleUpdateInfo();
  }),

  // Get update info for a specific module
  getModuleInfo: protectedProcedure
    .input(z.object({ moduleId: z.string() }))
    .query(({ input, ctx }) => {
      return ctx.services.moduleUpdaterService.getModuleUpdateInfo(input.moduleId);
    }),

  // Hot reload a module
  hotReload: adminProcedure
    .input(z.object({
      moduleId: z.string(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      return ctx.services.moduleUpdaterService.hotReload(input.moduleId, input.reason);
    }),

  // Enable a module at runtime
  enableModule: adminProcedure
    .input(z.object({ moduleId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return ctx.services.moduleUpdaterService.enableModule(input.moduleId);
    }),

  // Disable a module at runtime
  disableModule: adminProcedure
    .input(z.object({ moduleId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return ctx.services.moduleUpdaterService.disableModule(input.moduleId);
    }),

  // Rollback a module to previous version
  rollback: adminProcedure
    .input(z.object({ moduleId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return ctx.services.moduleUpdaterService.rollback(input.moduleId);
    }),

  // Check for app updates
  checkUpdates: protectedProcedure
    .input(z.object({ channel: z.string().optional() }).optional())
    .mutation(async ({ input, ctx }) => {
      return ctx.services.moduleUpdaterService.checkForUpdates(input?.channel);
    }),

  // Get app version history
  versionHistory: protectedProcedure
    .input(z.object({ channel: z.string().optional() }).optional())
    .query(async ({ input, ctx }) => {
      return ctx.services.moduleUpdaterService.getVersionHistory(input?.channel);
    }),

  // Publish a new app version
  publishVersion: adminProcedure
    .input(z.object({
      version: z.string(),
      channel: z.string().optional(),
      releaseNotes: z.string().optional(),
      checksum: z.string().optional(),
      setAsCurrent: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      return ctx.services.moduleUpdaterService.publishVersion(input);
    }),

  // Get module version history
  moduleVersionHistory: protectedProcedure
    .input(z.object({ moduleId: z.string() }))
    .query(async ({ input, ctx }) => {
      return ctx.services.moduleUpdaterService.getModuleVersionHistory(input.moduleId);
    }),
});
