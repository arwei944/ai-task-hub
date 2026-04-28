import { EventBus } from './event-bus';
import { DIContainer } from './di-container';
import { ModuleRegistry } from './registry';
import { ConfigAccessor } from './config';
import { Logger } from './logger';
import type { Module, ModuleContext } from './types';

export class ModuleKernel {
  readonly eventBus: EventBus;
  readonly container: DIContainer;
  readonly registry: ModuleRegistry;
  readonly config: ConfigAccessor;
  readonly logger: Logger;

  constructor(configPath?: string) {
    this.logger = new Logger('kernel');
    this.eventBus = new EventBus();
    this.container = new DIContainer();
    this.config = new ConfigAccessor(configPath);
    this.registry = new ModuleRegistry(this.eventBus, this.container);

    // Register core services
    this.container.register('EventBus', () => this.eventBus);
    this.container.register('DIContainer', () => this.container);
    this.container.register('ModuleRegistry', () => this.registry);
    this.container.register('ConfigAccessor', () => this.config);
    this.container.register('Logger', () => this.logger);
    // DatabaseAccessor will be replaced by actual implementation in M2
    this.container.register('DatabaseAccessor', () => ({
      query: async () => [],
      execute: async () => {},
      transaction: async <T>(fn: () => Promise<T>) => fn(),
    }));

    this.logger.info('Module Kernel initialized');
  }

  registerModule(module: Module): void {
    this.registry.register(module);
    this.logger.info(`Module registered: ${module.id}@${module.version}`);
  }

  async boot(): Promise<void> {
    this.logger.info('Booting modules...');

    const moduleConfigs = this.config.getAllModuleConfigs();

    // First pass: register all modules from config that aren't already registered
    // (modules can also be registered programmatically before boot)

    // Second pass: enable modules based on config
    const allModules = this.registry.list();

    // Sort by dependencies (topological sort)
    const enableOrder = this.topologicalSort(allModules);

    for (const moduleId of enableOrder) {
      const moduleConfig = moduleConfigs[moduleId];
      const isEnabled = moduleConfig?.enabled ?? false;
      const isLocked = moduleConfig?.locked ?? false;

      const info = this.registry.get(moduleId);
      if (!info) continue;

      // Apply locked status from config
      if (isLocked && info.module) {
        info.module.locked = true;
      }

      if (isEnabled && info.status !== 'enabled') {
        try {
          await this.registry.enable(moduleId);
          this.logger.info(`Module enabled: ${moduleId}`);
        } catch (error) {
          this.logger.error(`Failed to enable module ${moduleId}:`, error);
        }
      }
    }

    this.logger.info(`Boot complete. ${this.registry.getEnabledModules().length} modules enabled.`);
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down...');

    const enabledModules = this.registry
      .list()
      .filter((info) => info.status === 'enabled')
      .reverse(); // Disable in reverse order

    for (const info of enabledModules) {
      try {
        await this.registry.disable(info.module.id);
        this.logger.info(`Module disabled: ${info.module.id}`);
      } catch (error) {
        this.logger.error(`Failed to disable module ${info.module.id}:`, error);
      }
    }

    this.logger.info('Shutdown complete.');
  }

  createModuleContext(module: Module): ModuleContext {
    return {
      eventBus: this.eventBus,
      container: this.container,
      registry: this.registry,
      config: this.config,
      db: {} as any, // Will be replaced by actual DB accessor
      logger: this.logger.child(module.id),
    };
  }

  private topologicalSort(modules: { module: Module; dependencies: string[] }[]): string[] {
    const visited = new Set<string>();
    const result: string[] = [];
    const visiting = new Set<string>();

    const visit = (moduleId: string) => {
      if (visited.has(moduleId)) return;
      if (visiting.has(moduleId)) {
        this.logger.warn(`Circular dependency detected involving: ${moduleId}`);
        return;
      }

      visiting.add(moduleId);

      const info = modules.find((m) => m.module.id === moduleId);
      if (info) {
        for (const dep of info.dependencies) {
          visit(dep);
        }
      }

      visiting.delete(moduleId);
      visited.add(moduleId);
      result.push(moduleId);
    };

    for (const { module } of modules) {
      visit(module.id);
    }

    return result;
  }

  getStatus(): {
    totalModules: number;
    enabledModules: number;
    disabledModules: number;
    eventListeners: number;
    registeredServices: number;
  } {
    const allModules = this.registry.list();
    return {
      totalModules: allModules.length,
      enabledModules: allModules.filter((m) => m.status === 'enabled').length,
      disabledModules: allModules.filter((m) => m.status === 'disabled').length,
      eventListeners: (this.eventBus as any).getListenerCount?.() ?? 0,
      registeredServices: this.container.getRegisteredTokens().length,
    };
  }
}
