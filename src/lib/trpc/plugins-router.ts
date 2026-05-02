import { z } from 'zod';
import { createTRPCRouter, publicProcedure, protectedProcedure, adminProcedure } from './server';

export const pluginsRouter = createTRPCRouter({
  // List all plugins
  list: protectedProcedure.query(async ({ ctx }) => {
    const loader = ctx.services.pluginLoader;
    return loader.list();
  }),

  // Get a specific plugin
  get: protectedProcedure
    .input(z.object({ name: z.string() }))
    .query(async ({ input, ctx }) => {
      const loader = ctx.services.pluginLoader;
      return loader.get(input.name);
    }),

  // Install a new plugin (admin only)
  install: adminProcedure
    .input(z.object({
      name: z.string().min(1).max(64),
      displayName: z.string().min(1).max(128),
      description: z.string().optional(),
      version: z.string().default('').optional(),
      author: z.string().optional(),
      entryPoint: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const loader = ctx.services.pluginLoader;
      return loader.install(input);
    }),

  // Enable a plugin (admin only)
  enable: adminProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const loader = ctx.services.pluginLoader;
      return loader.enable(input.name);
    }),

  // Disable a plugin (admin only)
  disable: adminProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const loader = ctx.services.pluginLoader;
      return loader.disable(input.name);
    }),

  // Uninstall a plugin (admin only)
  uninstall: adminProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const loader = ctx.services.pluginLoader;
      await loader.uninstall(input.name);
      return { success: true };
    }),

  // Update plugin settings (admin only)
  updateSettings: adminProcedure
    .input(z.object({
      name: z.string(),
      settings: z.record(z.string(), z.unknown()),
    }))
    .mutation(async ({ input, ctx }) => {
      const loader = ctx.services.pluginLoader;
      await loader.updateSettings(input.name, input.settings);
      return { success: true };
    }),

  // Get registered custom tools from plugins
  getCustomTools: protectedProcedure.query(async ({ ctx }) => {
    const loader = ctx.services.pluginLoader;
    return loader.getCustomTools();
  }),
});
