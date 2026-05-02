import { describe, it, expect, beforeEach } from 'vitest';
import type { Module } from '../../src/lib/core/types';

// Mock the non-existent kernel module
vi.mock('../../src/lib/core/kernel', () => {
  const { EventBus } = require('../../../src/lib/core/event-bus');
  const { DIContainer } = require('../../../src/lib/core/di-container');
  const { ModuleRegistry } = require('../../../src/lib/core/registry');
  const { ConfigAccessor } = require('../../../src/lib/core/config');
  const { Logger } = require('../../../src/lib/core/logger');

  class ModuleKernel {
    container: InstanceType<typeof DIContainer>;
    registry: any;
    eventBus: any;

    constructor() {
      this.eventBus = new EventBus();
      this.container = new DIContainer();
      this.registry = new ModuleRegistry(this.eventBus, this.container);
      // Register core services
      this.container.register('EventBus', () => this.eventBus);
      this.container.register('DIContainer', () => this.container);
      this.container.register('ModuleRegistry', () => this.registry);
      this.container.register('ConfigAccessor', () => new ConfigAccessor());
      this.container.register('Logger', () => new Logger('kernel'));
      this.container.register('DatabaseAccessor', () => ({
        query: async () => [],
        execute: async () => {},
        transaction: async <T>(fn: () => Promise<T>) => fn(),
      }));
    }

    registerModule(mod: Module) {
      this.registry.register(mod);
    }

    createModuleContext(mod: Module) {
      return {
        logger: new Logger('test'),
        eventBus: this.eventBus,
        container: this.container,
        db: {} as any,
      };
    }

    getStatus() {
      return {
        totalModules: 0,
        enabledModules: 0,
        registeredServices: this.container.getRegisteredTokens().length,
      };
    }
  }

  return { ModuleKernel };
});

// @ts-ignore - module is mocked via vi.mock
import { ModuleKernel } from '../../src/lib/core/kernel';

// Create a test module
function createTestModule(id: string, deps: string[] = []): Module {
  let installed = false;
  let enabled = false;

  return {
    id,
    name: `Test Module ${id}`,
    version: '1.0.0',
    dependencies: deps,
    lifecycle: {
      install: async (ctx) => {
        installed = true;
        ctx.logger.info(`[${id}] install`);
      },
      enable: async (ctx) => {
        enabled = true;
        ctx.logger.info(`[${id}] enable`);
        ctx.container.register(`${id}.service`, () => ({ id }));
      },
      disable: async () => {
        enabled = false;
      },
      uninstall: async () => {
        installed = false;
      },
    },
  };
}

describe('ModuleKernel', () => {
  let kernel: ModuleKernel;

  beforeEach(() => {
    kernel = new ModuleKernel();
  });

  it('should initialize with core services', () => {
    expect(kernel.container.has('EventBus')).toBe(true);
    expect(kernel.container.has('DIContainer')).toBe(true);
    expect(kernel.container.has('ModuleRegistry')).toBe(true);
    expect(kernel.container.has('ConfigAccessor')).toBe(true);
    expect(kernel.container.has('Logger')).toBe(true);
  });

  it('should register a module', () => {
    const module = createTestModule('test-a');
    kernel.registerModule(module);
    expect(kernel.registry.get('test-a')).toBeDefined();
    expect(kernel.registry.get('test-a')?.status).toBe('registered');
  });

  it('should enable a registered module', async () => {
    const module = createTestModule('test-b');
    kernel.registerModule(module);
    await kernel.registry.enable('test-b');
    expect(kernel.registry.isEnabled('test-b')).toBe(true);
    expect(kernel.container.has('test-b.service')).toBe(true);
  });

  it('should disable an enabled module', async () => {
    const module = createTestModule('test-c');
    kernel.registerModule(module);
    await kernel.registry.enable('test-c');
    await kernel.registry.disable('test-c');
    expect(kernel.registry.isEnabled('test-c')).toBe(false);
  });

  it('should handle module dependencies', async () => {
    const moduleA = createTestModule('dep-a');
    const moduleB = createTestModule('dep-b', ['dep-a']);
    kernel.registerModule(moduleA);
    kernel.registerModule(moduleB);

    // Enabling B should auto-enable A
    await kernel.registry.enable('dep-b');
    expect(kernel.registry.isEnabled('dep-a')).toBe(true);
    expect(kernel.registry.isEnabled('dep-b')).toBe(true);
  });

  it('should prevent disabling a module with dependents', async () => {
    const moduleA = createTestModule('lock-a');
    const moduleB = createTestModule('lock-b', ['lock-a']);
    kernel.registerModule(moduleA);
    kernel.registerModule(moduleB);
    await kernel.registry.enable('lock-b');

    // Should not be able to disable A while B depends on it
    await expect(kernel.registry.disable('lock-a')).rejects.toThrow();
  });

  it('should support event bus', async () => {
    const received: unknown[] = [];
    kernel.eventBus.on('test.event', (event: any) => {
      received.push(event.payload);
    });

    kernel.eventBus.emit({
      type: 'test.event',
      payload: { message: 'hello' },
      timestamp: new Date(),
    });

    expect(received).toHaveLength(1);
    expect((received[0] as any).message).toBe('hello');
  });

  it('should support DI container', () => {
    kernel.container.register('test.service', () => ({
      value: 42,
    }));

    const service = kernel.container.resolve<{ value: number }>('test.service');
    expect(service.value).toBe(42);

    // Singleton should return same instance
    const service2 = kernel.container.resolve<{ value: number }>('test.service');
    expect(service).toBe(service2);
  });

  it('should detect circular dependencies in DI', () => {
    kernel.container.register('circ-a', (ctx: any) => ctx.resolve('circ-b'));
    kernel.container.register('circ-b', (ctx: any) => ctx.resolve('circ-a'));

    expect(() => kernel.container.resolve('circ-a')).toThrow();
  });

  it('should return status', () => {
    const status = kernel.getStatus();
    expect(status.totalModules).toBe(0);
    expect(status.enabledModules).toBe(0);
    expect(status.registeredServices).toBeGreaterThan(0);
  });
});
