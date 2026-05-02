// ============================================================
// AI Task Hub v3.0 — EventBus Unit Tests
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '@/lib/core/v3/event-bus';
import type { EventEnvelope } from '@/lib/core/v3/types';

describe('EventBus', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus({ enableDLQ: true });
  });

  const makeEvent = (type: any, payload: any): EventEnvelope => ({
    type,
    payload,
    timestamp: Date.now(),
    source: 'test',
  });

  describe('emit & on', () => {
    it('should deliver events to subscribers', () => {
      const received: EventEnvelope<'task.created'>[] = [];
      bus.on('task.created', (event) => {
        received.push(event);
      });

      bus.emit(makeEvent('task.created', {
        taskId: 't1',
        title: 'Test',
        projectId: 'p1',
        priority: 'high',
      }));

      expect(received).toHaveLength(1);
      expect(received[0].payload.taskId).toBe('t1');
    });

    it('should support multiple subscribers', () => {
      const results: string[] = [];
      bus.on('task.created', () => { results.push('a'); });
      bus.on('task.created', () => { results.push('b'); });

      bus.emit(makeEvent('task.created', {
        taskId: 't1',
        title: 'Test',
        projectId: 'p1',
        priority: 'high',
      }));

      expect(results).toEqual(['a', 'b']);
    });

    it('should unsubscribe correctly', () => {
      const received: string[] = [];
      const unsub = bus.on('task.created', () => { received.push('a'); });
      bus.on('task.created', () => { received.push('b'); });

      unsub();
      bus.emit(makeEvent('task.created', {
        taskId: 't1',
        title: 'Test',
        projectId: 'p1',
        priority: 'high',
      }));

      expect(received).toEqual(['b']);
    });

    it('should handle once subscription', () => {
      let count = 0;
      bus.once('task.created', () => count++);

      bus.emit(makeEvent('task.created', {
        taskId: 't1',
        title: 'Test',
        projectId: 'p1',
        priority: 'high',
      }));
      bus.emit(makeEvent('task.created', {
        taskId: 't2',
        title: 'Test 2',
        projectId: 'p1',
        priority: 'low',
      }));

      expect(count).toBe(1);
    });
  });

  describe('error isolation', () => {
    it('should not propagate handler errors to other handlers', () => {
      const results: string[] = [];
      bus.on('task.created', () => {
        results.push('before');
      });
      bus.on('task.created', () => {
        throw new Error('Handler failed');
      });
      bus.on('task.created', () => {
        results.push('after');
      });

      bus.emit(makeEvent('task.created', {
        taskId: 't1',
        title: 'Test',
        projectId: 'p1',
        priority: 'high',
      }));

      expect(results).toEqual(['before', 'after']);
    });

    it('should add failed events to DLQ', () => {
      bus.on('task.created', () => {
        throw new Error('Handler failed');
      });

      bus.emit(makeEvent('task.created', {
        taskId: 't1',
        title: 'Test',
        projectId: 'p1',
        priority: 'high',
      }));

      expect(bus.getDLQSize()).toBe(1);
      const dlq = bus.getDLQ();
      expect(dlq[0].handlerName).toBe('anonymous');
      expect(dlq[0].error).toBe('Handler failed');
    });
  });

  describe('metrics', () => {
    it('should track emit and handle counts', () => {
      bus.on('task.created', () => {});
      bus.on('task.status.changed', () => {});

      bus.emit(makeEvent('task.created', {
        taskId: 't1',
        title: 'Test',
        projectId: 'p1',
        priority: 'high',
      }));
      bus.emit(makeEvent('task.status.changed', {
        taskId: 't1',
        from: 'todo',
        to: 'in_progress',
      }));

      const metrics = bus.getMetrics();
      expect(metrics.totalEmitted).toBe(2);
      expect(metrics.totalHandled).toBe(2);
      expect(metrics.totalFailed).toBe(0);
    });

    it('should track failures', () => {
      bus.on('task.created', () => {
        throw new Error('fail');
      });

      bus.emit(makeEvent('task.created', {
        taskId: 't1',
        title: 'Test',
        projectId: 'p1',
        priority: 'high',
      }));

      const metrics = bus.getMetrics();
      expect(metrics.totalFailed).toBe(1);
    });
  });

  describe('DLQ', () => {
    it('should clear DLQ', () => {
      bus.on('task.created', () => { throw new Error('fail'); });
      bus.emit(makeEvent('task.created', {
        taskId: 't1',
        title: 'Test',
        projectId: 'p1',
        priority: 'high',
      }));

      const cleared = bus.clearDLQ();
      expect(cleared).toBe(1);
      expect(bus.getDLQSize()).toBe(0);
    });

    it('should remove specific DLQ entry', () => {
      bus.on('task.created', () => { throw new Error('fail'); });
      bus.emit(makeEvent('task.created', {
        taskId: 't1',
        title: 'Test',
        projectId: 'p1',
        priority: 'high',
      }));

      const dlq = bus.getDLQ();
      expect(bus.removeFromDLQ(dlq[0].id)).toBe(true);
      expect(bus.getDLQSize()).toBe(0);
    });
  });

  describe('removeAllListeners', () => {
    it('should remove all listeners for a specific type', () => {
      bus.on('task.created', () => {});
      bus.on('task.created', () => {});
      bus.on('task.status.changed', () => {});

      bus.removeAllListeners('task.created');
      expect(bus.getListenerCount('task.created')).toBe(0);
      expect(bus.getListenerCount('task.status.changed')).toBe(1);
    });

    it('should remove all listeners when no type specified', () => {
      bus.on('task.created', () => {});
      bus.on('task.status.changed', () => {});

      bus.removeAllListeners();
      expect(bus.getListenerCount()).toBe(0);
    });
  });
});
