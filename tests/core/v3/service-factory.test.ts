// ============================================================
// Service Factory Tests
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DIContainer } from '@/lib/core/v3/di';

// ---- Mocks (vi.mock is auto-hoisted by vitest) ----

vi.mock('@/lib/db', () => ({
  getPrisma: () => ({ _mockPrisma: true }),
}));

vi.mock('@/lib/core/logger', () => ({
  Logger: class MockLogger {
    info = vi.fn();
    warn = vi.fn();
    debug = vi.fn();
    error = vi.fn();
  },
}));

vi.mock('@/lib/core/event-bus', () => {
  const mockBus = {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    removeAllListeners: vi.fn(),
  };
  return {
    EventBus: class MockEventBus {
      emit = vi.fn();
      on = vi.fn();
      off = vi.fn();
      removeAllListeners = vi.fn();
    },
    getEventBus: () => mockBus,
  };
});

// Dynamic imports after mocks
const { ServiceTokens, registerCoreServices } = await import('@/lib/core/v3/service-factory');
const { ServiceAccessor } = await import('@/lib/core/v3/trpc-context');

describe('ServiceFactory', () => {
  let container: DIContainer;

  beforeEach(() => {
    container = new DIContainer();
  });

  describe('registerCoreServices', () => {
    it('should register prisma, eventBus, and logger as singletons', () => {
      registerCoreServices(container);

      expect(container.has(ServiceTokens.prisma)).toBe(true);
      expect(container.has(ServiceTokens.eventBus)).toBe(true);
      expect(container.has(ServiceTokens.logger)).toBe(true);

      const prisma1 = container.resolve(ServiceTokens.prisma);
      const prisma2 = container.resolve(ServiceTokens.prisma);
      expect(prisma1).toBe(prisma2);

      const eventBus1 = container.resolve(ServiceTokens.eventBus);
      const eventBus2 = container.resolve(ServiceTokens.eventBus);
      expect(eventBus1).toBe(eventBus2);

      const logger1 = container.resolve(ServiceTokens.logger);
      const logger2 = container.resolve(ServiceTokens.logger);
      expect(logger1).toBe(logger2);
    });
  });

  describe('ServiceTokens', () => {
    it('should have all expected service tokens', () => {
      expect(ServiceTokens.prisma).toBe('prisma');
      expect(ServiceTokens.eventBus).toBe('eventBus');
      expect(ServiceTokens.logger).toBe('logger');
      expect(ServiceTokens.taskService).toBe('taskService');
      expect(ServiceTokens.authService).toBe('authService');
      expect(ServiceTokens.aiModel).toBe('aiModel');
      expect(ServiceTokens.agentService).toBe('agentService');
      expect(ServiceTokens.integrationService).toBe('integrationService');
      expect(ServiceTokens.notificationRepo).toBe('notificationRepo');
      expect(ServiceTokens.statisticsService).toBe('statisticsService');
      expect(ServiceTokens.workflowService).toBe('workflowService');
      expect(ServiceTokens.pluginLoader).toBe('pluginLoader');
      expect(ServiceTokens.moduleUpdaterService).toBe('moduleUpdaterService');
      expect(ServiceTokens.improvementLoop).toBe('improvementLoop');
    });
  });
});

describe('ServiceAccessor', () => {
  let container: DIContainer;
  let accessor: InstanceType<typeof ServiceAccessor>;

  beforeEach(() => {
    container = new DIContainer();
    registerCoreServices(container);
    accessor = new ServiceAccessor(container);
  });

  describe('convenience properties', () => {
    it('should expose prisma via .prisma', () => {
      expect(accessor.prisma).toBeDefined();
    });

    it('should expose eventBus via .eventBus', () => {
      const eventBus = accessor.eventBus;
      expect(eventBus).toBeDefined();
      expect(eventBus).toHaveProperty('emit');
      expect(eventBus).toHaveProperty('on');
    });

    it('should expose logger via .logger', () => {
      expect(accessor.logger).toBeDefined();
    });

    it('should return same instance via property and get()', () => {
      expect(accessor.prisma).toBe(accessor.get(ServiceTokens.prisma));
      expect(accessor.eventBus).toBe(accessor.get(ServiceTokens.eventBus));
      expect(accessor.logger).toBe(accessor.get(ServiceTokens.logger));
    });
  });

  describe('get()', () => {
    it('should throw for unregistered service', () => {
      expect(() => accessor.get(ServiceTokens.taskService)).toThrow();
    });

    it('should return registered service', () => {
      const mockService = { doSomething: vi.fn() };
      container.register(ServiceTokens.taskService, () => mockService, { singleton: true });

      const result = accessor.get(ServiceTokens.taskService);
      expect(result).toBe(mockService);
    });

    it('should expose all service convenience properties', () => {
      const mockServices: Record<string, any> = {};
      const allTokens = Object.values(ServiceTokens);
      for (const token of allTokens) {
        mockServices[token] = { [token]: true };
        container.register(token, () => mockServices[token], { singleton: true });
      }

      expect(accessor.prisma).toBe(mockServices[ServiceTokens.prisma]);
      expect(accessor.eventBus).toBe(mockServices[ServiceTokens.eventBus]);
      expect(accessor.logger).toBe(mockServices[ServiceTokens.logger]);
      expect(accessor.authService).toBe(mockServices[ServiceTokens.authService]);
      expect(accessor.userRepo).toBe(mockServices[ServiceTokens.userRepo]);
      expect(accessor.taskService).toBe(mockServices[ServiceTokens.taskService]);
      expect(accessor.taskRepo).toBe(mockServices[ServiceTokens.taskRepo]);
      expect(accessor.aiModel).toBe(mockServices[ServiceTokens.aiModel]);
      expect(accessor.taskExtractor).toBe(mockServices[ServiceTokens.taskExtractor]);
      expect(accessor.agentService).toBe(mockServices[ServiceTokens.agentService]);
      expect(accessor.integrationService).toBe(mockServices[ServiceTokens.integrationService]);
      expect(accessor.notificationRepo).toBe(mockServices[ServiceTokens.notificationRepo]);
      expect(accessor.webPushService).toBe(mockServices[ServiceTokens.webPushService]);
      expect(accessor.ruleEngine).toBe(mockServices[ServiceTokens.ruleEngine]);
      expect(accessor.statisticsService).toBe(mockServices[ServiceTokens.statisticsService]);
      expect(accessor.workflowService).toBe(mockServices[ServiceTokens.workflowService]);
      expect(accessor.pluginLoader).toBe(mockServices[ServiceTokens.pluginLoader]);
      expect(accessor.moduleUpdaterService).toBe(mockServices[ServiceTokens.moduleUpdaterService]);
      expect(accessor.improvementLoop).toBe(mockServices[ServiceTokens.improvementLoop]);
    });
  });
});
