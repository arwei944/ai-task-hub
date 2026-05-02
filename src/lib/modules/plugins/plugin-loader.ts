// ============================================================
// Plugin Loader Service
// ============================================================
//
// Manages plugin lifecycle: install, load, activate, deactivate, unload, remove.
// Plugins are stored in DB and loaded into memory on demand.
//

import type { PrismaClient } from '@/generated/prisma/client';
import type { ILogger } from '@/lib/core/types';
import type {
  PluginInstance,
  PluginRegistry,
  PluginManifest,
  PluginContext,
  CustomToolDefinition,
} from './types';
import { EventBus } from '@/lib/core/event-bus';

export class PluginLoader {
  private loadedPlugins: Map<string, PluginRegistry> = new Map();
  private customTools: Map<string, CustomToolDefinition> = new Map();
  private webhookHandlers: Map<string, (body: unknown) => Promise<unknown>> = new Map();

  constructor(
    private prisma: PrismaClient,
    private eventBus: EventBus,
    private logger?: ILogger,
  ) {}

  /**
   * Install a new plugin from manifest
   */
  async install(manifest: PluginManifest): Promise<PluginInstance> {
    // Check if plugin already exists
    const existing = await this.prisma.plugin.findUnique({ where: { name: manifest.name } });
    if (existing) {
      throw new Error(`插件 "${manifest.name}" 已安装`);
    }

    const plugin = await this.prisma.plugin.create({
      data: {
        name: manifest.name,
        displayName: manifest.displayName,
        description: manifest.description ?? null,
        version: manifest.version,
        author: manifest.author ?? null,
        homepage: manifest.homepage ?? null,
        license: manifest.license ?? null,
        entryPoint: manifest.entryPoint,
        config: manifest.configSchema ? JSON.stringify({}) : null,
        settings: manifest.settingsSchema ? JSON.stringify({}) : null,
      },
    });

    this.logger?.info(`[Plugin] Installed: ${manifest.name} v${manifest.version}`);
    this.eventBus.emit({
      type: 'plugin.installed',
      payload: { pluginId: plugin.id, name: plugin.name },
      timestamp: new Date(),
      source: 'plugin-loader',
    });

    return this.toPluginInstance(plugin);
  }

  /**
   * Load and activate all enabled plugins
   */
  async loadAll(): Promise<void> {
    const plugins = await this.prisma.plugin.findMany({
      where: { isEnabled: true },
    });

    this.logger?.info(`[Plugin] Loading ${plugins.length} enabled plugins...`);

    for (const plugin of plugins) {
      try {
        await this.load(plugin.name);
      } catch (error: any) {
        this.logger?.error(`[Plugin] Failed to load "${plugin.name}": ${error.message}`);
      }
    }
  }

  /**
   * Load and activate a specific plugin
   */
  async load(pluginName: string): Promise<void> {
    if (this.loadedPlugins.has(pluginName)) {
      this.logger?.warn(`[Plugin] "${pluginName}" is already loaded`);
      return;
    }

    const plugin = await this.prisma.plugin.findUnique({ where: { name: pluginName } });
    if (!plugin) throw new Error(`插件 "${pluginName}" 未找到`);
    if (!plugin.isEnabled) throw new Error(`插件 "${pluginName}" 已禁用`);

    // Create plugin context
    const ctx: PluginContext = {
      registerTool: (tool) => {
        this.customTools.set(`${pluginName}:${tool.name}`, tool);
        this.logger?.info(`[Plugin] Registered tool: ${pluginName}/${tool.name}`);
      },
      registerWebhook: (type, handler) => {
        this.webhookHandlers.set(`${pluginName}:${type}`, handler);
        this.logger?.info(`[Plugin] Registered webhook: ${pluginName}/${type}`);
      },
      emit: (eventType, payload) => {
        this.eventBus.emit({
          type: `plugin.${pluginName}.${eventType}`,
          payload,
          timestamp: new Date(),
          source: `plugin:${pluginName}`,
        });
      },
      getConfig: () => {
        try {
          return plugin.config ? JSON.parse(plugin.config) : {};
        } catch {
          return {};
        }
      },
      updateSettings: async (settings) => {
        await this.prisma.plugin.update({
          where: { name: pluginName },
          data: { settings: JSON.stringify(settings) },
        });
      },
      logger: {
        info: (msg) => this.logger?.info(`[Plugin:${pluginName}] ${msg}`),
        warn: (msg) => this.logger?.warn(`[Plugin:${pluginName}] ${msg}`),
        error: (msg) => this.logger?.error(`[Plugin:${pluginName}] ${msg}`),
        debug: (msg) => this.logger?.debug(`[Plugin:${pluginName}] ${msg}`),
      },
    };

    // Try to dynamically load the plugin entry point
    try {
      const pluginModule = await import(plugin.entryPoint);
      const registry: PluginRegistry = pluginModule.default ?? pluginModule.plugin;

      if (registry && typeof registry.activate === 'function') {
        await registry.activate(ctx);
      }

      this.loadedPlugins.set(pluginName, {
        name: plugin.name,
        displayName: plugin.displayName,
        description: plugin.description ?? undefined,
        version: plugin.version,
        author: plugin.author ?? undefined,
        capabilities: [],
        isEnabled: true,
        activate: registry?.activate,
        deactivate: registry?.deactivate,
      });

      this.logger?.info(`[Plugin] Loaded: ${pluginName} v${plugin.version}`);
    } catch (error: any) {
      // Plugin entry point not found or failed to load - register as passive plugin
      this.loadedPlugins.set(pluginName, {
        name: plugin.name,
        displayName: plugin.displayName,
        description: plugin.description ?? undefined,
        version: plugin.version,
        author: plugin.author ?? undefined,
        capabilities: [],
        isEnabled: true,
      });

      this.logger?.warn(`[Plugin] "${pluginName}" loaded in passive mode (entry point not loadable): ${error.message}`);
    }
  }

  /**
   * Unload a plugin
   */
  async unload(pluginName: string): Promise<void> {
    const registry = this.loadedPlugins.get(pluginName);
    if (!registry) return;

    if (registry.deactivate) {
      try {
        await registry.deactivate();
      } catch (error: any) {
        this.logger?.error(`[Plugin] Error deactivating "${pluginName}": ${error.message}`);
      }
    }

    // Clean up registered tools and webhooks
    for (const key of [...this.customTools.keys()]) {
      if (key.startsWith(`${pluginName}:`)) this.customTools.delete(key);
    }
    for (const key of [...this.webhookHandlers.keys()]) {
      if (key.startsWith(`${pluginName}:`)) this.webhookHandlers.delete(key);
    }

    this.loadedPlugins.delete(pluginName);
    this.logger?.info(`[Plugin] Unloaded: ${pluginName}`);
  }

  /**
   * Enable a plugin
   */
  async enable(pluginName: string): Promise<PluginInstance> {
    const plugin = await this.prisma.plugin.update({
      where: { name: pluginName },
      data: { isEnabled: true },
    });

    await this.load(pluginName);

    this.eventBus.emit({
      type: 'plugin.enabled',
      payload: { pluginId: plugin.id, name: plugin.name },
      timestamp: new Date(),
      source: 'plugin-loader',
    });

    return this.toPluginInstance(plugin);
  }

  /**
   * Disable a plugin
   */
  async disable(pluginName: string): Promise<PluginInstance> {
    await this.unload(pluginName);

    const plugin = await this.prisma.plugin.update({
      where: { name: pluginName },
      data: { isEnabled: false },
    });

    this.eventBus.emit({
      type: 'plugin.disabled',
      payload: { pluginId: plugin.id, name: plugin.name },
      timestamp: new Date(),
      source: 'plugin-loader',
    });

    return this.toPluginInstance(plugin);
  }

  /**
   * Uninstall a plugin
   */
  async uninstall(pluginName: string): Promise<void> {
    await this.unload(pluginName);
    await this.prisma.plugin.delete({ where: { name: pluginName } });

    this.logger?.info(`[Plugin] Uninstalled: ${pluginName}`);

    this.eventBus.emit({
      type: 'plugin.uninstalled',
      payload: { name: pluginName },
      timestamp: new Date(),
      source: 'plugin-loader',
    });
  }

  /**
   * Update plugin settings
   */
  async updateSettings(pluginName: string, settings: Record<string, unknown>): Promise<void> {
    await this.prisma.plugin.update({
      where: { name: pluginName },
      data: { settings: JSON.stringify(settings) },
    });
  }

  /**
   * List all plugins
   */
  async list(): Promise<PluginInstance[]> {
    const plugins = await this.prisma.plugin.findMany({
      orderBy: { installedAt: 'desc' },
    });
    return plugins.map((p: any) => this.toPluginInstance(p));
  }

  /**
   * Get a single plugin
   */
  async get(pluginName: string): Promise<PluginInstance | null> {
    const plugin = await this.prisma.plugin.findUnique({ where: { name: pluginName } });
    return plugin ? this.toPluginInstance(plugin) : null;
  }

  /**
   * Get all registered custom tools
   */
  getCustomTools(): CustomToolDefinition[] {
    return [...this.customTools.values()].map(t => ({
      ...t,
      name: t.name,
    }));
  }

  /**
   * Get a webhook handler for a plugin+type combination
   */
  getWebhookHandler(pluginName: string, type: string): ((body: unknown) => Promise<unknown>) | undefined {
    return this.webhookHandlers.get(`${pluginName}:${type}`);
  }

  /**
   * Get loaded plugin count
   */
  getLoadedCount(): number {
    return this.loadedPlugins.size;
  }

  private toPluginInstance(plugin: any): PluginInstance {
    return {
      id: plugin.id,
      name: plugin.name,
      displayName: plugin.displayName,
      description: plugin.description,
      version: plugin.version,
      author: plugin.author,
      homepage: plugin.homepage,
      license: plugin.license,
      entryPoint: plugin.entryPoint,
      config: plugin.config ? JSON.parse(plugin.config) : null,
      settings: plugin.settings ? JSON.parse(plugin.settings) : null,
      isEnabled: plugin.isEnabled,
      installedAt: plugin.installedAt,
      updatedAt: plugin.updatedAt,
    };
  }
}
