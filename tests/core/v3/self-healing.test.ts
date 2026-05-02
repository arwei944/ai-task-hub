// ============================================================
// Self-Healing Manager Tests
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SelfHealingManager, getSelfHealingManager } from '@/lib/core/v3/self-healing';
import { CircuitBreaker } from '@/lib/core/v3/health';

describe('SelfHealingManager', () => {
  let manager: SelfHealingManager;

  beforeEach(() => {
    // Reset singleton
    vi.resetModules();
    manager = new SelfHealingManager();
  });

  // ---- HealthMonitor Integration ----

  describe('healthMonitor', () => {
    it('should register capabilities and run health checks', () => {
      const mockCap = {
        id: 'test-cap',
        register: vi.fn(),
        subscribe: vi.fn(),
        healthCheck: () => ({ status: 'healthy' as const, checkedAt: 0 }),
      };

      manager.registerCapabilities([mockCap]);
      manager.healthMonitor.runChecks();

      const report = manager.healthMonitor.getReport('test-cap');
      expect(report).toBeDefined();
      expect(report!.status).toBe('healthy');
    });

    it('should detect degraded capabilities', () => {
      const degradedCap = {
        id: 'degraded-cap',
        register: vi.fn(),
        subscribe: vi.fn(),
        healthCheck: () => ({ status: 'degraded' as const, checkedAt: 0, details: 'Something wrong' }),
      };

      const events: Array<{ type: string; capabilityId: string }> = [];
      manager.onHealthEvent((e) => events.push({ type: e.type, capabilityId: e.capabilityId }));

      manager.registerCapabilities([degradedCap]);
      manager.healthMonitor.runChecks();

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('health.degraded');
      expect(events[0].capabilityId).toBe('degraded-cap');
    });

    it('should detect recovery', () => {
      let healthy = false;
      const recoveringCap = {
        id: 'recovering-cap',
        register: vi.fn(),
        subscribe: vi.fn(),
        healthCheck: () => healthy
          ? { status: 'healthy' as const, checkedAt: 0 }
          : { status: 'degraded' as const, checkedAt: 0 },
      };

      const events: Array<{ type: string }> = [];
      manager.onHealthEvent((e) => events.push({ type: e.type }));

      manager.registerCapabilities([recoveringCap]);

      // First check: degraded
      manager.healthMonitor.runChecks();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('health.degraded');

      // Second check: recovered
      healthy = true;
      manager.healthMonitor.runChecks();
      expect(events).toHaveLength(2);
      expect(events[1].type).toBe('health.recovered');
    });

    it('should return overall status', () => {
      const healthyCap = {
        id: 'healthy',
        register: vi.fn(),
        subscribe: vi.fn(),
        healthCheck: () => ({ status: 'healthy' as const, checkedAt: 0 }),
      };

      manager.registerCapabilities([healthyCap]);
      manager.healthMonitor.runChecks();

      expect(manager.healthMonitor.getOverallStatus()).toBe('healthy');
    });
  });

  // ---- Circuit Breakers ----

  describe('circuitBreakers', () => {
    it('should register and execute with circuit breaker', async () => {
      let callCount = 0;
      const fn = async () => {
        callCount++;
        return 'ok';
      };

      const result = await manager.withCircuitBreaker('test-breaker', fn);
      expect(result).toBe('ok');
      expect(callCount).toBe(1);

      const statuses = manager.circuitBreakers.getAllStatuses();
      expect(statuses['test-breaker']).toBeDefined();
      expect(statuses['test-breaker'].state).toBe('closed');
    });

    it('should trip circuit after failures', async () => {
      const failingFn = async () => {
        throw new Error('service down');
      };

      // Configure low threshold for testing
      for (let i = 0; i < 5; i++) {
        try {
          await manager.withCircuitBreaker('flaky-service', failingFn, {
            failureThreshold: 3,
            resetTimeoutMs: 1000,
          });
        } catch {}
      }

      const statuses = manager.circuitBreakers.getAllStatuses();
      expect(statuses['flaky-service'].state).toBe('open');
    });

    it('should emit circuit state change events', async () => {
      const events: Array<{ type: string; circuitState: string }> = [];
      manager.onHealthEvent((e) => {
        if (e.type === 'circuit.state_change') {
          events.push({ type: e.type, circuitState: e.circuitState! });
        }
      });

      const failingFn = async () => { throw new Error('fail'); };

      for (let i = 0; i < 3; i++) {
        try {
          await manager.withCircuitBreaker('state-test', failingFn, { failureThreshold: 3 });
        } catch {}
      }

      expect(events.length).toBeGreaterThanOrEqual(1);
      const lastEvent = events[events.length - 1];
      expect(lastEvent.circuitState).toBe('open');
    });
  });

  // ---- DLQ ----

  describe('dlq', () => {
    it('should enqueue failed events', () => {
      const entry = manager.dlq.enqueue('task.created', { taskId: '123' }, 'Service unavailable');

      expect(entry.event).toBe('task.created');
      expect(entry.retries).toBe(0);
      expect(entry.maxRetries).toBe(5);
    });

    it('should list all entries', () => {
      manager.dlq.enqueue('event1', {}, 'err1');
      manager.dlq.enqueue('event2', {}, 'err2');

      expect(manager.dlq.getAll()).toHaveLength(2);
    });

    it('should return stats', () => {
      manager.dlq.enqueue('event1', {}, 'err1');
      manager.dlq.enqueue('event2', {}, 'err2');

      const stats = manager.dlq.getStats();
      expect(stats.total).toBe(2);
      expect(stats.pending).toBe(2);
      expect(stats.exhausted).toBe(0);
    });

    it('should mark retried entries', () => {
      const entry = manager.dlq.enqueue('event1', {}, 'err1');

      // Success
      manager.dlq.markRetried(entry.id, true);
      expect(manager.dlq.getAll()).toHaveLength(0);

      // Failure
      const entry2 = manager.dlq.enqueue('event2', {}, 'err2');
      manager.dlq.markRetried(entry2.id, false);
      expect(manager.dlq.getAll()).toHaveLength(1);
      expect(manager.dlq.getAll()[0].retries).toBe(1);
    });

    it('should remove entries', () => {
      const entry = manager.dlq.enqueue('event1', {}, 'err1');
      expect(manager.dlq.remove(entry.id)).toBe(true);
      expect(manager.dlq.remove('nonexistent')).toBe(false);
    });

    it('should purge exhausted entries', () => {
      const entry = manager.dlq.enqueue('event1', {}, 'err1');
      // Exhaust retries
      for (let i = 0; i < 5; i++) {
        manager.dlq.markRetried(entry.id, false);
      }

      const purged = manager.dlq.purgeExhausted();
      expect(purged).toBe(1);
      expect(manager.dlq.getAll()).toHaveLength(0);
    });

    it('should clear all entries', () => {
      manager.dlq.enqueue('event1', {}, 'err1');
      manager.dlq.enqueue('event2', {}, 'err2');

      const cleared = manager.dlq.clear();
      expect(cleared).toBe(2);
      expect(manager.dlq.getAll()).toHaveLength(0);
    });
  });

  // ---- getStatus ----

  describe('getStatus', () => {
    it('should return comprehensive status', () => {
      const cap = {
        id: 'test',
        register: vi.fn(),
        subscribe: vi.fn(),
        healthCheck: () => ({ status: 'healthy' as const, checkedAt: 0 }),
      };

      manager.registerCapabilities([cap]);
      manager.healthMonitor.runChecks();
      manager.dlq.enqueue('event1', {}, 'err1');

      const status = manager.getStatus();
      expect(status.health).toHaveProperty('test');
      expect(status.circuits).toBeDefined();
      expect(status.dlq.total).toBe(1);
    });
  });

  // ---- Singleton ----

  describe('getSelfHealingManager', () => {
    it('should return the same instance', () => {
      const a = getSelfHealingManager();
      const b = getSelfHealingManager();
      expect(a).toBe(b);
    });
  });

  // ---- Start/Stop ----

  describe('start/stop', () => {
    it('should start and stop without error', () => {
      expect(() => manager.start()).not.toThrow();
      expect(() => manager.stop()).not.toThrow();
    });
  });
});
