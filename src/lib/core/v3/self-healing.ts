// ============================================================
// v3 Self-Healing Integration
// ============================================================
//
// Connects HealthMonitor with all 7 capabilities, adds:
// - Periodic health checks (30s interval)
// - SSE real-time health status push
// - Circuit breakers for SOLO Bridge and external integrations
// - DLQ monitoring, auto-retry, and manual replay
//
// This module is registered as part of the AppKernel boot process.
// ============================================================

import type { Capability, HealthReport } from './types';
import { HealthMonitor, CircuitBreaker } from './health';

// ---- SSE Health Push ----

type HealthListener = (data: HealthEvent) => void;

interface HealthEvent {
  type: 'health.check' | 'health.degraded' | 'health.recovered' | 'circuit.state_change';
  capabilityId: string;
  report?: HealthReport;
  circuitState?: string;
  timestamp: number;
}

class HealthEventEmitter {
  private listeners = new Set<HealthListener>();

  subscribe(listener: HealthListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: HealthEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Listener errors should not break the emitter
      }
    }
  }

  getListenerCount(): number {
    return this.listeners.size;
  }
}

// ---- Circuit Breaker Registry ----

class CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>();

  register(id: string, config?: { failureThreshold?: number; resetTimeoutMs?: number; successThreshold?: number }): CircuitBreaker {
    if (this.breakers.has(id)) {
      return this.breakers.get(id)!;
    }
    const breaker = new CircuitBreaker(config);
    this.breakers.set(id, breaker);
    return breaker;
  }

  get(id: string): CircuitBreaker | undefined {
    return this.breakers.get(id);
  }

  getAllStatuses(): Record<string, { state: string; failures: number }> {
    const statuses: Record<string, { state: string; failures: number }> = {};
    for (const [id, breaker] of this.breakers) {
      statuses[id] = {
        state: breaker.getState(),
        failures: breaker.getFailureCount(),
      };
    }
    return statuses;
  }
}

// ---- DLQ Management ----

interface DLQEntry {
  id: string;
  event: string;
  payload: unknown;
  error: string;
  retries: number;
  maxRetries: number;
  firstFailedAt: number;
  lastRetryAt: number;
  nextRetryAt: number;
}

class DLQManager {
  private queue: DLQEntry[] = [];
  private maxRetries: number;
  private baseRetryDelayMs: number;
  private processing = false;

  constructor(maxRetries = 5, baseRetryDelayMs = 5000) {
    this.maxRetries = maxRetries;
    this.baseRetryDelayMs = baseRetryDelayMs;
  }

  /** Add a failed event to the DLQ */
  enqueue(event: string, payload: unknown, error: string): DLQEntry {
    const entry: DLQEntry = {
      id: crypto.randomUUID(),
      event,
      payload,
      error,
      retries: 0,
      maxRetries: this.maxRetries,
      firstFailedAt: Date.now(),
      lastRetryAt: 0,
      nextRetryAt: Date.now() + this.baseRetryDelayMs,
    };
    this.queue.push(entry);
    return entry;
  }

  /** Get all DLQ entries */
  getAll(): DLQEntry[] {
    return [...this.queue];
  }

  /** Get entries ready for retry */
  getReadyForRetry(): DLQEntry[] {
    const now = Date.now();
    return this.queue.filter(e => e.retries < e.maxRetries && e.nextRetryAt <= now);
  }

  /** Get DLQ stats */
  getStats(): { total: number; pending: number; exhausted: number; oldestEntryAge: number } {
    const now = Date.now();
    const pending = this.queue.filter(e => e.retries < e.maxRetries).length;
    const exhausted = this.queue.filter(e => e.retries >= e.maxRetries).length;
    const oldest = this.queue.length > 0 ? now - this.queue[0].firstFailedAt : 0;

    return { total: this.queue.length, pending, exhausted, oldestEntryAge: oldest };
  }

  /** Mark an entry as retried (success or failure) */
  markRetried(entryId: string, success: boolean): void {
    const entry = this.queue.find(e => e.id === entryId);
    if (!entry) return;

    entry.lastRetryAt = Date.now();

    if (success) {
      this.queue = this.queue.filter(e => e.id !== entryId);
    } else {
      entry.retries++;
      // Exponential backoff
      entry.nextRetryAt = Date.now() + this.baseRetryDelayMs * Math.pow(2, entry.retries);
    }
  }

  /** Remove a specific entry (manual purge) */
  remove(entryId: string): boolean {
    const before = this.queue.length;
    this.queue = this.queue.filter(e => e.id !== entryId);
    return this.queue.length < before;
  }

  /** Clear exhausted entries */
  purgeExhausted(): number {
    const before = this.queue.length;
    this.queue = this.queue.filter(e => e.retries < e.maxRetries);
    return before - this.queue.length;
  }

  /** Clear all entries */
  clear(): number {
    const count = this.queue.length;
    this.queue = [];
    return count;
  }
}

// ---- Self-Healing Manager (main entry point) ----

export class SelfHealingManager {
  readonly healthMonitor: HealthMonitor;
  readonly eventEmitter: HealthEventEmitter;
  readonly circuitBreakers: CircuitBreakerRegistry;
  readonly dlq: DLQManager;

  constructor() {
    this.eventEmitter = new HealthEventEmitter();
    this.circuitBreakers = new CircuitBreakerRegistry();
    this.dlq = new DLQManager();

    this.healthMonitor = new HealthMonitor({
      intervalMs: 30000,
      onDegraded: (id, report) => {
        this.eventEmitter.emit({
          type: 'health.degraded',
          capabilityId: id,
          report,
          timestamp: Date.now(),
        });
      },
      onRecovered: (id, report) => {
        this.eventEmitter.emit({
          type: 'health.recovered',
          capabilityId: id,
          report,
          timestamp: Date.now(),
        });
      },
    });
  }

  /**
   * Register all capabilities with the health monitor.
   * Call this after AppKernel.boot().
   */
  registerCapabilities(capabilities: Capability[]): void {
    for (const cap of capabilities) {
      this.healthMonitor.register(cap.id, () => cap.healthCheck());
    }
  }

  /**
   * Start the self-healing system.
   * Begins periodic health checks.
   */
  start(): void {
    this.healthMonitor.start();
  }

  /**
   * Stop the self-healing system.
   */
  stop(): void {
    this.healthMonitor.stop();
  }

  /**
   * Subscribe to health events (for SSE push).
   */
  onHealthEvent(listener: HealthListener): () => void {
    return this.eventEmitter.subscribe(listener);
  }

  /**
   * Execute an operation with circuit breaker protection.
   */
  async withCircuitBreaker<T>(
    breakerId: string,
    fn: () => Promise<T>,
    config?: { failureThreshold?: number; resetTimeoutMs?: number; successThreshold?: number },
  ): Promise<T> {
    const breaker = this.circuitBreakers.register(breakerId, config);
    const prevState = breaker.getState();

    try {
      const result = await breaker.execute(fn);
      return result;
    } finally {
      const newState = breaker.getState();
      if (newState !== prevState) {
        this.eventEmitter.emit({
          type: 'circuit.state_change',
          capabilityId: breakerId,
          circuitState: newState,
          timestamp: Date.now(),
        });
      }
    }
  }

  /**
   * Get comprehensive self-healing status.
   */
  getStatus(): {
    health: Record<string, HealthReport>;
    circuits: Record<string, { state: string; failures: number }>;
    dlq: ReturnType<DLQManager['getStats']>;
  } {
    return {
      health: this.healthMonitor.getAllReports(),
      circuits: this.circuitBreakers.getAllStatuses(),
      dlq: this.dlq.getStats(),
    };
  }
}

// Singleton
let _instance: SelfHealingManager | null = null;

export function getSelfHealingManager(): SelfHealingManager {
  if (!_instance) {
    _instance = new SelfHealingManager();
  }
  return _instance;
}

export type { HealthEvent, HealthListener, DLQEntry };
