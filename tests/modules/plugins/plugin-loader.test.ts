import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PluginLoader } from '@/lib/modules/plugins/plugin-loader';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { Logger } from '@/lib/core/logger';
import { EventBus } from '@/lib/core/event-bus';
import { join } from 'node:path';

const TEST_DB_PATH = join(process.cwd(), 'test-db', 'test-task-core.db');

const CREATE_PLUGIN_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS "Plugin" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "description" TEXT,
  "version" TEXT NOT NULL DEFAULT '1.0.0',
  "author" TEXT,
  "homepage" TEXT,
  "license" TEXT,
  "entryPoint" TEXT NOT NULL,
  "config" TEXT,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "settings" TEXT,
  "installedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "Plugin_name_key" ON "Plugin"("name");
CREATE INDEX IF NOT EXISTS "Plugin_isEnabled_idx" ON "Plugin"("isEnabled");
`;

function createLoader() {
  const adapter = new PrismaBetterSqlite3({ url: TEST_DB_PATH });
  const prisma = new PrismaClient({ adapter });
  const logger = new Logger('test');
  const eventBus = new EventBus();
  return { loader: new PluginLoader(prisma, eventBus, logger), prisma };
}

describe('PluginLoader', () => {
  let loader: PluginLoader;
  let prisma: PrismaClient;

  beforeEach(async () => {
    const { loader: l, prisma: p } = createLoader();
    loader = l;
    prisma = p;
    for (const stmt of CREATE_PLUGIN_TABLE_SQL.split(';').filter(s => s.trim())) {
      await prisma.$executeRawUnsafe(stmt);
    }
    await prisma.plugin.deleteMany();
  });

  afterEach(async () => {
    await prisma.$disconnect();
  });

  describe('Install', () => {
    it('should install a new plugin', async () => {
      const plugin = await loader.install({
        name: 'test-plugin',
        displayName: 'Test Plugin',
        version: '1.0.0',
        entryPoint: './plugins/test/index.ts',
      });

      expect(plugin.name).toBe('test-plugin');
      expect(plugin.displayName).toBe('Test Plugin');
      expect(plugin.isEnabled).toBe(true);
    });

    it('should not install duplicate plugins', async () => {
      await loader.install({
        name: 'test-plugin',
        displayName: 'Test Plugin',
        version: '1.0.0',
        entryPoint: './plugins/test/index.ts',
      });

      await expect(
        loader.install({
          name: 'test-plugin',
          displayName: 'Test Plugin 2',
          version: '1.0.0',
          entryPoint: './plugins/test/index.ts',
        }),
      ).rejects.toThrow('已安装');
    });
  });

  describe('List', () => {
    it('should list all installed plugins', async () => {
      await loader.install({
        name: 'plugin-a',
        displayName: 'Plugin A',
        version: '1.0.0',
        entryPoint: './plugins/a/index.ts',
      });
      await loader.install({
        name: 'plugin-b',
        displayName: 'Plugin B',
        version: '1.0.0',
        entryPoint: './plugins/b/index.ts',
      });

      const plugins = await loader.list();
      expect(plugins.length).toBe(2);
    });

    it('should return empty list when no plugins', async () => {
      const plugins = await loader.list();
      expect(plugins.length).toBe(0);
    });
  });

  describe('Enable/Disable', () => {
    it('should disable a plugin', async () => {
      await loader.install({
        name: 'test-plugin',
        displayName: 'Test',
        version: '1.0.0',
        entryPoint: './plugins/test/index.ts',
      });

      const disabled = await loader.disable('test-plugin');
      expect(disabled.isEnabled).toBe(false);
    });

    it('should enable a disabled plugin', async () => {
      await loader.install({
        name: 'test-plugin',
        displayName: 'Test',
        version: '1.0.0',
        entryPoint: './plugins/test/index.ts',
      });

      await loader.disable('test-plugin');
      const enabled = await loader.enable('test-plugin');
      expect(enabled.isEnabled).toBe(true);
    });
  });

  describe('Uninstall', () => {
    it('should uninstall a plugin', async () => {
      await loader.install({
        name: 'test-plugin',
        displayName: 'Test',
        version: '1.0.0',
        entryPoint: './plugins/test/index.ts',
      });

      await loader.uninstall('test-plugin');
      const plugins = await loader.list();
      expect(plugins.length).toBe(0);
    });
  });

  describe('Get', () => {
    it('should get a plugin by name', async () => {
      await loader.install({
        name: 'test-plugin',
        displayName: 'Test Plugin',
        description: 'A test plugin',
        version: '1.0.0',
        entryPoint: './plugins/test/index.ts',
      });

      const plugin = await loader.get('test-plugin');
      expect(plugin).not.toBeNull();
      expect(plugin!.displayName).toBe('Test Plugin');
    });

    it('should return null for non-existent plugin', async () => {
      const plugin = await loader.get('non-existent');
      expect(plugin).toBeNull();
    });
  });

  describe('Custom Tools', () => {
    it('should start with no custom tools', () => {
      const tools = loader.getCustomTools();
      expect(tools.length).toBe(0);
    });
  });
});
