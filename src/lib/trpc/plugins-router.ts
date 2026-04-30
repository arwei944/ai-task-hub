import { z } from 'zod';
import { createTRPCRouter, publicProcedure, protectedProcedure, adminProcedure } from './server';
import { PluginLoader } from '@/lib/modules/plugins/plugin-loader';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { Logger } from '@/lib/core/logger';
import { EventBus } from '@/lib/core/event-bus';
import { APP_VERSION } from '@/lib/core/version';

let _pluginLoader: PluginLoader | null = null;

function getPluginLoader(): PluginLoader {
  if (_pluginLoader) return _pluginLoader;

  const dbPath = process.env.DATABASE_URL?.replace(/^file:/, '') ?? './prisma/dev.db';
  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  const prisma = new PrismaClient({ adapter });
  const logger = new Logger('plugin');
  const eventBus = new EventBus();

  _pluginLoader = new PluginLoader(prisma, eventBus, logger);
  return _pluginLoader;
}

export const pluginsRouter = createTRPCRouter({
  // List all plugins
  list: protectedProcedure.query(async () => {
    const loader = getPluginLoader();
    return loader.list();
  }),

  // Get a specific plugin
  get: protectedProcedure
    .input(z.object({ name: z.string() }))
    .query(async ({ input }) => {
      const loader = getPluginLoader();
      return loader.get(input.name);
    }),

  // Install a new plugin (admin only)
  install: adminProcedure
    .input(z.object({
      name: z.string().min(1).max(64),
      displayName: z.string().min(1).max(128),
      description: z.string().optional(),
      version: z.string().default(APP_VERSION),
      author: z.string().optional(),
      entryPoint: z.string(),
    }))
    .mutation(async ({ input }) => {
      const loader = getPluginLoader();
      return loader.install(input);
    }),

  // Enable a plugin (admin only)
  enable: adminProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ input }) => {
      const loader = getPluginLoader();
      return loader.enable(input.name);
    }),

  // Disable a plugin (admin only)
  disable: adminProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ input }) => {
      const loader = getPluginLoader();
      return loader.disable(input.name);
    }),

  // Uninstall a plugin (admin only)
  uninstall: adminProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ input }) => {
      const loader = getPluginLoader();
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
      const loader = getPluginLoader();
      await loader.updateSettings(input.name, input.settings);
      return { success: true };
    }),

  // Get registered custom tools from plugins
  getCustomTools: protectedProcedure.query(async () => {
    const loader = getPluginLoader();
    return loader.getCustomTools();
  }),
});
