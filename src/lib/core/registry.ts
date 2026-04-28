import {
  type Module,
  type ModuleInfo,
  type ModuleStatus,
  type IModuleRegistry,
  type ModuleContext,
  ModuleNotFoundError,
  ModuleDependencyError,
  ModuleStateError,
} from './types';
import type { IEventBus } from './types';
import type { IDIContainer } from './types';

export class ModuleRegistry implements IModuleRegistry {
  private modules = new Map<string, ModuleInfo>();
  private eventBus: IEventBus;
  private container: IDIContainer;

  constructor(eventBus: IEventBus, container: IDIContainer) {
    this.eventBus = eventBus;
    this.container = container;
  }

  register(module: Module): void {
    if (this.modules.has(module.id)) {
      throw new Error(`Module "${module.id}" is already registered`);
    }
    this.modules.set(module.id, {
      module,
      status: 'registered',
      dependencies: module.dependencies ?? [],
      dependents: [],
    });

    // Update dependents for existing modules
    for (const dep of module.dependencies ?? []) {
      const depInfo = this.modules.get(dep);
      if (depInfo) {
        depInfo.dependents.push(module.id);
      }
    }
  }

  async enable(moduleId: string): Promise<void> {
    const info = this.getRequired(moduleId);
    const { module } = info;

    if (info.status === 'enabled') return;

    if (module.locked && info.status === 'disabled') {
      throw new ModuleStateError(moduleId, 'enable', info.status);
    }

    // Check dependencies
    for (const depId of info.dependencies) {
      const depInfo = this.modules.get(depId);
      if (!depInfo) {
        throw new ModuleDependencyError(moduleId, depId);
      }
      if (depInfo.status !== 'enabled') {
        await this.enable(depId);
      }
    }

    // Build context
    const context = this.createContext(module);

    try {
      // Install if not yet installed
      if (info.status === 'registered') {
        await module.lifecycle.install?.(context);
        info.status = 'installed';
      }

      // Enable
      await module.lifecycle.enable?.(context);
      info.status = 'enabled';
      info.enabledAt = new Date();

      // Register providers
      this.registerProviders(module);

      // Register event handlers
      this.registerEventHandlers(module);

      // Emit event
      await this.eventBus.emitAsync({
        type: 'module.enabled',
        payload: { moduleId: module.id, moduleVersion: module.version },
        timestamp: new Date(),
        source: 'core',
      });
    } catch (error) {
      info.status = 'disabled';
      throw error;
    }
  }

  async disable(moduleId: string): Promise<void> {
    const info = this.getRequired(moduleId);
    const { module } = info;

    if (info.status !== 'enabled') return;

    if (module.locked) {
      throw new ModuleStateError(moduleId, 'disable', info.status);
    }

    // Check if other enabled modules depend on this
    for (const depId of info.dependents) {
      const depInfo = this.modules.get(depId);
      if (depInfo && depInfo.status === 'enabled') {
        throw new ModuleStateError(
          moduleId,
          'disable',
          info.status,
        );
      }
    }

    try {
      await module.lifecycle.disable?.();
      info.status = 'disabled';
      info.enabledAt = undefined;

      await this.eventBus.emitAsync({
        type: 'module.disabled',
        payload: { moduleId: module.id },
        timestamp: new Date(),
        source: 'core',
      });
    } catch (error) {
      throw error;
    }
  }

  async uninstall(moduleId: string): Promise<void> {
    const info = this.getRequired(moduleId);
    const { module } = info;

    if (info.status === 'enabled') {
      await this.disable(moduleId);
    }

    await module.lifecycle.uninstall?.();

    // Remove from dependents of dependencies
    for (const depId of info.dependencies) {
      const depInfo = this.modules.get(depId);
      if (depInfo) {
        depInfo.dependents = depInfo.dependents.filter((id) => id !== moduleId);
      }
    }

    this.modules.delete(moduleId);

    await this.eventBus.emitAsync({
      type: 'module.uninstalled',
      payload: { moduleId },
      timestamp: new Date(),
      source: 'core',
    });
  }

  get(moduleId: string): ModuleInfo | undefined {
    return this.modules.get(moduleId);
  }

  list(): ModuleInfo[] {
    return [...this.modules.values()];
  }

  isEnabled(moduleId: string): boolean {
    return this.modules.get(moduleId)?.status === 'enabled';
  }

  getEnabledModules(): Module[] {
    return [...this.modules.values()]
      .filter((info) => info.status === 'enabled')
      .map((info) => info.module);
  }

  private getRequired(moduleId: string): ModuleInfo {
    const info = this.modules.get(moduleId);
    if (!info) {
      throw new ModuleNotFoundError(moduleId);
    }
    return info;
  }

  private createContext(module: Module): ModuleContext {
    // Lazy import to avoid circular deps
    // These will be properly injected by the kernel
    return {
      eventBus: this.eventBus,
      container: this.container,
      registry: this,
      config: this.container.resolve('ConfigAccessor') as any,
      db: this.container.resolve('DatabaseAccessor') as any,
      logger: this.container.resolve('Logger') as any,
    };
  }

  private registerProviders(module: Module): void {
    // Providers are registered by the module's enable lifecycle
    // The module uses context.container.register() directly
  }

  private registerEventHandlers(module: Module): void {
    // Event handlers are registered by the module's enable lifecycle
    // The module uses context.eventBus.on() directly
  }
}
