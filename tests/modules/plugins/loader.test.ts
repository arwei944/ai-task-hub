import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PluginLoader } from '@/lib/modules/plugins/plugin-loader';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { Logger } from '@/lib/core/logger';
import { EventBus } from '@/lib/core/event-bus';
import { join } from 'node:path';

const TEST_DB_PATH = join(process.cwd(), 'test-db', 'test-task-core.db');

function createLoader() {
  const adapter = new PrismaBetterSqlite3({ url: TEST_DB_PATH });
  const prisma = new PrismaClient({ adapter });
  const logger = new Logger('test');
  const eventBus = new EventBus();
  return { loader: new PluginLoader(prisma, eventBus, logger), prisma, eventBus };
}

describe('PluginLoader', () => {
  let loader: PluginLoader;
  let prisma: PrismaClient;
  let eventBus: EventBus;

  beforeEach(async () => {
    const services = createLoader();
    loader = services.loader;
    prisma = services.prisma;
    eventBus = services.eventBus;
    await prisma.plugin.deleteMany();
  });

  afterEach(async () => {
    await prisma.$disconnect();
  });

  // --- 安装 ---

  it('should install a new plugin', async () => {
    const plugin = await loader.install({
      name: 'test-plugin',
      displayName: 'Test Plugin',
      version: '1.0.0',
      entryPoint: './plugins/test/index.ts',
    });

    expect(plugin.id).toBeDefined();
    expect(plugin.name).toBe('test-plugin');
    expect(plugin.displayName).toBe('Test Plugin');
    expect(plugin.version).toBe('1.0.0');
    expect(plugin.isEnabled).toBe(true);
  });

  it('should install plugin with all optional fields', async () => {
    const plugin = await loader.install({
      name: 'full-plugin',
      displayName: 'Full Plugin',
      description: 'A full plugin',
      version: '2.0.0',
      author: 'Test Author',
      homepage: 'https://example.com',
      license: 'MIT',
      entryPoint: './plugins/full/index.ts',
      configSchema: { type: 'object' },
      settingsSchema: { type: 'object' },
    });

    expect(plugin.description).toBe('A full plugin');
    expect(plugin.author).toBe('Test Author');
    expect(plugin.homepage).toBe('https://example.com');
    expect(plugin.license).toBe('MIT');
    expect(plugin.config).toEqual({});
    expect(plugin.settings).toEqual({});
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

  it('should emit plugin.installed event', async () => {
    const eventSpy = vi.fn();
    eventBus.on('plugin.installed', eventSpy);

    await loader.install({
      name: 'test-plugin',
      displayName: 'Test',
      version: '1.0.0',
      entryPoint: './plugins/test/index.ts',
    });

    expect(eventSpy).toHaveBeenCalled();
    const event = eventSpy.mock.calls[0][0];
    expect(event.type).toBe('plugin.installed');
    expect(event.payload.name).toBe('test-plugin');
  });

  // --- 列表 ---

  it('should list all installed plugins', async () => {
    await loader.install({ name: 'plugin-a', displayName: 'Plugin A', version: '1.0.0', entryPoint: './a' });
    await loader.install({ name: 'plugin-b', displayName: 'Plugin B', version: '1.0.0', entryPoint: './b' });

    const plugins = await loader.list();
    expect(plugins.length).toBe(2);
  });

  it('should return empty list when no plugins', async () => {
    const plugins = await loader.list();
    expect(plugins.length).toBe(0);
  });

  // --- 获取 ---

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

  // --- 启用/禁用 ---

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

  it('should emit plugin.enabled event', async () => {
    await loader.install({ name: 'test-plugin', displayName: 'Test', version: '1.0.0', entryPoint: './test' });
    await loader.disable('test-plugin');

    const eventSpy = vi.fn();
    eventBus.on('plugin.enabled', eventSpy);

    await loader.enable('test-plugin');
    expect(eventSpy).toHaveBeenCalled();
  });

  it('should emit plugin.disabled event', async () => {
    await loader.install({ name: 'test-plugin', displayName: 'Test', version: '1.0.0', entryPoint: './test' });

    const eventSpy = vi.fn();
    eventBus.on('plugin.disabled', eventSpy);

    await loader.disable('test-plugin');
    expect(eventSpy).toHaveBeenCalled();
  });

  // --- 卸载 ---

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

  it('should emit plugin.uninstalled event', async () => {
    await loader.install({ name: 'test-plugin', displayName: 'Test', version: '1.0.0', entryPoint: './test' });

    const eventSpy = vi.fn();
    eventBus.on('plugin.uninstalled', eventSpy);

    await loader.uninstall('test-plugin');
    expect(eventSpy).toHaveBeenCalled();
  });

  // --- 设置 ---

  it('should update plugin settings', async () => {
    await loader.install({
      name: 'test-plugin',
      displayName: 'Test',
      version: '1.0.0',
      entryPoint: './plugins/test/index.ts',
      settingsSchema: { type: 'object' },
    });

    await loader.updateSettings('test-plugin', { key1: 'value1', key2: 42 });

    const plugin = await loader.get('test-plugin');
    expect(plugin!.settings).toEqual({ key1: 'value1', key2: 42 });
  });

  // --- 加载计数 ---

  it('should start with no loaded plugins', () => {
    expect(loader.getLoadedCount()).toBe(0);
  });

  // --- 自定义工具 ---

  it('should start with no custom tools', () => {
    const tools = loader.getCustomTools();
    expect(tools.length).toBe(0);
  });

  // --- 错误路径 ---

  it('should throw when enabling non-existent plugin', async () => {
    await expect(loader.enable('non-existent')).rejects.toThrow();
  });

  it('should throw when disabling non-existent plugin', async () => {
    await expect(loader.disable('non-existent')).rejects.toThrow();
  });

  it('should throw when uninstalling non-existent plugin', async () => {
    await expect(loader.uninstall('non-existent')).rejects.toThrow();
  });

  it('should throw when loading non-existent plugin', async () => {
    await expect(loader.load('non-existent')).rejects.toThrow('未找到');
  });
});
