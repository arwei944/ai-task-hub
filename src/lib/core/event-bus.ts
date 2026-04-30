import { type DomainEvent, type EventCallback, type IEventBus, type OnOptions, type Unsubscribe } from './types';
import { type EventStore } from './events/event-store';
import { type EventFilter, type EventStoreEntry } from './events/types';
import { eventSchemas } from './events/schemas';

export interface EventBusConfig {
  eventStore?: EventStore;
  validateEvents?: boolean;
}

export class EventBus implements IEventBus {
  private listeners = new Map<string, Set<{ callback: EventCallback; priority: number }>>();
  private maxListeners = 100;
  private eventStore?: EventStore;
  private validateEvents: boolean;

  constructor(config?: EventBusConfig) {
    this.eventStore = config?.eventStore;
    this.validateEvents = config?.validateEvents ?? false;
  }

  /**
   * Validate an event payload against its registered schema.
   * Returns true if valid or if no schema exists for the event type.
   * Throws if validation is enabled and the payload is invalid.
   */
  private validateEvent(event: DomainEvent): boolean {
    if (!this.validateEvents) return true;

    const schema = eventSchemas[event.type];
    if (!schema) {
      // No schema registered for this event type - allow it
      return true;
    }

    const result = schema.safeParse(event.payload);
    if (!result.success) {
      throw new Error(
        `[EventBus] Event validation failed for "${event.type}": ${result.error.message}`
      );
    }

    return true;
  }

  /**
   * Persist event to EventStore if configured.
   * Errors are logged but do not break the emit flow.
   */
  private async persistEvent(event: DomainEvent): Promise<void> {
    if (!this.eventStore) return;
    try {
      await this.eventStore.persist(event);
    } catch (error) {
      console.error(`[EventBus] Failed to persist event "${event.type}":`, error);
    }
  }

  emit(event: DomainEvent): void {
    // Validate event if validation is enabled
    try {
      this.validateEvent(event);
    } catch (error) {
      console.error(`[EventBus]`, error);
      return;
    }

    // Persist event (fire-and-forget in sync context)
    this.persistEvent(event).catch(() => {});

    // Notify specific type listeners
    const handlers = this.listeners.get(event.type);
    if (handlers && handlers.size > 0) {
      const sorted = [...handlers].sort((a, b) => b.priority - a.priority);
      for (const { callback } of sorted) {
        try {
          callback(event);
        } catch (error) {
          console.error(`[EventBus] Error in handler for "${event.type}":`, error);
        }
      }
    }

    // Notify wildcard listeners
    const wildcardHandlers = this.listeners.get('*');
    if (wildcardHandlers && wildcardHandlers.size > 0) {
      const sorted = [...wildcardHandlers].sort((a, b) => b.priority - a.priority);
      for (const { callback } of sorted) {
        try {
          callback(event);
        } catch (error) {
          console.error(`[EventBus] Error in wildcard handler:`, error);
        }
      }
    }
  }

  async emitAsync(event: DomainEvent): Promise<void> {
    // Validate event if validation is enabled
    this.validateEvent(event);

    // Persist event
    await this.persistEvent(event);

    // Notify specific type listeners
    const handlers = this.listeners.get(event.type);
    if (handlers && handlers.size > 0) {
      const sorted = [...handlers].sort((a, b) => b.priority - a.priority);
      for (const { callback } of sorted) {
        try {
          await callback(event);
        } catch (error) {
          console.error(`[EventBus] Error in async handler for "${event.type}":`, error);
        }
      }
    }

    // Notify wildcard listeners
    const wildcardHandlers = this.listeners.get('*');
    if (wildcardHandlers && wildcardHandlers.size > 0) {
      const sorted = [...wildcardHandlers].sort((a, b) => b.priority - a.priority);
      for (const { callback } of sorted) {
        try {
          await callback(event);
        } catch (error) {
          console.error(`[EventBus] Error in wildcard handler:`, error);
        }
      }
    }
  }

  on(eventType: string, callback: EventCallback, options?: OnOptions): Unsubscribe {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    const handlers = this.listeners.get(eventType)!;

    if (handlers.size >= this.maxListeners) {
      console.warn(`[EventBus] Max listeners (${this.maxListeners}) reached for "${eventType}"`);
    }

    const entry = { callback, priority: options?.priority ?? 0 };
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

  // --- v2 EventStore integration methods ---

  /**
   * Query stored events from the EventStore.
   */
  async queryEvents(filter: EventFilter): Promise<EventStoreEntry[]> {
    if (!this.eventStore) {
      throw new Error('[EventBus] EventStore is not configured');
    }
    return this.eventStore.query(filter);
  }

  /**
   * Replay stored events of a given type through the event bus.
   */
  async replayEvents(eventType: string, from?: Date): Promise<void> {
    if (!this.eventStore) {
      throw new Error('[EventBus] EventStore is not configured');
    }
    await this.eventStore.replay(eventType, from, (event) => {
      this.emit(event);
    });
  }

  /**
   * Get the total count of stored events, optionally filtered by type.
   */
  async getEventCount(eventType?: string): Promise<number> {
    if (!this.eventStore) {
      throw new Error('[EventBus] EventStore is not configured');
    }
    return this.eventStore.getEventCount(eventType);
  }
}
