// ============================================================
// AI Task Hub v3.0 — Lightweight EventBus
// ============================================================
// 轻量级事件总线，~200 行，编译时类型安全 + DLQ + 指标
// ============================================================

import type {
  EventType,
  EventEnvelope,
  EventPayload,
  IEventBus,
  EventBusMetrics,
} from './types';

export interface EventBusConfig {
  enableDLQ?: boolean;
  maxDLQSize?: number;
  maxRetries?: number;
}

export interface DeadLetterEntry {
  id: string;
  event: EventEnvelope;
  handlerName: string;
  error: string;
  retryCount: number;
  maxRetries: number;
  firstFailedAt: number;
  lastFailedAt: number;
  nextRetryAt: number | null;
}

type HandlerEntry<T extends EventType = EventType> = {
  handler: (event: EventEnvelope<T>) => void | Promise<void>;
  name: string;
  priority: number;
};

export class EventBus implements IEventBus {
  private handlers = new Map<string, Set<HandlerEntry>>();
  private dlq: DeadLetterEntry[] = [];
  private enableDLQ: boolean;
  private maxDLQSize: number;
  private maxRetries: number;

  // 指标
  private metrics = {
    totalEmitted: 0,
    totalHandled: 0,
    totalFailed: 0,
    byType: {} as Record<string, { emitted: number; handled: number; failed: number }>,
  };

  constructor(config?: EventBusConfig) {
    this.enableDLQ = config?.enableDLQ ?? true;
    this.maxDLQSize = config?.maxDLQSize ?? 1000;
    this.maxRetries = config?.maxRetries ?? 3;
  }

  // ==================== Emit ====================

  emit<T extends EventType>(event: EventEnvelope<T>): void {
    this.recordEmit(event.type);

    const listeners = this.handlers.get(event.type);
    if (!listeners || listeners.size === 0) return;

    const sorted = [...listeners].sort((a, b) => b.priority - a.priority);

    for (const entry of sorted) {
      try {
        entry.handler(event);
        this.recordSuccess(event.type);
      } catch (err) {
        this.recordFailure(event.type);
        this.addToDLQ(event, entry.name, err as Error);
        console.error(`[EventBus:v3] Handler error for "${event.type}" [${entry.name}]:`, err);
      }
    }
  }

  // ==================== Subscribe ====================

  on<T extends EventType>(
    type: T,
    handler: (event: EventEnvelope<T>) => void | Promise<void>
  ): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    const set = this.handlers.get(type)!;

    const entry: HandlerEntry<T> = {
      handler: handler as HandlerEntry['handler'],
      name: handler.name || 'anonymous',
      priority: 0,
    };
    set.add(entry as HandlerEntry);

    return () => {
      set.delete(entry as HandlerEntry);
      if (set.size === 0) {
        this.handlers.delete(type);
      }
    };
  }

  once<T extends EventType>(
    type: T,
    handler: (event: EventEnvelope<T>) => void
  ): () => void {
    const unsub = this.on(type, (event) => {
      unsub();
      handler(event);
    });
    return unsub;
  }

  off<T extends EventType>(
    type: T,
    handler: (event: EventEnvelope<T>) => void
  ): void {
    const set = this.handlers.get(type);
    if (!set) return;
    for (const entry of set) {
      if (entry.handler === handler) {
        set.delete(entry);
        break;
      }
    }
    if (set.size === 0) {
      this.handlers.delete(type);
    }
  }

  removeAllListeners(type?: EventType): void {
    if (type) {
      this.handlers.delete(type);
    } else {
      this.handlers.clear();
    }
  }

  // ==================== Metrics ====================

  private recordEmit(type: string): void {
    this.metrics.totalEmitted++;
    if (!this.metrics.byType[type]) {
      this.metrics.byType[type] = { emitted: 0, handled: 0, failed: 0 };
    }
    this.metrics.byType[type].emitted++;
  }

  private recordSuccess(type: string): void {
    this.metrics.totalHandled++;
    if (this.metrics.byType[type]) {
      this.metrics.byType[type].handled++;
    }
  }

  private recordFailure(type: string): void {
    this.metrics.totalFailed++;
    if (this.metrics.byType[type]) {
      this.metrics.byType[type].failed++;
    }
  }

  getMetrics(): EventBusMetrics {
    return {
      totalEmitted: this.metrics.totalEmitted,
      totalHandled: this.metrics.totalHandled,
      totalFailed: this.metrics.totalFailed,
      dlqSize: this.dlq.length,
      byType: { ...this.metrics.byType },
    };
  }

  resetMetrics(): void {
    this.metrics = { totalEmitted: 0, totalHandled: 0, totalFailed: 0, byType: {} };
  }

  // ==================== DLQ ====================

  private addToDLQ(event: EventEnvelope, handlerName: string, error: Error): void {
    if (!this.enableDLQ) return;

    // 检查是否已存在
    const existing = this.dlq.find(
      e => e.event.type === event.type &&
           e.event.timestamp === event.timestamp &&
           e.handlerName === handlerName
    );

    if (existing) {
      existing.retryCount++;
      existing.lastFailedAt = Date.now();
      existing.error = error.message;
      if (existing.retryCount < this.maxRetries) {
        existing.nextRetryAt = Date.now() + this.getRetryDelay(existing.retryCount);
      } else {
        existing.nextRetryAt = null;
      }
      return;
    }

    // 容量限制
    if (this.dlq.length >= this.maxDLQSize) {
      this.dlq.shift();
    }

    this.dlq.push({
      id: `dlq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      event,
      handlerName,
      error: error.message,
      retryCount: 1,
      maxRetries: this.maxRetries,
      firstFailedAt: Date.now(),
      lastFailedAt: Date.now(),
      nextRetryAt: Date.now() + this.getRetryDelay(1),
    });
  }

  private getRetryDelay(retryCount: number): number {
    return Math.min(1000 * Math.pow(4, retryCount), 300000); // max 5min
  }

  getDLQ(): DeadLetterEntry[] {
    return [...this.dlq];
  }

  getDLQSize(): number {
    return this.dlq.length;
  }

  clearDLQ(): number {
    const count = this.dlq.length;
    this.dlq = [];
    return count;
  }

  removeFromDLQ(id: string): boolean {
    const before = this.dlq.length;
    this.dlq = this.dlq.filter(e => e.id !== id);
    return this.dlq.length < before;
  }

  // ==================== Helpers ====================

  /** 获取指定事件类型的监听器数量 */
  getListenerCount(type?: string): number {
    if (type) {
      return this.handlers.get(type)?.size ?? 0;
    }
    let total = 0;
    for (const set of this.handlers.values()) {
      total += set.size;
    }
    return total;
  }

  /** 获取所有已注册的事件类型 */
  getRegisteredEventTypes(): string[] {
    return [...this.handlers.keys()];
  }
}

// --- 全局单例 ---
let _globalBus: EventBus | null = null;

export function getGlobalEventBus(): EventBus {
  if (!_globalBus) {
    _globalBus = new EventBus();
  }
  return _globalBus;
}
