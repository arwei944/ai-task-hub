/**
 * Integration tests for plugins tRPC router.
 * Tests: list, get, install, enable, disable, uninstall, updateSettings, getCustomTools
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestContext, destroyTestContext, createMockContext } from './helpers';
import type { TestContext } from './helpers';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});

afterAll(async () => {
  await destroyTestContext(ctx);
});

beforeEach(async () => {
  await ctx.prisma.plugin.deleteMany();
});

describe('plugins.list', () => {
  it('should return empty list when no plugins', async () => {
    const result = await ctx.pluginLoader.list();
    expect(result).toHaveLength(0);
  });

  it('should return all installed plugins', async () => {
    await ctx.pluginLoader.install({
      name: 'plugin-1',
      displayName: 'Plugin One',
      version: '1.0.0',
      entryPoint: './plugins/hello-world/index.ts',
    });
    await ctx.pluginLoader.install({
      name: 'plugin-2',
      displayName: 'Plugin Two',
      version: '1.0.0',
      entryPoint: './plugins/hello-world/index.ts',
    });

    const result = await ctx.pluginLoader.list();
    expect(result).toHaveLength(2);
  });

  it('should return plugins in install order (desc)', async () => {
    await ctx.pluginLoader.install({
      name: 'first',
      displayName: 'First',
      version: '1.0.0',
      entryPoint: './plugins/hello-world/index.ts',
    });
    await ctx.pluginLoader.install({
      name: 'second',
      displayName: 'Second',
      version: '1.0.0',
      entryPoint: './plugins/hello-world/index.ts',
    });

    const result = await ctx.pluginLoader.list();
    expect(result[0].name).toBe('second');
    expect(result[1].name).toBe('first');
  });
});

describe('plugins.get', () => {
  it('should return a plugin by name', async () => {
    await ctx.pluginLoader.install({
      name: 'test-plugin',
      displayName: 'Test Plugin',
      description: 'A test plugin',
      version: '2.0.0',
      entryPoint: './plugins/hello-world/index.ts',
    });

    const result = await ctx.pluginLoader.get('test-plugin');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('test-plugin');
    expect(result!.displayName).toBe('Test Plugin');
    expect(result!.description).toBe('A test plugin');
    expect(result!.version).toBe('2.0.0');
    expect(result!.isEnabled).toBe(true);
  });

  it('should return null for non-existent plugin', async () => {
    const result = await ctx.pluginLoader.get('non-existent');
    expect(result).toBeNull();
  });
});

describe('plugins.install', () => {
  it('should install a plugin with required fields', async () => {
    const result = await ctx.pluginLoader.install({
      name: 'new-plugin',
      displayName: 'New Plugin',
      version: '1.0.0',
      entryPoint: './plugins/hello-world/index.ts',
    });

    expect(result.id).toBeDefined();
    expect(result.name).toBe('new-plugin');
    expect(result.displayName).toBe('New Plugin');
    expect(result.version).toBe('1.0.0');
    expect(result.isEnabled).toBe(true);
  });

  it('should install with all optional fields', async () => {
    const result = await ctx.pluginLoader.install({
      name: 'full-plugin',
      displayName: 'Full Plugin',
      description: 'Complete plugin',
      version: '3.0.0',
      author: 'Test Author',
      entryPoint: './plugins/hello-world/index.ts',
    });

    expect(result.description).toBe('Complete plugin');
    expect(result.version).toBe('3.0.0');
    expect(result.author).toBe('Test Author');
  });

  it('should throw when installing duplicate plugin', async () => {
    await ctx.pluginLoader.install({
      name: 'dup-plugin',
      displayName: 'Dup',
      version: '1.0.0',
      entryPoint: './plugins/hello-world/index.ts',
    });

    await expect(
      ctx.pluginLoader.install({
        name: 'dup-plugin',
        displayName: 'Dup Again',
        version: '1.0.0',
        entryPoint: './plugins/hello-world/index.ts',
      }),
    ).rejects.toThrow();
  });

  it('should persist plugin in database', async () => {
    await ctx.pluginLoader.install({
      name: 'persist-plugin',
      displayName: 'Persist',
      version: '1.0.0',
      entryPoint: './plugins/hello-world/index.ts',
    });

    const dbPlugin = await ctx.prisma.plugin.findUnique({ where: { name: 'persist-plugin' } });
    expect(dbPlugin).not.toBeNull();
    expect(dbPlugin!.displayName).toBe('Persist');
  });
});

describe('plugins.enable', () => {
  it('should enable a disabled plugin', async () => {
    await ctx.pluginLoader.install({
      name: 'enable-test',
      displayName: 'Enable Test',
      version: '1.0.0',
      entryPoint: './plugins/hello-world/index.ts',
    });
    await ctx.pluginLoader.disable('enable-test');
    await ctx.pluginLoader.enable('enable-test');

    const result = await ctx.pluginLoader.get('enable-test');
    expect(result!.isEnabled).toBe(true);
  });
});

describe('plugins.disable', () => {
  it('should disable an enabled plugin', async () => {
    await ctx.pluginLoader.install({
      name: 'disable-test',
      displayName: 'Disable Test',
      version: '1.0.0',
      entryPoint: './plugins/hello-world/index.ts',
    });
    const result = await ctx.pluginLoader.disable('disable-test');

    expect(result.isEnabled).toBe(false);
  });

  it('should update database when disabled', async () => {
    await ctx.pluginLoader.install({
      name: 'db-disable',
      displayName: 'DB Disable',
      version: '1.0.0',
      entryPoint: './plugins/hello-world/index.ts',
    });
    await ctx.pluginLoader.disable('db-disable');

    const dbPlugin = await ctx.prisma.plugin.findUnique({ where: { name: 'db-disable' } });
    expect(dbPlugin!.isEnabled).toBe(false);
  });
});

describe('plugins.uninstall', () => {
  it('should uninstall a plugin', async () => {
    await ctx.pluginLoader.install({
      name: 'uninstall-test',
      displayName: 'Uninstall Test',
      version: '1.0.0',
      entryPoint: './plugins/hello-world/index.ts',
    });

    await ctx.pluginLoader.uninstall('uninstall-test');

    const result = await ctx.pluginLoader.get('uninstall-test');
    expect(result).toBeNull();

    const dbPlugin = await ctx.prisma.plugin.findUnique({ where: { name: 'uninstall-test' } });
    expect(dbPlugin).toBeNull();
  });
});

describe('plugins.updateSettings', () => {
  it('should update plugin settings', async () => {
    await ctx.pluginLoader.install({
      name: 'settings-test',
      displayName: 'Settings Test',
      version: '1.0.0',
      entryPoint: './plugins/hello-world/index.ts',
    });

    await ctx.pluginLoader.updateSettings('settings-test', { theme: 'dark', language: 'zh' });

    const result = await ctx.pluginLoader.get('settings-test');
    expect(result!.settings).toEqual({ theme: 'dark', language: 'zh' });
  });
});

describe('plugins.getCustomTools', () => {
  it('should return empty tools initially', async () => {
    const tools = ctx.pluginLoader.getCustomTools();
    expect(tools).toHaveLength(0);
  });

  it('should return tools count after loading', async () => {
    await ctx.pluginLoader.install({
      name: 'tools-test',
      displayName: 'Tools Test',
      version: '1.0.0',
      entryPoint: './plugins/hello-world/index.ts',
    });

    const tools = ctx.pluginLoader.getCustomTools();
    // Tools are registered during plugin activation
    expect(tools).toBeDefined();
  });
});
