// ============================================================
// AI Task Hub - Event Types
// Typed interfaces for the event system
// ============================================================

import type { DomainEvent } from '../types';
import type { z } from 'zod';

/**
 * A domain event with a typed payload.
 */
export interface TypedDomainEvent<T = unknown> extends DomainEvent {
  payload: T;
}

/**
 * Filter options for querying events from the EventStore.
 */
export interface EventFilter {
  eventType?: string;
  source?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

/**
 * A persisted event entry from the EventStore database table.
 */
export interface EventStoreEntry {
  id: string;
  eventType: string;
  payload: unknown;
  source: string | null;
  timestamp: Date;
  version: number;
}
