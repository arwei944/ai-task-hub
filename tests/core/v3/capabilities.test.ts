// ============================================================
// Capability Tests
// ============================================================

import { describe, it, expect, vi } from 'vitest';
import { DIContainer } from '@/lib/core/v3/di';

// ---- Mocks (auto-hoisted by vitest) ----

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
    getGlobalEventBus: () => mockBus,
  };
});

// Dynamic imports after mocks
const { BaseCapability } = await import('@/lib/core/v3/base-capability');
const {
  TaskCapability,
  NotificationCapability,
  WorkflowCapability,
  AICapability,
  IntegrationCapability,
  AgentCapability,
  ObservabilityCapability,
} = await import('@/lib/core/v3/capabilities');

// ---- BaseCapability Tests ----

describe('BaseCapability', () => {
  it('should wrap doRegister with error handling', async () => {
    class TestCap extends BaseCapability {
      readonly id = 'test';
      called = false;
      protected async doRegister() { this.called = true; }
      protected async doSubscribe() {}
      protected doHealthCheck() { return this.healthy(); }
    }

    const cap = new TestCap();
    await cap.register(new DIContainer());
    expect(cap.called).toBe(true);
  });

  it('should catch and rethrow register errors', async () => {
    class FailCap extends BaseCapability {
      readonly id = 'fail';
      protected async doRegister() { throw new Error('boom'); }
      protected async doSubscribe() {}
      protected doHealthCheck() { return this.healthy(); }
    }

    const cap = new FailCap();
    await expect(cap.register(new DIContainer())).rejects.toThrow('boom');
  });

  it('should add latency and timestamp to healthCheck', () => {
    class FastCap extends BaseCapability {
      readonly id = 'fast';
      protected async doRegister() {}
      protected async doSubscribe() {}
      protected doHealthCheck() { return this.healthy(); }
    }

    const cap = new FastCap();
    const report = cap.healthCheck();
    expect(report.latency).toBeGreaterThanOrEqual(0);
    expect(report.checkedAt).toBeGreaterThan(0);
  });

  it('should catch healthCheck errors and return failed status', () => {
    class ErrorCap extends BaseCapability {
      readonly id = 'error';
      protected async doRegister() {}
      protected async doSubscribe() {}
      protected doHealthCheck(): any { throw new Error('health boom'); }
    }

    const cap = new ErrorCap();
    const report = cap.healthCheck();
    expect(report.status).toBe('failed');
    expect(report.details).toContain('health boom');
  });
});

// ---- Concrete Capability Tests ----
// Note: register() tests are skipped for capabilities that use dynamic imports
// (vi.mock doesn't intercept await import()). Register correctness is verified
// by integration tests. Here we test: id, interface compliance, and healthCheck.

const capabilityTests: Array<{
  name: string;
  instance: InstanceType<typeof BaseCapability>;
  expectedHealthStatus: string;
  expectedMetrics?: Record<string, any>;
}> = [
  {
    name: 'TaskCapability',
    instance: new TaskCapability(),
    expectedHealthStatus: 'healthy',
  },
  {
    name: 'NotificationCapability',
    instance: new NotificationCapability(),
    expectedHealthStatus: 'healthy',
  },
  {
    name: 'WorkflowCapability',
    instance: new WorkflowCapability(),
    expectedHealthStatus: 'healthy',
  },
  {
    name: 'AICapability (with API key)',
    instance: new AICapability(),
    expectedHealthStatus: 'healthy',
    expectedMetrics: { model: expect.any(String) },
  },
  {
    name: 'IntegrationCapability',
    instance: new IntegrationCapability(),
    expectedHealthStatus: 'healthy',
    expectedMetrics: { adapters: 6 },
  },
  {
    name: 'AgentCapability',
    instance: new AgentCapability(),
    expectedHealthStatus: 'healthy',
  },
  {
    name: 'ObservabilityCapability',
    instance: new ObservabilityCapability(),
    expectedHealthStatus: 'healthy',
  },
];

for (const { name, instance, expectedHealthStatus, expectedMetrics } of capabilityTests) {
  describe(name, () => {
    it('should have correct id', () => {
      expect(instance.id).toBeDefined();
      expect(typeof instance.id).toBe('string');
      expect(instance.id.length).toBeGreaterThan(0);
    });

    it('should implement Capability interface', () => {
      expect(typeof instance.register).toBe('function');
      expect(typeof instance.subscribe).toBe('function');
      expect(typeof instance.healthCheck).toBe('function');
    });

    it(`should return ${expectedHealthStatus} health status`, () => {
      // Set API key for AI capability test
      if (name.includes('AICapability')) {
        process.env.OPENAI_API_KEY = 'test-key';
      }

      const report = instance.healthCheck();
      expect(report.status).toBe(expectedHealthStatus);
      expect(report.checkedAt).toBeGreaterThanOrEqual(0);

      if (expectedMetrics) {
        expect(report.metrics).toBeDefined();
        for (const [key, value] of Object.entries(expectedMetrics)) {
          if (typeof value === 'function') {
            // jest matcher like expect.any(String)
            expect(value(report.metrics![key])).toBe(true);
          } else {
            expect(report.metrics![key]).toEqual(value);
          }
        }
      }
    });
  });
}

// ---- AI Capability: Degraded without API key ----

describe('AICapability (degraded)', () => {
  it('should be degraded when API key is missing', () => {
    delete process.env.OPENAI_API_KEY;
    const cap = new AICapability();
    const report = cap.healthCheck();
    expect(report.status).toBe('degraded');
    expect(report.metrics).toEqual({ hasApiKey: false });
  });
});

// ---- Integration: All Capabilities Together ----

describe('All Capabilities Integration', () => {
  it('should have unique ids', () => {
    const caps = [
      new TaskCapability(),
      new NotificationCapability(),
      new WorkflowCapability(),
      new AICapability(),
      new IntegrationCapability(),
      new AgentCapability(),
      new ObservabilityCapability(),
    ];

    const ids = caps.map(c => c.id);
    expect(new Set(ids).size).toBe(7);
  });

  it('should all produce valid health reports', () => {
    process.env.OPENAI_API_KEY = 'test-key';
    const caps = [
      new TaskCapability(),
      new NotificationCapability(),
      new WorkflowCapability(),
      new AICapability(),
      new IntegrationCapability(),
      new AgentCapability(),
      new ObservabilityCapability(),
    ];

    for (const cap of caps) {
      const report = cap.healthCheck();
      expect(['healthy', 'degraded', 'failed', 'unknown']).toContain(report.status);
      expect(report.checkedAt).toBeGreaterThan(0);
    }
  });
});
