import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventBus } from '@/lib/core/event-bus';
import { Logger } from '@/lib/core/logger';
import { ModuleRegistry } from '@/lib/core/registry';
import { DIContainer } from '@/lib/core/di-container';
import { ConfigAccessor } from '@/lib/core/config';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { ModuleVersionRepository } from '@/lib/modules/module-updater/module-version.repository';
import { AppVersionRepository } from '@/lib/modules/module-updater/app-version.repository';
import { ModuleUpdaterService } from '@/lib/modules/module-updater/module-updater.service';
import type { Module } from '@/lib/core/types';
import { join } from 'node:path';

const TEST_DB_PATH = join(process.cwd(), 'test-db', 'test-task-core.db');

// SQL to create new tables if they don't exist
const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS "AppVersion" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "version" TEXT NOT NULL,
  "channel" TEXT NOT NULL DEFAULT 'stable',
  "releaseNotes" TEXT,
  "checksum" TEXT,
  "isCurrent" BOOLEAN NOT NULL DEFAULT false,
  "publishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "AppVersion_version_key" ON "AppVersion"("version");
CREATE INDEX IF NOT EXISTS "AppVersion_channel_idx" ON "AppVersion"("channel");
CREATE INDEX IF NOT EXISTS "AppVersion_isCurrent_idx" ON "AppVersion"("isCurrent");
CREATE INDEX IF NOT EXISTS "AppVersion_publishedAt_idx" ON "AppVersion"("publishedAt");

CREATE TABLE IF NOT EXISTS "ModuleVersion" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "moduleId" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "previousVersion" TEXT,
  "changelog" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "configSnapshot" TEXT,
  "deployedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ModuleVersion_moduleId_idx" ON "ModuleVersion"("moduleId");
CREATE INDEX IF NOT EXISTS "ModuleVersion_version_idx" ON "ModuleVersion"("version");
CREATE INDEX IF NOT EXISTS "ModuleVersion_status_idx" ON "ModuleVersion"("status");
CREATE INDEX IF NOT EXISTS "ModuleVersion_deployedAt_idx" ON "ModuleVersion"("deployedAt");
`;

// Simple test module
class TestModule implements Module {
  id = 'test-module';
  name = 'Test Module';
  version = '1.0.0';
  description = 'Module for testing hot update';
  enabled = false;

  lifecycle = {
    install: async () => { this.enabled = false; },
    enable: async () => { this.enabled = true; },
    disable: async () => { this.enabled = false; },
    uninstall: async () => {},
  };
}

function createTestServices() {
  const adapter = new PrismaBetterSqlite3({ url: TEST_DB_PATH });
  const prisma = new PrismaClient({ adapter });
  const eventBus = new EventBus();
  const container = new DIContainer();
  const config = new ConfigAccessor();
  const logger = new Logger('test');

  // Register core services required by ModuleRegistry.createContext
  container.register('EventBus', () => eventBus);
  container.register('DIContainer', () => container);
  container.register('ModuleRegistry', () => new ModuleRegistry(eventBus, container));
  container.register('ConfigAccessor', () => config);
  container.register('Logger', () => logger);
  container.register('DatabaseAccessor', () => ({
    query: async () => [],
    execute: async () => {},
    transaction: async <T>(fn: () => Promise<T>) => fn(),
  }));

  const registry = new ModuleRegistry(eventBus, container);

  const moduleVersionRepo = new ModuleVersionRepository(prisma);
  const appVersionRepo = new AppVersionRepository(prisma);

  const updaterService = new ModuleUpdaterService(
    moduleVersionRepo,
    appVersionRepo,
    registry,
    eventBus,
    logger,
  );

  return { prisma, eventBus, container, registry, logger, moduleVersionRepo, appVersionRepo, updaterService };
}

describe('ModuleUpdaterService', () => {
  let services: ReturnType<typeof createTestServices>;

  beforeEach(async () => {
    services = createTestServices();
    // Ensure tables exist in test DB
    for (const stmt of CREATE_TABLES_SQL.split(';').filter(s => s.trim())) {
      await services.prisma.$executeRawUnsafe(stmt);
    }
    await services.prisma.moduleVersion.deleteMany();
    await services.prisma.appVersion.deleteMany();
  });

  afterEach(async () => {
    await services.prisma.$disconnect();
  });

  describe('Module hot reload', () => {
    it('should return error for non-existent module', async () => {
      const result = await services.updaterService.hotReload('non-existent');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should hot reload an enabled module', async () => {
      const testModule = new TestModule();
      services.registry.register(testModule);
      await services.registry.enable('test-module');

      const result = await services.updaterService.hotReload('test-module', 'test reason');
      expect(result.success).toBe(true);
      expect(result.action).toBe('reloaded');
      expect(result.moduleId).toBe('test-module');
      expect(result.duration).toBeDefined();
    });

    it('should prevent concurrent updates', async () => {
      const testModule = new TestModule();
      services.registry.register(testModule);
      await services.registry.enable('test-module');

      // Start two concurrent reloads
      const [r1, r2] = await Promise.all([
        services.updaterService.hotReload('test-module'),
        services.updaterService.hotReload('test-module'),
      ]);

      // One should succeed, one should fail
      const successes = [r1, r2].filter(r => r.success).length;
      expect(successes).toBe(1);
    });
  });

  describe('Module enable/disable', () => {
    it('should enable a registered module', async () => {
      const testModule = new TestModule();
      services.registry.register(testModule);

      const result = await services.updaterService.enableModule('test-module');
      expect(result.success).toBe(true);
      expect(result.action).toBe('enabled');
    });

    it('should disable an enabled module', async () => {
      const testModule = new TestModule();
      services.registry.register(testModule);
      await services.registry.enable('test-module');

      const result = await services.updaterService.disableModule('test-module');
      expect(result.success).toBe(true);
      expect(result.action).toBe('disabled');
    });

    it('should return error when enabling non-existent module', async () => {
      const result = await services.updaterService.enableModule('non-existent');
      expect(result.success).toBe(false);
    });
  });

  describe('Module update info', () => {
    it('should return update info for all modules', () => {
      const testModule = new TestModule();
      services.registry.register(testModule);

      const infos = services.updaterService.getAllModuleUpdateInfo();
      expect(infos.length).toBeGreaterThan(0);
      expect(infos.some(i => i.moduleId === 'test-module')).toBe(true);
    });

    it('should return update info for specific module', () => {
      const testModule = new TestModule();
      services.registry.register(testModule);

      const info = services.updaterService.getModuleUpdateInfo('test-module');
      expect(info.moduleId).toBe('test-module');
      expect(info.currentVersion).toBe('1.0.0');
      expect(info.status).toBe('idle');
    });
  });

  describe('Update history', () => {
    it('should track update history', async () => {
      const testModule = new TestModule();
      services.registry.register(testModule);
      await services.registry.enable('test-module');

      await services.updaterService.hotReload('test-module', 'first reload');
      await services.updaterService.hotReload('test-module', 'second reload');

      const info = services.updaterService.getModuleUpdateInfo('test-module');
      expect(info.updateHistory.length).toBe(2);
      expect(info.updateHistory[0].action).toBe('reloaded');
    });
  });
});

describe('AppVersionRepository', () => {
  let services: ReturnType<typeof createTestServices>;

  beforeEach(async () => {
    services = createTestServices();
    for (const stmt of CREATE_TABLES_SQL.split(';').filter(s => s.trim())) {
      await services.prisma.$executeRawUnsafe(stmt);
    }
    await services.prisma.appVersion.deleteMany();
  });

  afterEach(async () => {
    await services.prisma.$disconnect();
  });

  it('should create and retrieve app version', async () => {
    await services.appVersionRepo.create({
      version: '1.0.0',
      channel: 'stable',
      releaseNotes: 'Initial release',
      isCurrent: true,
    });

    const current = await services.appVersionRepo.getCurrent();
    expect(current).not.toBeNull();
    expect(current!.version).toBe('1.0.0');
  });

  it('should only have one current version', async () => {
    await services.appVersionRepo.create({ version: '1.0.0', isCurrent: true });
    await services.appVersionRepo.create({ version: '1.1.0', isCurrent: true });

    const current = await services.appVersionRepo.getCurrent();
    expect(current!.version).toBe('1.1.0');

    const all = await services.appVersionRepo.list();
    const currents = all.filter(v => v.isCurrent);
    expect(currents.length).toBe(1);
  });

  it('should list versions by channel', async () => {
    await services.appVersionRepo.create({ version: '1.0.0', channel: 'stable' });
    await services.appVersionRepo.create({ version: '2.0.0-beta', channel: 'beta' });

    const stable = await services.appVersionRepo.list('stable');
    expect(stable.length).toBe(1);
    expect(stable[0].version).toBe('1.0.0');
  });

  it('should set current version', async () => {
    await services.appVersionRepo.create({ version: '1.0.0', isCurrent: true });
    await services.appVersionRepo.create({ version: '2.0.0' });

    await services.appVersionRepo.setCurrent('2.0.0');

    const current = await services.appVersionRepo.getCurrent();
    expect(current!.version).toBe('2.0.0');
  });
});

describe('ModuleVersionRepository', () => {
  let services: ReturnType<typeof createTestServices>;

  beforeEach(async () => {
    services = createTestServices();
    for (const stmt of CREATE_TABLES_SQL.split(';').filter(s => s.trim())) {
      await services.prisma.$executeRawUnsafe(stmt);
    }
    await services.prisma.moduleVersion.deleteMany();
  });

  afterEach(async () => {
    await services.prisma.$disconnect();
  });

  it('should create and retrieve module version', async () => {
    await services.moduleVersionRepo.create({
      moduleId: 'test-module',
      version: '1.0.0',
      changelog: 'Initial version',
    });

    const versions = await services.moduleVersionRepo.findByModuleId('test-module');
    expect(versions.length).toBe(1);
    expect(versions[0].version).toBe('1.0.0');
  });

  it('should find latest version', async () => {
    await services.moduleVersionRepo.create({ moduleId: 'test-module', version: '1.0.0' });
    await services.moduleVersionRepo.create({ moduleId: 'test-module', version: '1.1.0' });

    const latest = await services.moduleVersionRepo.findLatest('test-module');
    expect(latest!.version).toBe('1.1.0');
  });

  it('should find previous version for rollback', async () => {
    await services.moduleVersionRepo.create({ moduleId: 'test-module', version: '1.0.0' });
    await services.moduleVersionRepo.create({ moduleId: 'test-module', version: '1.1.0' });

    const previous = await services.moduleVersionRepo.findPrevious('test-module', '1.1.0');
    expect(previous).not.toBeNull();
    expect(previous!.version).toBe('1.0.0');
  });

  it('should update version status', async () => {
    const created = await services.moduleVersionRepo.create({
      moduleId: 'test-module',
      version: '1.0.0',
    });

    await services.moduleVersionRepo.updateStatus(created.id, 'rollback');

    const versions = await services.moduleVersionRepo.findByModuleId('test-module');
    expect(versions[0].status).toBe('rollback');
  });
});

describe('Version Check', () => {
  let services: ReturnType<typeof createTestServices>;

  beforeEach(async () => {
    services = createTestServices();
    for (const stmt of CREATE_TABLES_SQL.split(';').filter(s => s.trim())) {
      await services.prisma.$executeRawUnsafe(stmt);
    }
    await services.prisma.appVersion.deleteMany();
  });

  afterEach(async () => {
    await services.prisma.$disconnect();
  });

  it('should report no update when no versions exist', async () => {
    const result = await services.updaterService.checkForUpdates();
    expect(result.hasUpdate).toBe(false);
    expect(result.currentVersion).toBe('0.0.0');
  });

  it('should detect available update', async () => {
    await services.appVersionRepo.create({ version: '1.0.0', isCurrent: true });
    await services.appVersionRepo.create({ version: '2.0.0', channel: 'stable' });

    const result = await services.updaterService.checkForUpdates('stable');
    expect(result.hasUpdate).toBe(true);
    expect(result.currentVersion).toBe('1.0.0');
    expect(result.latestVersion).toBe('2.0.0');
  });

  it('should publish new version', async () => {
    const version = await services.updaterService.publishVersion({
      version: '1.0.0',
      channel: 'stable',
      releaseNotes: 'First release',
      setAsCurrent: true,
    });

    expect(version.version).toBe('1.0.0');
    expect(version.isCurrent).toBe(true);
  });
});
