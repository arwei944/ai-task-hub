import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '@/lib/core/event-bus';
import type { DomainEvent, EventCallback } from '@/lib/core/types';

function makeEvent(type: string, payload?: unknown): DomainEvent {
  return { type, payload: payload ?? {}, timestamp: new Date(), source: 'test' };
}

describe('EventBus', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  // --- 基本同步事件 ---
  describe('emit (sync)', () => {
    it('should call registered handler when event is emitted', () => {
      const handler = vi.fn();
      bus.on('user.created', handler);
      bus.emit(makeEvent('user.created', { name: 'Alice' }));
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'user.created', payload: { name: 'Alice' } }),
      );
    });

    it('should call multiple handlers for the same event type', () => {
      const h1 = vi.fn();
      const h2 = vi.fn();
      bus.on('order.placed', h1);
      bus.on('order.placed', h2);
      bus.emit(makeEvent('order.placed'));
      expect(h1).toHaveBeenCalledTimes(1);
      expect(h2).toHaveBeenCalledTimes(1);
    });

    it('should not call handlers for different event types', () => {
      const handler = vi.fn();
      bus.on('user.created', handler);
      bus.emit(makeEvent('user.deleted'));
      expect(handler).not.toHaveBeenCalled();
    });

    it('should catch errors in handlers and not affect other handlers', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const badHandler = vi.fn(() => {
        throw new Error('boom');
      });
      const goodHandler = vi.fn();
      bus.on('test', badHandler);
      bus.on('test', goodHandler);
      bus.emit(makeEvent('test'));
      expect(badHandler).toHaveBeenCalled();
      expect(goodHandler).toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });

  // --- 异步事件 ---
  describe('emitAsync', () => {
    it('should await async handlers', async () => {
      const handler = vi.fn(async () => {
        await new Promise((r) => setTimeout(r, 10));
      });
      bus.on('async.event', handler);
      await bus.emitAsync(makeEvent('async.event'));
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should catch async handler errors', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const badHandler = vi.fn(async () => {
        throw new Error('async boom');
      });
      bus.on('async.fail', badHandler);
      await bus.emitAsync(makeEvent('async.fail'));
      expect(badHandler).toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });

  // --- 优先级排序 ---
  describe('priority ordering', () => {
    it('should call higher priority handlers first', () => {
      const order: number[] = [];
      bus.on('test', () => order.push(0), { priority: 0 });
      bus.on('test', () => order.push(10), { priority: 10 });
      bus.on('test', () => order.push(5), { priority: 5 });
      bus.on('test', () => order.push(-1), { priority: -1 });
      bus.emit(makeEvent('test'));
      expect(order).toEqual([10, 5, 0, -1]);
    });

    it('should default priority to 0 when not specified', () => {
      const order: number[] = [];
      bus.on('test', () => order.push(0));
      bus.on('test', () => order.push(1), { priority: 1 });
      bus.emit(makeEvent('test'));
      expect(order).toEqual([1, 0]);
    });
  });

  // --- 通配符匹配 ---
  describe('wildcard listeners', () => {
    it('should call wildcard handler for all events', () => {
      const wildcard = vi.fn();
      bus.on('*', wildcard);
      bus.emit(makeEvent('a'));
      bus.emit(makeEvent('b'));
      bus.emit(makeEvent('c'));
      expect(wildcard).toHaveBeenCalledTimes(3);
    });

    it('should call both specific and wildcard handlers', () => {
      const specific = vi.fn();
      const wildcard = vi.fn();
      bus.on('user.created', specific);
      bus.on('*', wildcard);
      bus.emit(makeEvent('user.created'));
      expect(specific).toHaveBeenCalledTimes(1);
      expect(wildcard).toHaveBeenCalledTimes(1);
    });

    it('should respect priority ordering among wildcard handlers', () => {
      const order: string[] = [];
      bus.on('*', () => order.push('wildcard-low'), { priority: 0 });
      bus.on('test', () => order.push('specific-high'), { priority: 10 });
      bus.on('*', () => order.push('wildcard-high'), { priority: 5 });
      bus.emit(makeEvent('test'));
      // Specific handlers fire first, then wildcards sorted by priority
      expect(order).toEqual(['specific-high', 'wildcard-high', 'wildcard-low']);
    });
  });

  // --- once 监听 ---
  describe('once', () => {
    it('should call handler only once', () => {
      const handler = vi.fn();
      bus.once('test', handler);
      bus.emit(makeEvent('test'));
      bus.emit(makeEvent('test'));
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should return unsubscribe function', () => {
      const handler = vi.fn();
      const unsub = bus.once('test', handler);
      unsub();
      bus.emit(makeEvent('test'));
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // --- off 移除 ---
  describe('off', () => {
    it('should remove a specific handler', () => {
      const h1 = vi.fn();
      const h2 = vi.fn();
      bus.on('test', h1);
      bus.on('test', h2);
      bus.off('test', h1);
      bus.emit(makeEvent('test'));
      expect(h1).not.toHaveBeenCalled();
      expect(h2).toHaveBeenCalledTimes(1);
    });

    it('should do nothing when removing a non-existent handler', () => {
      const handler = vi.fn();
      expect(() => bus.off('nonexistent', handler)).not.toThrow();
    });

    it('should do nothing when removing from a non-existent event type', () => {
      expect(() => bus.off('no.such.event', vi.fn())).not.toThrow();
    });
  });

  // --- removeAllListeners ---
  describe('removeAllListeners', () => {
    it('should remove all listeners for a specific event type', () => {
      const h1 = vi.fn();
      const h2 = vi.fn();
      bus.on('a', h1);
      bus.on('a', h2);
      bus.on('b', h1);
      bus.removeAllListeners('a');
      bus.emit(makeEvent('a'));
      bus.emit(makeEvent('b'));
      expect(h1).toHaveBeenCalledTimes(1); // only from 'b'
      expect(h2).not.toHaveBeenCalled();
    });

    it('should remove all listeners when no type specified', () => {
      const h1 = vi.fn();
      bus.on('a', h1);
      bus.on('b', h1);
      bus.removeAllListeners();
      bus.emit(makeEvent('a'));
      bus.emit(makeEvent('b'));
      expect(h1).not.toHaveBeenCalled();
    });
  });

  // --- getListenerCount ---
  describe('getListenerCount', () => {
    it('should return count for a specific event type', () => {
      bus.on('a', vi.fn());
      bus.on('a', vi.fn());
      bus.on('b', vi.fn());
      expect(bus.getListenerCount('a')).toBe(2);
      expect(bus.getListenerCount('b')).toBe(1);
    });

    it('should return 0 for non-existent event type', () => {
      expect(bus.getListenerCount('nonexistent')).toBe(0);
    });

    it('should return total count when no type specified', () => {
      bus.on('a', vi.fn());
      bus.on('a', vi.fn());
      bus.on('b', vi.fn());
      expect(bus.getListenerCount()).toBe(3);
    });
  });

  // --- unsubscribe 函数 ---
  describe('unsubscribe function', () => {
    it('should stop receiving events after unsubscribe', () => {
      const handler = vi.fn();
      const unsub = bus.on('test', handler);
      bus.emit(makeEvent('test'));
      expect(handler).toHaveBeenCalledTimes(1);
      unsub();
      bus.emit(makeEvent('test'));
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should clean up event type map when last handler unsubscribes', () => {
      const unsub = bus.on('test', vi.fn());
      expect(bus.getListenerCount('test')).toBe(1);
      unsub();
      expect(bus.getListenerCount('test')).toBe(0);
    });
  });
});
