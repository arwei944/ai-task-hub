import { type DomainEvent, type EventCallback, type IEventBus, type OnOptions, type Unsubscribe } from './types';

export class EventBus implements IEventBus {
  private listeners = new Map<string, Set<{ callback: EventCallback; priority: number }>>();
  private maxListeners = 100;

  emit(event: DomainEvent): void {
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
}
