import { z } from 'zod';
import { createTRPCRouter, publicProcedure, protectedProcedure, adminProcedure } from './server';

let _pluginLoader: any = null;

async function getPluginLoader() {
  if (_pluginLoader) return _pluginLoader;

  const { getPrisma } = await import('@/lib/db');
  const { PluginLoader } = await import('@/lib/modules/plugins/plugin-loader');
  const { Logger } = await import('@/lib/core/logger');
  const { EventBus } = await import('@/lib/core/event-bus');
  const { APP_VERSION } = await import('@/lib/core/version');

  const prisma = getPrisma();
  const logger = new Logger('plugin');
  const eventBus = new EventBus();

  _pluginLoader = new PluginLoader(prisma, eventBus, logger);
  return _pluginLoader;
}

export const pluginsRouter = createTRPCRouter({
  // List all plugins
  list: protectedProcedure.query(async () => {
    const loader = await getPluginLoader();
    return loader.list();
  }),

  // Get a specific plugin
  get: protectedProcedure
    .input(z.object({ name: z.string() }))
    .query(async ({ input }) => {
      const loader = await getPluginLoader();
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
    .mutation(async ({ input }) => {
      const loader = await getPluginLoader();
      return loader.install(input);
    }),

  // Enable a plugin (admin only)
  enable: adminProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ input }) => {
      const loader = await getPluginLoader();
      return loader.enable(input.name);
    }),

  // Disable a plugin (admin only)
  disable: adminProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ input }) => {
      const loader = await getPluginLoader();
      return loader.disable(input.name);
    }),

  // Uninstall a plugin (admin only)
  uninstall: adminProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ input }) => {
      const loader = await getPluginLoader();
      await loader.uninstall(input.name);
      return { success: true };
    }),

  // Update plugin settings (admin only)
  updateSettings: adminProcedure
    .input(z.object({
      name: z.string(),
      settings: z.record(z.string(), z.unknown()),
    }))
    .mutation(async ({ input }) => {
      const loader = await getPluginLoader();
      await loader.updateSettings(input.name, input.settings);
      return { success: true };
    }),

  // Get registered custom tools from plugins
  getCustomTools: protectedProcedure.query(async () => {
    const loader = await getPluginLoader();
    return loader.getCustomTools();
  }),
});
