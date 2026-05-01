// ============================================================
// AI Task Hub - Event Store
// Persists domain events to SQLite via Prisma
// ============================================================

import type { DomainEvent, EventCallback } from '../types';
import type { EventFilter, EventStoreEntry } from './types';

export class EventStore {
  constructor(private getDb: () => any) {}

  /**
   * Persist a domain event to the EventStore table.
   */
  async persist(event: DomainEvent): Promise<void> {
    const db = this.getDb();
    await db.eventStore.create({
      data: {
        eventType: event.type,
        payload: JSON.stringify(event.payload),
        source: event.source ?? null,
        timestamp: event.timestamp instanceof Date
          ? event.timestamp
          : new Date(event.timestamp),
      },
    });
  }

  /**
   * Query events from the EventStore with optional filters.
   */
  async query(filter: EventFilter = {}): Promise<EventStoreEntry[]> {
    const db = this.getDb();
    const where: Record<string, unknown> = {};

    if (filter.eventType) {
      where.eventType = filter.eventType;
    }
    if (filter.source) {
      where.source = filter.source;
    }
    if (filter.from || filter.to) {
      where.timestamp = {};
      if (filter.from) {
        (where.timestamp as Record<string, unknown>).gte = filter.from;
      }
      if (filter.to) {
        (where.timestamp as Record<string, unknown>).lte = filter.to;
      }
    }

    const rows = await db.eventStore.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy: { timestamp: 'asc' },
      take: filter.limit,
      skip: filter.offset,
    });

    return rows.map((row: any) => ({
      id: row.id,
      eventType: row.eventType,
      payload: JSON.parse(row.payload),
      source: row.source,
      timestamp: row.timestamp,
      version: row.version,
    }));
  }

  /**
   * Replay stored events of a given type, invoking the callback for each.
   */
  async replay(eventType: string, callback: EventCallback, from?: Date): Promise<void> {
    const events = await this.query({ eventType, from });
    for (const entry of events) {
      const domainEvent: DomainEvent = {
        type: entry.eventType,
        payload: entry.payload,
        timestamp: entry.timestamp,
        source: entry.source ?? undefined,
      };
      await callback(domainEvent);
    }
  }

  /**
   * Get the total count of stored events, optionally filtered by type.
   */
  async getEventCount(eventType?: string): Promise<number> {
    const db = this.getDb();
    const where = eventType ? { eventType } : undefined;
    return db.eventStore.count({ where });
  }

  /**
   * Remove events older than the given date. Returns the number of deleted rows.
   */
  async cleanOldEvents(before: Date): Promise<number> {
    const db = this.getDb();
    const result = await db.eventStore.deleteMany({
      where: {
        timestamp: { lt: before },
      },
    });
    return result.count;
  }
}
