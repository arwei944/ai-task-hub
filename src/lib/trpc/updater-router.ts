import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, adminProcedure } from './server';
import { Logger } from '@/lib/core/logger';
import { EventBus } from '@/lib/core/event-bus';
import { ModuleRegistry } from '@/lib/core/registry';
import { DIContainer } from '@/lib/core/di-container';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { ModuleVersionRepository } from '@/lib/modules/module-updater/module-version.repository';
import { AppVersionRepository } from '@/lib/modules/module-updater/app-version.repository';
import { ModuleUpdaterService } from '@/lib/modules/module-updater/module-updater.service';

// Lazy-initialized services
let _updaterService: ModuleUpdaterService | null = null;

function getServices() {
  if (_updaterService) return { updaterService: _updaterService };

  const dbPath = process.env.DATABASE_URL?.replace(/^file:/, '') ?? './prisma/dev.db';
  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  const prisma = new PrismaClient({ adapter });
  const eventBus = new EventBus();
  const container = new DIContainer();
  const registry = new ModuleRegistry(eventBus, container);
  const logger = new Logger('module-updater');

  const moduleVersionRepo = new ModuleVersionRepository(prisma);
  const appVersionRepo = new AppVersionRepository(prisma);

  _updaterService = new ModuleUpdaterService(
    moduleVersionRepo,
    appVersionRepo,
    registry,
    eventBus,
    logger,
  );

  return { updaterService: _updaterService };
}

export const updaterRouter = createTRPCRouter({
  // List all modules with their update info
  listModules: protectedProcedure.query(() => {
    const { updaterService } = getServices();
    return updaterService.getAllModuleUpdateInfo();
  }),

  // Get update info for a specific module
  getModuleInfo: protectedProcedure
    .input(z.object({ moduleId: z.string() }))
    .query(({ input }) => {
      const { updaterService } = getServices();
      return updaterService.getModuleUpdateInfo(input.moduleId);
    }),

  // Hot reload a module
  hotReload: adminProcedure
    .input(z.object({
      moduleId: z.string(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { updaterService } = getServices();
      return updaterService.hotReload(input.moduleId, input.reason);
    }),

  // Enable a module at runtime
  enableModule: adminProcedure
    .input(z.object({ moduleId: z.string() }))
    .mutation(async ({ input }) => {
      const { updaterService } = getServices();
      return updaterService.enableModule(input.moduleId);
    }),

  // Disable a module at runtime
  disableModule: adminProcedure
    .input(z.object({ moduleId: z.string() }))
    .mutation(async ({ input }) => {
      const { updaterService } = getServices();
      return updaterService.disableModule(input.moduleId);
    }),

  // Rollback a module to previous version
  rollback: adminProcedure
    .input(z.object({ moduleId: z.string() }))
    .mutation(async ({ input }) => {
      const { updaterService } = getServices();
      return updaterService.rollback(input.moduleId);
    }),

  // Check for app updates
  checkUpdates: protectedProcedure
    .input(z.object({ channel: z.string().optional() }).optional())
    .mutation(async ({ input }) => {
      const { updaterService } = getServices();
      return updaterService.checkForUpdates(input?.channel);
    }),

  // Get app version history
  versionHistory: protectedProcedure
    .input(z.object({ channel: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const { updaterService } = getServices();
      return updaterService.getVersionHistory(input?.channel);
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
    .mutation(async ({ input }) => {
      const { updaterService } = getServices();
      return updaterService.publishVersion(input);
    }),

  // Get module version history
  moduleVersionHistory: protectedProcedure
    .input(z.object({ moduleId: z.string() }))
    .query(async ({ input }) => {
      const { updaterService } = getServices();
      return updaterService.getModuleVersionHistory(input.moduleId);
    }),
});
