import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../../../src/lib/core/event-bus';
import { EventStore } from '../../../src/lib/core/events/event-store';

function createMockEventStore() {
  const events: any[] = [];
  let idCounter = 0;

  const mockPrisma = {
    eventStore: {
      create: vi.fn(async (args: any) => {
        const entry = {
          id: `evt_${++idCounter}`,
          ...args.data,
          version: 1,
        };
        events.push(entry);
        return entry;
      }),
      findMany: vi.fn(async (args: any) => {
        let filtered = [...events];
        const where = args?.where;
        if (where?.eventType) {
          filtered = filtered.filter((e) => e.eventType === where.eventType);
        }
        if (where?.source) {
          filtered = filtered.filter((e) => e.source === where.source);
        }
        if (where?.timestamp) {
          if (where.timestamp.gte) {
            filtered = filtered.filter((e) => new Date(e.timestamp) >= where.timestamp.gte);
          }
          if (where.timestamp.lte) {
            filtered = filtered.filter((e) => new Date(e.timestamp) <= where.timestamp.lte);
          }
        }
        filtered.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        if (args?.skip) filtered = filtered.slice(args.skip);
        if (args?.take) filtered = filtered.slice(0, args.take);
        return filtered;
      }),
      count: vi.fn(async (args: any) => {
        const where = args?.where;
        if (where?.eventType) {
          return events.filter((e) => e.eventType === where.eventType).length;
        }
        return events.length;
      }),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
  };

  const store = new EventStore(() => mockPrisma);
  return { store, mockPrisma, events };
}

describe('EventBus v2', () => {
  describe('backward compatibility', () => {
    it('basic emit/on/off should work without config', () => {
      const bus = new EventBus();
      const received: any[] = [];

      bus.on('test.event', (event) => {
        received.push(event.payload);
      });

      bus.emit({
        type: 'test.event',
        payload: { message: 'hello' },
        timestamp: new Date(),
      });

      expect(received).toHaveLength(1);
      expect(received[0].message).toBe('hello');
    });

    it('off should remove listener', () => {
      const bus = new EventBus();
      const received: any[] = [];

      const callback = (event: any) => received.push(event.payload);
      bus.on('test.event', callback);
      bus.emit({
        type: 'test.event',
        payload: { n: 1 },
        timestamp: new Date(),
      });

      bus.off('test.event', callback);
      bus.emit({
        type: 'test.event',
        payload: { n: 2 },
        timestamp: new Date(),
      });

      expect(received).toHaveLength(1);
      expect(received[0].n).toBe(1);
    });

    it('once should fire only once', () => {
      const bus = new EventBus();
      const received: any[] = [];

      bus.once('test.event', (event) => {
        received.push(event.payload);
      });

      bus.emit({ type: 'test.event', payload: { n: 1 }, timestamp: new Date() });
      bus.emit({ type: 'test.event', payload: { n: 2 }, timestamp: new Date() });

      expect(received).toHaveLength(1);
      expect(received[0].n).toBe(1);
    });

    it('wildcard listeners should work', () => {
      const bus = new EventBus();
      const received: string[] = [];

      bus.on('*', (event) => {
        received.push(event.type);
      });

      bus.emit({ type: 'a', payload: {}, timestamp: new Date() });
      bus.emit({ type: 'b', payload: {}, timestamp: new Date() });

      expect(received).toEqual(['a', 'b']);
    });

    it('removeAllListeners should clear all', () => {
      const bus = new EventBus();
      const received: any[] = [];

      bus.on('test.event', (event) => received.push(event.payload));
      bus.removeAllListeners();

      bus.emit({ type: 'test.event', payload: { n: 1 }, timestamp: new Date() });

      expect(received).toHaveLength(0);
    });

    it('emitAsync should work', async () => {
      const bus = new EventBus();
      const received: any[] = [];

      bus.on('test.event', async (event) => {
        received.push(event.payload);
      });

      await bus.emitAsync({
        type: 'test.event',
        payload: { message: 'async-hello' },
        timestamp: new Date(),
      });

      expect(received).toHaveLength(1);
      expect(received[0].message).toBe('async-hello');
    });
  });

  describe('with eventStore', () => {
    let mockStore: ReturnType<typeof createMockEventStore>;
    let bus: EventBus;

    beforeEach(() => {
      mockStore = createMockEventStore();
      bus = new EventBus({ eventStore: mockStore.store });
    });

    it('events should be persisted on emit', async () => {
      bus.emit({
        type: 'task.created',
        payload: { taskId: 'task-1', title: 'Test' },
        timestamp: new Date(),
      });

      // Wait for async persist
      await new Promise((r) => setTimeout(r, 50));

      expect(mockStore.mockPrisma.eventStore.create).toHaveBeenCalledTimes(1);
    });

    it('events should be persisted on emitAsync', async () => {
      await bus.emitAsync({
        type: 'task.created',
        payload: { taskId: 'task-1', title: 'Test' },
        timestamp: new Date(),
      });

      expect(mockStore.mockPrisma.eventStore.create).toHaveBeenCalledTimes(1);
    });

    it('queryEvents should return stored events', async () => {
      await bus.emitAsync({
        type: 'task.created',
        payload: { taskId: 'task-1' },
        timestamp: new Date('2025-01-01'),
      });
      await bus.emitAsync({
        type: 'task.created',
        payload: { taskId: 'task-2' },
        timestamp: new Date('2025-01-02'),
      });

      const results = await bus.queryEvents({ eventType: 'task.created' });
      expect(results).toHaveLength(2);
    });

    it('replayEvents should replay stored events', async () => {
      const received: any[] = [];

      await bus.emitAsync({
        type: 'task.created',
        payload: { taskId: 'task-1' },
        timestamp: new Date('2025-01-01'),
      });
      await bus.emitAsync({
        type: 'task.created',
        payload: { taskId: 'task-2' },
        timestamp: new Date('2025-01-02'),
      });

      bus.on('task.created', (event) => {
        received.push(event.payload);
      });

      await bus.replayEvents('task.created');

      expect(received).toHaveLength(2);
      expect(received[0].taskId).toBe('task-1');
      expect(received[1].taskId).toBe('task-2');
    });

    it('getEventCount should return count', async () => {
      await bus.emitAsync({
        type: 'task.created',
        payload: { taskId: 'task-1' },
        timestamp: new Date(),
      });
      await bus.emitAsync({
        type: 'task.status.changed',
        payload: { taskId: 'task-1' },
        timestamp: new Date(),
      });

      expect(await bus.getEventCount()).toBe(2);
      expect(await bus.getEventCount('task.created')).toBe(1);
    });

    it('queryEvents without eventStore should throw', async () => {
      const plainBus = new EventBus();
      await expect(plainBus.queryEvents({})).rejects.toThrow('EventStore is not configured');
    });

    it('replayEvents without eventStore should throw', async () => {
      const plainBus = new EventBus();
      await expect(plainBus.replayEvents('task.created')).rejects.toThrow('EventStore is not configured');
    });

    it('getEventCount without eventStore should throw', async () => {
      const plainBus = new EventBus();
      await expect(plainBus.getEventCount()).rejects.toThrow('EventStore is not configured');
    });
  });

  describe('with validation', () => {
    it('valid events should pass validation', () => {
      const bus = new EventBus({ validateEvents: true });
      const received: any[] = [];

      bus.on('task.created', (event) => received.push(event.payload));

      bus.emit({
        type: 'task.created',
        payload: { taskId: 'task-1', title: 'Test Task' },
        timestamp: new Date(),
      });

      expect(received).toHaveLength(1);
    });

    it('invalid events should be rejected (sync emit)', () => {
      const bus = new EventBus({ validateEvents: true });
      const received: any[] = [];

      bus.on('task.created', (event) => received.push(event.payload));

      // Missing required 'title' field
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      bus.emit({
        type: 'task.created',
        payload: { taskId: 'task-1' },
        timestamp: new Date(),
      });

      expect(received).toHaveLength(0);
      spy.mockRestore();
    });

    it('invalid events should be rejected (async emit)', async () => {
      const bus = new EventBus({ validateEvents: true });

      await expect(
        bus.emitAsync({
          type: 'task.created',
          payload: { taskId: 'task-1' },
          timestamp: new Date(),
        })
      ).rejects.toThrow();
    });

    it('unknown event types should pass when no schema exists', () => {
      const bus = new EventBus({ validateEvents: true });
      const received: any[] = [];

      bus.on('custom.unknown.event', (event) => received.push(event.payload));

      bus.emit({
        type: 'custom.unknown.event',
        payload: { anything: 'goes' },
        timestamp: new Date(),
      });

      expect(received).toHaveLength(1);
    });

    it('validation can be disabled (default)', () => {
      const bus = new EventBus();
      const received: any[] = [];

      bus.on('task.created', (event) => received.push(event.payload));

      // This would fail validation but should pass since validation is off
      bus.emit({
        type: 'task.created',
        payload: { anything: 'goes' },
        timestamp: new Date(),
      });

      expect(received).toHaveLength(1);
    });
  });

  describe('EventStore errors should not break emit', () => {
    it('persist error should not prevent handlers from receiving events', async () => {
      const failingStore = new EventStore(() => ({
        eventStore: {
          create: vi.fn(async () => {
            throw new Error('DB connection lost');
          }),
          findMany: vi.fn(async () => []),
          count: vi.fn(async () => 0),
          deleteMany: vi.fn(async () => ({ count: 0 })),
        },
      }));

      const bus = new EventBus({ eventStore: failingStore });
      const received: any[] = [];

      bus.on('task.created', (event) => received.push(event.payload));

      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      bus.emit({
        type: 'task.created',
        payload: { taskId: 'task-1', title: 'Test' },
        timestamp: new Date(),
      });

      // Wait for async persist to fail
      await new Promise((r) => setTimeout(r, 50));

      expect(received).toHaveLength(1);
      expect(received[0].taskId).toBe('task-1');
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});
