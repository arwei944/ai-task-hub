// ============================================================
// AI Task Hub - Event Types
// Typed interfaces for the event system
// ============================================================

import type { DomainEvent } from '../types';
import type { z } from 'zod';

export interface TypedDomainEvent<T = unknown> extends DomainEvent {
  payload: T;
}

export interface EventFilter {
  eventType?: string;
  source?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

export interface EventStoreEntry {
  id: string;
  eventType: string;
  payload: unknown;
  source: string | null;
  timestamp: Date;
  version: number;
}
