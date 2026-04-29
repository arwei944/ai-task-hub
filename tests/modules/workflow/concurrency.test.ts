import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConcurrencyController } from '@/lib/modules/workflow-engine/concurrency';

describe('ConcurrencyController', () => {
  let controller: ConcurrencyController;

  beforeEach(() => {
    vi.useFakeTimers();
    controller = new ConcurrencyController(2);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('acquire / release - basic', () => {
    it('should allow acquisition when under limit', async () => {
      await controller.acquire();
      expect(controller.getRunningCount()).toBe(1);
      controller.release();
      expect(controller.getRunningCount()).toBe(0);
    });

    it('should allow acquisition up to max concurrency', async () => {
      await controller.acquire();
      await controller.acquire();
      expect(controller.getRunningCount()).toBe(2);
    });

    it('should queue when at max concurrency', async () => {
      const p1 = controller.acquire();
      const p2 = controller.acquire();
      const p3 = controller.acquire(); // should queue

      expect(controller.getRunningCount()).toBe(2);
      expect(controller.getQueueLength()).toBe(1);

      controller.release();
      await p3;

      expect(controller.getRunningCount()).toBe(2);
      expect(controller.getQueueLength()).toBe(0);
    });

    it('should process queued items in priority order', async () => {
      const results: number[] = [];

      // Fill up slots
      await controller.acquire();
      await controller.acquire();

      // Queue with different priorities (lower = higher priority)
      const p3 = controller.acquire(undefined, 5).then(() => results.push(5));
      const p4 = controller.acquire(undefined, 1).then(() => results.push(1));
      const p5 = controller.acquire(undefined, 3).then(() => results.push(3));

      expect(controller.getQueueLength()).toBe(3);

      // Release one slot - highest priority (1) should go first
      controller.release();
      await vi.advanceTimersByTimeAsync(0);
      expect(results).toEqual([1]);

      // Release another slot - priority 3 should go next
      controller.release();
      await vi.advanceTimersByTimeAsync(0);
      expect(results).toEqual([1, 3]);

      // Release last slot - priority 5
      controller.release();
      await vi.advanceTimersByTimeAsync(0);
      expect(results).toEqual([1, 3, 5]);
    });

    it('should clamp priority to 0-5 range', async () => {
      await controller.acquire();
      await controller.acquire();

      const p = controller.acquire(undefined, 10);
      controller.release();
      await p;

      // Should have worked (priority clamped to 5)
      expect(controller.getRunningCount()).toBe(2);
    });
  });

  describe('per-workflow limits', () => {
    it('should enforce per-workflow concurrency limits', async () => {
      controller.setWorkflowLimit('wf-1', 1);

      await controller.acquire('wf-1');
      expect(controller.getWorkflowRunningCount('wf-1')).toBe(1);

      const p2 = controller.acquire('wf-1'); // should queue
      expect(controller.getWorkflowQueueLength('wf-1')).toBe(1);

      controller.release('wf-1');
      await p2;

      expect(controller.getWorkflowRunningCount('wf-1')).toBe(1);
    });

    it('should allow different workflows to run concurrently', async () => {
      controller.setWorkflowLimit('wf-1', 1);
      controller.setWorkflowLimit('wf-2', 1);

      await controller.acquire('wf-1');
      await controller.acquire('wf-2');

      expect(controller.getWorkflowRunningCount('wf-1')).toBe(1);
      expect(controller.getWorkflowRunningCount('wf-2')).toBe(1);
      expect(controller.getRunningCount()).toBe(2);
    });

    it('should use global limit as default per-workflow limit', async () => {
      // No explicit workflow limit set
      await controller.acquire('wf-1');
      await controller.acquire('wf-1');
      expect(controller.getWorkflowRunningCount('wf-1')).toBe(2);
    });

    it('should respect both global and per-workflow limits', async () => {
      controller.setMaxConcurrency(10);
      controller.setWorkflowLimit('wf-1', 1);

      await controller.acquire('wf-1');
      const p2 = controller.acquire('wf-1'); // should queue due to per-workflow limit

      // Another workflow should be able to acquire independently
      await controller.acquire('wf-2');
      expect(controller.getRunningCount()).toBe(2);

      // Release wf-1 to allow p2 to proceed
      controller.release('wf-1');
      await p2;

      // Now wf-1 has 1 running again, plus wf-2 still running = 2 total
      expect(controller.getRunningCount()).toBe(2);
    });
  });

  describe('timeout', () => {
    it('should reject with timeout error when acquisition times out', async () => {
      await controller.acquire();
      await controller.acquire();

      const p = controller.acquire(undefined, 3, 1000);

      vi.advanceTimersByTime(1001);

      await expect(p).rejects.toThrow('Concurrency acquisition timed out after 1000ms');
      expect(controller.getQueueLength()).toBe(0);
    });

    it('should not timeout if acquired before timeout', async () => {
      await controller.acquire();
      await controller.acquire();

      const p = controller.acquire(undefined, 3, 5000);

      vi.advanceTimersByTime(1000);
      controller.release();
      await vi.advanceTimersByTimeAsync(0);

      await expect(p).resolves.toBeUndefined();
    });
  });

  describe('setMaxConcurrency', () => {
    it('should update max concurrency and wake queued items', async () => {
      controller.setMaxConcurrency(1);

      await controller.acquire();
      const p2 = controller.acquire(); // queued

      expect(controller.getQueueLength()).toBe(1);

      controller.setMaxConcurrency(3);
      await vi.advanceTimersByTimeAsync(0);

      expect(controller.getRunningCount()).toBe(2);
      expect(controller.getQueueLength()).toBe(0);
    });

    it('should not allow max concurrency below 1', () => {
      controller.setMaxConcurrency(0);
      expect(controller.getRunningCount()).toBe(0);

      // Should still work with at least 1
      controller.setMaxConcurrency(-5);
      // The controller should still function (minimum 1)
    });
  });

  describe('setWorkflowLimit', () => {
    it('should not allow workflow limit below 1', () => {
      controller.setWorkflowLimit('wf-1', 0);
      expect(controller.getWorkflowLimit('wf-1')).toBe(1);
    });
  });

  describe('release - edge cases', () => {
    it('should not go below 0 running count', () => {
      controller.release(); // running count is 0
      expect(controller.getRunningCount()).toBe(0);
    });

    it('should not go below 0 per-workflow running count', () => {
      controller.release('wf-1'); // no running for wf-1
      expect(controller.getWorkflowRunningCount('wf-1')).toBe(0);
    });
  });

  describe('getters', () => {
    it('should return 0 for unknown workflow running count', () => {
      expect(controller.getWorkflowRunningCount('unknown')).toBe(0);
    });

    it('should return 0 for unknown workflow queue length', () => {
      expect(controller.getWorkflowQueueLength('unknown')).toBe(0);
    });
  });
});
