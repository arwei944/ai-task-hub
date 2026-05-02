// ============================================================
// AI Task Hub v3.0 — AppKernel Unit Tests
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { AppKernel } from '@/lib/core/v3/kernel';
import type { Capability, HealthReport } from '@/lib/core/v3/types';

// Mock Capability for testing
class MockCapability implements Capability {
  readonly id: string;
  registered = false;
  subscribed = false;

  constructor(id: string) {
    this.id = id;
  }

  async register(): Promise<void> {
    this.registered = true;
  }

  async subscribe(): Promise<void> {
    this.subscribed = true;
  }

  healthCheck(): HealthReport {
    return {
      status: 'healthy',
      latency: 1,
      checkedAt: Date.now(),
    };
  }
}

class FailingCapability implements Capability {
  readonly id = 'failing';

  async register(): Promise<void> {
    throw new Error('Registration failed');
  }

  async subscribe(): Promise<void> {
    throw new Error('Subscription failed');
  }

  healthCheck(): HealthReport {
    return { status: 'failed', checkedAt: Date.now(), details: 'Always fails' };
  }
}

describe('AppKernel', () => {
  let kernel: AppKernel;

  beforeEach(() => {
    kernel = new AppKernel({ enableDLQ: true });
  });

  describe('boot', () => {
    it('should boot with capabilities', async () => {
      const cap1 = new MockCapability('test1');
      const cap2 = new MockCapability('test2');

      await kernel.boot([cap1, cap2]);

      expect(kernel.isBooted()).toBe(true);
      expect(cap1.registered).toBe(true);
      expect(cap1.subscribed).toBe(true);
      expect(cap2.registered).toBe(true);
      expect(cap2.subscribed).toBe(true);
    });

    it('should not boot twice', async () => {
      const cap = new MockCapability('test');
      await kernel.boot([cap]);
      await kernel.boot([cap]); // Should skip

      expect(kernel.isBooted()).toBe(true);
    });

    it('should continue booting even if a capability fails', async () => {
      const good = new MockCapability('good');
      const bad = new FailingCapability();

      await kernel.boot([bad, good]);

      expect(kernel.isBooted()).toBe(true);
      expect(good.registered).toBe(true);
      expect(good.subscribed).toBe(true);
    });

    it('should register core services in DI', async () => {
      await kernel.boot([new MockCapability('test')]);

      expect(kernel.resolve('kernel')).toBe(kernel);
      expect(kernel.resolve('bus')).toBeDefined();
      expect(kernel.resolve('tracer')).toBeDefined();
      expect(kernel.resolve('healthMonitor')).toBeDefined();
      expect(kernel.resolve('container')).toBeDefined();
    });
  });

  describe('getStatus', () => {
    it('should return correct status after boot', async () => {
      await kernel.boot([
        new MockCapability('cap1'),
        new MockCapability('cap2'),
      ]);

      const status = kernel.getStatus();
      expect(status.booted).toBe(true);
      expect(status.bootDuration).toBeGreaterThanOrEqual(0);
      expect(status.capabilities).toHaveLength(2);
      expect(status.capabilities[0].status).toBe('healthy');
      expect(status.eventBus).toBeDefined();
      expect(status.linkage).toBeDefined();
    });
  });

  describe('getCapabilities', () => {
    it('should return registered capabilities', async () => {
      const cap1 = new MockCapability('cap1');
      const cap2 = new MockCapability('cap2');
      await kernel.boot([cap1, cap2]);

      const caps = kernel.getCapabilities();
      expect(caps).toHaveLength(2);
      expect(caps[0].id).toBe('cap1');
      expect(caps[1].id).toBe('cap2');
    });
  });

  describe('shutdown', () => {
    it('should shutdown cleanly', async () => {
      await kernel.boot([new MockCapability('test')]);
      await kernel.shutdown();

      expect(kernel.isBooted()).toBe(false);
    });
  });
});
