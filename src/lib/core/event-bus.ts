import { type DomainEvent, type EventCallback, type IEventBus, type OnOptions, type Unsubscribe } from './types';
import { type EventStore } from './events/event-store';
import { type EventFilter, type EventStoreEntry } from './events/types';
import { eventSchemas } from './events/schemas';

export interface EventBusConfig {
  eventStore?: EventStore;
  validateEvents?: boolean;
  /** Enable dead letter queue for failed events */
  enableDLQ?: boolean;
  /** Max retry attempts for failed handlers (default: 3) */
  maxRetries?: number;
  /** Event TTL in hours (default: 168 = 7 days, 0 = no TTL) */
  eventTTLHours?: number;
  /** Max dead letter queue size (default: 1000) */
  maxDLQSize?: number;
}

export interface DeadLetterEntry {
  id: string;
  event: DomainEvent;
  handlerName: string;
  error: string;
  retryCount: number;
  maxRetries: number;
  firstFailedAt: Date;
  lastFailedAt: Date;
  nextRetryAt: Date | null;
}

export interface EventBusMetrics {
  totalEmitted: number;
  totalHandled: number;
  totalFailed: number;
  totalRetried: number;
  totalDLQ: number;
  byType: Record<string, { emitted: number; handled: number; failed: number }>;
  handlersByType: Record<string, number>;
}

export class EventBus implements IEventBus {
  private listeners = new Map<string, Set<{ callback: EventCallback; priority: number; name?: string }>>();
  private maxListeners = 100;
  private eventStore?: EventStore;
  private validateEvents: boolean;

  // DLQ & Retry
  private deadLetterQueue: DeadLetterEntry[] = [];
  private enableDLQ: boolean;
  private maxRetries: number;
  private maxDLQSize: number;
  private eventTTLHours: number;

  // Metrics
  private metrics = {
    totalEmitted: 0,
    totalHandled: 0,
    totalFailed: 0,
    totalRetried: 0,
    byType: {} as Record<string, { emitted: number; handled: number; failed: number }>,
  };

  constructor(config?: EventBusConfig) {
    this.eventStore = config?.eventStore;
    this.validateEvents = config?.validateEvents ?? false;
    this.enableDLQ = config?.enableDLQ ?? true;
    this.maxRetries = config?.maxRetries ?? 3;
    this.maxDLQSize = config?.maxDLQSize ?? 1000;
    this.eventTTLHours = config?.eventTTLHours ?? 168; // 7 days
  }

  // ==================== Validation ====================

  private validateEvent(event: DomainEvent): boolean {
    if (!this.validateEvents) return true;

    const schema = eventSchemas[event.type];
    if (!schema) return true;

    const result = schema.safeParse(event.payload);
    if (!result.success) {
      throw new Error(
        `[EventBus] Event validation failed for "${event.type}": ${result.error.message}`
      );
    }

    return true;
  }

  // ==================== Persistence ====================

  private async persistEvent(event: DomainEvent): Promise<void> {
    if (!this.eventStore) return;
    try {
      await this.eventStore.persist(event);
    } catch (error) {
      console.error(`[EventBus] Failed to persist event "${event.type}":`, error);
    }
  }

  // ==================== Metrics ====================

  private recordEmit(eventType: string): void {
    this.metrics.totalEmitted++;
    if (!this.metrics.byType[eventType]) {
      this.metrics.byType[eventType] = { emitted: 0, handled: 0, failed: 0 };
    }
    this.metrics.byType[eventType].emitted++;
  }

  private recordSuccess(eventType: string): void {
    this.metrics.totalHandled++;
    if (this.metrics.byType[eventType]) {
      this.metrics.byType[eventType].handled++;
    }
  }

  private recordFailure(eventType: string): void {
    this.metrics.totalFailed++;
    if (this.metrics.byType[eventType]) {
      this.metrics.byType[eventType].failed++;
    }
  }

  getMetrics(): EventBusMetrics {
    const handlersByType: Record<string, number> = {};
    for (const [type, handlers] of this.listeners.entries()) {
      if (type !== '*') {
        handlersByType[type] = handlers.size;
      }
    }

    return {
      totalEmitted: this.metrics.totalEmitted,
      totalHandled: this.metrics.totalHandled,
      totalFailed: this.metrics.totalFailed,
      totalRetried: this.metrics.totalRetried,
      totalDLQ: this.deadLetterQueue.length,
      byType: { ...this.metrics.byType },
      handlersByType,
    };
  }

  resetMetrics(): void {
    this.metrics = {
      totalEmitted: 0,
      totalHandled: 0,
      totalFailed: 0,
      totalRetried: 0,
      byType: {},
    };
  }

  // ==================== Dead Letter Queue ====================

  private addToDLQ(event: DomainEvent, handlerName: string, error: Error, retryCount: number): void {
    if (!this.enableDLQ) return;

    // Check if already in DLQ
    const existing = this.deadLetterQueue.find(
      e => e.event.type === event.type &&
           e.event.timestamp === event.timestamp &&
           e.handlerName === handlerName,
    );

    if (existing) {
      existing.retryCount = retryCount;
      existing.lastFailedAt = new Date();
      existing.error = error.message;
      if (retryCount < this.maxRetries) {
        existing.nextRetryAt = new Date(Date.now() + this.getRetryDelay(retryCount));
      } else {
        existing.nextRetryAt = null; // exhausted retries
      }
      return;
    }

    // Evict oldest if at capacity
    if (this.deadLetterQueue.length >= this.maxDLQSize) {
      this.deadLetterQueue.shift();
    }

    const entry: DeadLetterEntry = {
      id: `dlq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      event,
      handlerName,
      error: error.message,
      retryCount,
      maxRetries: this.maxRetries,
      firstFailedAt: new Date(),
      lastFailedAt: new Date(),
      nextRetryAt: retryCount < this.maxRetries
        ? new Date(Date.now() + this.getRetryDelay(retryCount))
        : null,
    };

    this.deadLetterQueue.push(entry);
  }

  private getRetryDelay(retryCount: number): number {
    // Exponential backoff: 1s, 4s, 16s, 64s...
    return Math.min(1000 * Math.pow(4, retryCount), 300000); // max 5 minutes
  }

  getDeadLetterQueue(): DeadLetterEntry[] {
    return [...this.deadLetterQueue];
  }

  getDeadLetterQueueSize(): number {
    return this.deadLetterQueue.length;
  }

  /** Get entries eligible for retry */
  getRetryableEntries(): DeadLetterEntry[] {
    const now = new Date();
    return this.deadLetterQueue.filter(e => e.nextRetryAt && e.nextRetryAt <= now);
  }

  /** Retry all eligible DLQ entries */
  async retryDLQ(): Promise<{ retried: number; succeeded: number; failed: number }> {
    const eligible = this.getRetryableEntries();
    let succeeded = 0;
    let failed = 0;

    for (const entry of eligible) {
      try {
        await this.handleWithRetry(entry.event, entry.handlerName, entry.retryCount);
        // Remove from DLQ on success
        this.deadLetterQueue = this.deadLetterQueue.filter(e => e.id !== entry.id);
        succeeded++;
      } catch {
        failed++;
      }
    }

    return { retried: eligible.length, succeeded, failed };
  }

  /** Remove entry from DLQ */
  removeFromDLQ(id: string): boolean {
    const before = this.deadLetterQueue.length;
    this.deadLetterQueue = this.deadLetterQueue.filter(e => e.id !== id);
    return this.deadLetterQueue.length < before;
  }

  /** Clear entire DLQ */
  clearDLQ(): number {
    const count = this.deadLetterQueue.length;
    this.deadLetterQueue = [];
    return count;
  }

  // ==================== Event TTL ====================

  /** Clean up expired events from EventStore */
  async cleanExpiredEvents(): Promise<number> {
    if (!this.eventStore || this.eventTTLHours <= 0) return 0;

    const cutoff = new Date(Date.now() - this.eventTTLHours * 60 * 60 * 1000);
    try {
      // Use the event store's clean method if available
      const store = this.eventStore as any;
      if (typeof store.cleanOldEvents === 'function') {
        return await store.cleanOldEvents(cutoff);
      }
    } catch (error) {
      console.error('[EventBus] Failed to clean expired events:', error);
    }
    return 0;
  }

  // ==================== Emit ====================

  emit(event: DomainEvent): void {
    try {
      this.validateEvent(event);
    } catch (error) {
      console.error(`[EventBus]`, error);
      return;
    }

    this.recordEmit(event.type);
    this.persistEvent(event).catch(() => {});

    // Notify specific type listeners
    const handlers = this.listeners.get(event.type);
    if (handlers && handlers.size > 0) {
      const sorted = [...handlers].sort((a, b) => b.priority - a.priority);
      for (const { callback, name } of sorted) {
        try {
          callback(event);
          this.recordSuccess(event.type);
        } catch (error) {
          this.recordFailure(event.type);
          this.addToDLQ(event, name || 'anonymous', error as Error, 1);
          console.error(`[EventBus] Error in handler for "${event.type}":`, error);
        }
      }
    }

    // Notify wildcard listeners
    const wildcardHandlers = this.listeners.get('*');
    if (wildcardHandlers && wildcardHandlers.size > 0) {
      const sorted = [...wildcardHandlers].sort((a, b) => b.priority - a.priority);
      for (const { callback, name } of sorted) {
        try {
          callback(event);
        } catch (error) {
          this.addToDLQ(event, name || 'wildcard', error as Error, 1);
          console.error(`[EventBus] Error in wildcard handler:`, error);
        }
      }
    }
  }

  async emitAsync(event: DomainEvent): Promise<void> {
    this.validateEvent(event);

    this.recordEmit(event.type);
    await this.persistEvent(event);

    // Notify specific type listeners
    const handlers = this.listeners.get(event.type);
    if (handlers && handlers.size > 0) {
      const sorted = [...handlers].sort((a, b) => b.priority - a.priority);
      for (const { callback, name } of sorted) {
        try {
          await callback(event);
          this.recordSuccess(event.type);
        } catch (error) {
          this.recordFailure(event.type);
          this.addToDLQ(event, name || 'anonymous', error as Error, 1);
          console.error(`[EventBus] Error in async handler for "${event.type}":`, error);
        }
      }
    }

    // Notify wildcard listeners
    const wildcardHandlers = this.listeners.get('*');
    if (wildcardHandlers && wildcardHandlers.size > 0) {
      const sorted = [...wildcardHandlers].sort((a, b) => b.priority - a.priority);
      for (const { callback, name } of sorted) {
        try {
          await callback(event);
        } catch (error) {
          this.addToDLQ(event, name || 'wildcard', error as Error, 1);
          console.error(`[EventBus] Error in wildcard handler:`, error);
        }
      }
    }
  }

  /**
   * Execute handler with retry logic
   */
  private async handleWithRetry(event: DomainEvent, handlerName: string, currentRetry: number): Promise<void> {
    const handlers = this.listeners.get(event.type);
    if (!handlers) return;

    // Find the handler by name, or fall back to first handler if name is anonymous
    let entry: { callback: EventCallback; priority: number; name?: string } | undefined;
    if (handlerName && handlerName !== 'anonymous') {
      entry = [...handlers].find(h => h.name === handlerName);
    }
    if (!entry) {
      // Fallback: use the first handler (backward compat for unnamed handlers)
      const sorted = [...handlers].sort((a, b) => b.priority - a.priority);
      entry = sorted[0];
    }
    if (!entry) return;

    try {
      await entry.callback(event);
      this.recordSuccess(event.type);

      // If this was a retry, remove from DLQ
      if (currentRetry > 0) {
        this.deadLetterQueue = this.deadLetterQueue.filter(
          e => !(e.event.type === event.type && e.event.timestamp === event.timestamp && e.handlerName === handlerName),
        );
        this.metrics.totalRetried++;
      }
    } catch (error) {
      this.recordFailure(event.type);
      const newRetryCount = currentRetry + 1;

      if (newRetryCount <= this.maxRetries) {
        this.addToDLQ(event, handlerName, error as Error, newRetryCount);
        // Wait and retry
        const delay = this.getRetryDelay(currentRetry);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.handleWithRetry(event, handlerName, newRetryCount);
      } else {
        // Max retries exceeded, keep in DLQ permanently
        this.addToDLQ(event, handlerName, error as Error, newRetryCount);
        throw error;
      }
    }
  }

  // ==================== Listener Management ====================

  on(eventType: string, callback: EventCallback, options?: OnOptions & { name?: string }): Unsubscribe {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    const handlers = this.listeners.get(eventType)!;

    if (handlers.size >= this.maxListeners) {
      console.warn(`[EventBus] Max listeners (${this.maxListeners}) reached for "${eventType}"`);
    }

    const entry = { callback, priority: options?.priority ?? 0, name: options?.name };
    handlers.add(entry);

    return () => {
      handlers.delete(entry);
      if (handlers.size === 0) {
        this.listeners.delete(eventType);
      }
    };
  }

  once(eventType: string, callback: EventCallback): Unsubscribe {
    const unsubscribe = this.on(eventType, (event) => {
      unsubscribe();
      callback(event);
    });
    return unsubscribe;
  }

  off(eventType: string, callback: EventCallback): void {
    const handlers = this.listeners.get(eventType);
    if (!handlers) return;
    for (const entry of handlers) {
      if (entry.callback === callback) {
        handlers.delete(entry);
        break;
      }
    }
    if (handlers.size === 0) {
      this.listeners.delete(eventType);
    }
  }

  removeAllListeners(eventType?: string): void {
    if (eventType) {
      this.listeners.delete(eventType);
    } else {
      this.listeners.clear();
    }
  }

  getListenerCount(eventType?: string): number {
    if (eventType) {
      return this.listeners.get(eventType)?.size ?? 0;
    }
    let total = 0;
    for (const handlers of this.listeners.values()) {
      total += handlers.size;
    }
    return total;
  }

  // ==================== EventStore Integration ====================

  async queryEvents(filter: EventFilter): Promise<EventStoreEntry[]> {
    if (!this.eventStore) {
      throw new Error('[EventBus] EventStore is not configured');
    }
    return this.eventStore.query(filter);
  }

  async replayEvents(eventType: string, from?: Date): Promise<void> {
    if (!this.eventStore) {
      throw new Error('[EventBus] EventStore is not configured');
    }
    await this.eventStore.replay(eventType, from, (event) => {
      this.emit(event);
    });
  }

  async getEventCount(eventType?: string): Promise<number> {
    if (!this.eventStore) {
      throw new Error('[EventBus] EventStore is not configured');
    }
    return this.eventStore.getEventCount(eventType);
  }
}
