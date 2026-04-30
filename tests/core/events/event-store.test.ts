import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventStore } from '../../../src/lib/core/events/event-store';

function createMockDb() {
  const events: any[] = [];
  let idCounter = 0;

  return {
    events,
    mockPrisma: {
      eventStore: {
        create: vi.fn(async (args: any) => {
          const entry = {
            id: `evt_${++idCounter}`,
            ...args.data,
            timestamp: args.data.timestamp instanceof Date
              ? args.data.timestamp
              : new Date(args.data.timestamp),
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
        deleteMany: vi.fn(async (args: any) => {
          const before = args?.where?.timestamp?.lt;
          if (!before) return { count: 0 };
          const beforeTime = before instanceof Date ? before.getTime() : new Date(before).getTime();
          const toDelete = events.filter(
            (e) => new Date(e.timestamp).getTime() < beforeTime
          );
          const count = toDelete.length;
          for (const entry of toDelete) {
            const idx = events.indexOf(entry);
            if (idx >= 0) events.splice(idx, 1);
          }
          return { count };
        }),
      },
    },
  };
}

describe('EventStore', () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let store: EventStore;

  beforeEach(() => {
    mockDb = createMockDb();
    store = new EventStore(() => mockDb.mockPrisma);
  });

  it('persist should write event to database', async () => {
    const event = {
      type: 'task.created',
      payload: { taskId: 'task-1', title: 'Test' },
      timestamp: new Date(),
      source: 'test-module',
    };

    await store.persist(event);

    expect(mockDb.mockPrisma.eventStore.create).toHaveBeenCalledTimes(1);
    expect(mockDb.mockPrisma.eventStore.create).toHaveBeenCalledWith({
      data: {
        eventType: 'task.created',
        payload: JSON.stringify({ taskId: 'task-1', title: 'Test' }),
        source: 'test-module',
        timestamp: expect.any(Date),
      },
    });
  });

  it('persist should handle null source', async () => {
    const event = {
      type: 'task.created',
      payload: { taskId: 'task-1' },
      timestamp: new Date(),
    };

    await store.persist(event);

    expect(mockDb.mockPrisma.eventStore.create).toHaveBeenCalledWith({
      data: {
        eventType: 'task.created',
        payload: JSON.stringify({ taskId: 'task-1' }),
        source: null,
        timestamp: expect.any(Date),
      },
    });
  });

  it('query with eventType filter should return matching events', async () => {
    // Seed some events
    await store.persist({
      type: 'task.created',
      payload: { taskId: 'task-1' },
      timestamp: new Date('2025-01-01'),
    });
    await store.persist({
      type: 'task.status.changed',
      payload: { taskId: 'task-1' },
      timestamp: new Date('2025-01-02'),
    });
    await store.persist({
      type: 'task.created',
      payload: { taskId: 'task-2' },
      timestamp: new Date('2025-01-03'),
    });

    const results = await store.query({ eventType: 'task.created' });
    expect(results).toHaveLength(2);
    expect(results[0].eventType).toBe('task.created');
    expect(results[1].eventType).toBe('task.created');
  });

  it('query with limit and offset should work', async () => {
    await store.persist({
      type: 'task.created',
      payload: { taskId: 'task-1' },
      timestamp: new Date('2025-01-01'),
    });
    await store.persist({
      type: 'task.created',
      payload: { taskId: 'task-2' },
      timestamp: new Date('2025-01-02'),
    });
    await store.persist({
      type: 'task.created',
      payload: { taskId: 'task-3' },
      timestamp: new Date('2025-01-03'),
    });

    const results = await store.query({ eventType: 'task.created', limit: 2, offset: 1 });
    expect(results).toHaveLength(2);
  });

  it('query should parse payload from JSON string', async () => {
    await store.persist({
      type: 'task.created',
      payload: { taskId: 'task-1', title: 'Hello' },
      timestamp: new Date(),
    });

    const results = await store.query({ eventType: 'task.created' });
    expect(results[0].payload).toEqual({ taskId: 'task-1', title: 'Hello' });
  });

  it('replay should call callback for each matching event', async () => {
    await store.persist({
      type: 'task.created',
      payload: { taskId: 'task-1' },
      timestamp: new Date('2025-01-01'),
    });
    await store.persist({
      type: 'task.created',
      payload: { taskId: 'task-2' },
      timestamp: new Date('2025-01-02'),
    });
    await store.persist({
      type: 'task.status.changed',
      payload: { taskId: 'task-1' },
      timestamp: new Date('2025-01-03'),
    });

    const received: any[] = [];
    await store.replay('task.created', undefined, (event) => {
      received.push(event);
    });

    expect(received).toHaveLength(2);
    expect(received[0].type).toBe('task.created');
    expect(received[0].payload.taskId).toBe('task-1');
    expect(received[1].payload.taskId).toBe('task-2');
  });

  it('getEventCount should return correct count', async () => {
    await store.persist({
      type: 'task.created',
      payload: { taskId: 'task-1' },
      timestamp: new Date(),
    });
    await store.persist({
      type: 'task.created',
      payload: { taskId: 'task-2' },
      timestamp: new Date(),
    });
    await store.persist({
      type: 'task.status.changed',
      payload: { taskId: 'task-1' },
      timestamp: new Date(),
    });

    expect(await store.getEventCount()).toBe(3);
    expect(await store.getEventCount('task.created')).toBe(2);
    expect(await store.getEventCount('task.status.changed')).toBe(1);
  });

  it('cleanOldEvents should remove entries before the given date', async () => {
    await store.persist({
      type: 'task.created',
      payload: { taskId: 'task-1' },
      timestamp: new Date('2024-01-01'),
    });
    await store.persist({
      type: 'task.created',
      payload: { taskId: 'task-2' },
      timestamp: new Date('2025-01-01'),
    });
    await store.persist({
      type: 'task.created',
      payload: { taskId: 'task-3' },
      timestamp: new Date('2026-01-01'),
    });

    const deleted = await store.cleanOldEvents(new Date('2025-06-01'));
    expect(deleted).toBe(2);
    expect(await store.getEventCount()).toBe(1);
  });
});
