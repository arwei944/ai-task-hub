// ============================================================
// AI Task Hub v3.0 — HealthMonitor + CircuitBreaker Unit Tests
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HealthMonitor } from '@/lib/core/v3/health';
import { CircuitBreaker } from '@/lib/core/v3/health';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 100,
      successThreshold: 2,
    });
  });

  it('should start in closed state', () => {
    expect(breaker.getState()).toBe('closed');
  });

  it('should remain closed on success', async () => {
    await breaker.execute(async () => 'ok');
    expect(breaker.getState()).toBe('closed');
    expect(breaker.getFailureCount()).toBe(0);
  });

  it('should open after consecutive failures', async () => {
    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(async () => { throw new Error('fail'); });
      } catch {}
    }
    expect(breaker.getState()).toBe('open');
  });

  it('should reject calls when open', async () => {
    for (let i = 0; i < 3; i++) {
      try { await breaker.execute(async () => { throw new Error('fail'); }); } catch {}
    }

    await expect(
      breaker.execute(async () => 'ok')
    ).rejects.toThrow('Circuit is OPEN');
  });

  it('should transition to half-open after reset timeout', async () => {
    for (let i = 0; i < 3; i++) {
      try { await breaker.execute(async () => { throw new Error('fail'); }); } catch {}
    }

    // Wait for reset timeout
    await new Promise(resolve => setTimeout(resolve, 150));

    // Next call should be in half-open
    const result = await breaker.execute(async () => 'ok');
    expect(result).toBe('ok');
    // Still half-open (need successThreshold successes)
    expect(breaker.getState()).toBe('half-open');

    // One more success should close it
    await breaker.execute(async () => 'ok');
    expect(breaker.getState()).toBe('closed');
  });

  it('should support manual reset', async () => {
    for (let i = 0; i < 3; i++) {
      try { await breaker.execute(async () => { throw new Error('fail'); }); } catch {}
    }
    expect(breaker.getState()).toBe('open');

    breaker.reset();
    expect(breaker.getState()).toBe('closed');
  });

  it('should support manual trip', () => {
    breaker.trip();
    expect(breaker.getState()).toBe('open');
  });
});

describe('HealthMonitor', () => {
  let monitor: HealthMonitor;

  beforeEach(() => {
    monitor = new HealthMonitor({ intervalMs: 1000 });
  });

  it('should register and run health checks', async () => {
    monitor.register('test', () => ({
      status: 'healthy',
      latency: 5,
      checkedAt: Date.now(),
    }));

    await monitor.runChecks();

    const report = monitor.getReport('test');
    expect(report?.status).toBe('healthy');
    expect(report?.latency).toBe(5);
  });

  it('should detect degraded status', async () => {
    monitor.register('failing', () => ({
      status: 'degraded',
      details: 'High latency',
      checkedAt: Date.now(),
    }));

    await monitor.runChecks();

    expect(monitor.getOverallStatus()).toBe('degraded');
  });

  it('should detect failed status', async () => {
    monitor.register('crashing', () => {
      throw new Error('Crash!');
    });

    await monitor.runChecks();

    const report = monitor.getReport('crashing');
    expect(report?.status).toBe('failed');
    expect(monitor.getOverallStatus()).toBe('failed');
  });

  it('should call onDegraded callback', async () => {
    const onDegraded = vi.fn();
    const mon = new HealthMonitor({ onDegraded });

    mon.register('test', () => ({
      status: 'degraded',
      checkedAt: Date.now(),
    }));

    await mon.runChecks();
    expect(onDegraded).toHaveBeenCalledWith('test', expect.objectContaining({ status: 'degraded' }));
  });

  it('should call onRecovered callback', async () => {
    const onRecovered = vi.fn();
    const mon = new HealthMonitor({ onRecovered });
    let healthy = false;

    mon.register('test', () => ({
      status: healthy ? 'healthy' : 'degraded',
      checkedAt: Date.now(),
    }));

    // First: degraded
    await mon.runChecks();
    expect(onRecovered).not.toHaveBeenCalled();

    // Second: recovered
    healthy = true;
    await mon.runChecks();
    expect(onRecovered).toHaveBeenCalledWith('test', expect.objectContaining({ status: 'healthy' }));
  });

  it('should unregister checks', async () => {
    monitor.register('test', () => ({ status: 'healthy', checkedAt: Date.now() }));
    monitor.unregister('test');

    await monitor.runChecks();
    expect(monitor.getReport('test')).toBeUndefined();
  });

  it('should return all reports', async () => {
    monitor.register('a', () => ({ status: 'healthy', checkedAt: Date.now() }));
    monitor.register('b', () => ({ status: 'degraded', checkedAt: Date.now() }));

    await monitor.runChecks();

    const reports = monitor.getAllReports();
    expect(Object.keys(reports)).toEqual(['a', 'b']);
  });

  it('should start and stop periodic checks', async () => {
    monitor.register('test', () => ({ status: 'healthy', checkedAt: Date.now() }));
    monitor.start();
    monitor.stop();

    // Should not throw
    monitor.stop();
  });
});
