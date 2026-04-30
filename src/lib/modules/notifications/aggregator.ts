// ============================================================
// AI Task Hub - Notification Deduplication & Aggregation (v3)
// ============================================================

import type { ILogger } from '@/lib/core/types';

interface PendingNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  level: string;
  channel: string;
  metadata?: Record<string, unknown>;
  firstSeenAt: Date;
  lastSeenAt: Date;
  count: number;
  targetUserId?: string;
}

/**
 * Notification Aggregator
 *
 * Deduplicates and aggregates similar notifications within a time window.
 * Instead of sending 10 "task.status.changed" notifications for the same task,
 * it sends 1 aggregated notification with count.
 */
export class NotificationAggregator {
  private pending = new Map<string, PendingNotification>();
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private flushCallback: ((notifications: PendingNotification[]) => void) | null = null;

  /** Aggregation window in ms (default: 5 seconds) */
  private windowMs: number;
  /** Max pending notifications before auto-flush */
  private maxPending: number;

  constructor(
    private logger: ILogger,
    options?: {
      windowMs?: number;
      maxPending?: number;
    },
  ) {
    this.windowMs = options?.windowMs ?? 5000;
    this.maxPending = options?.maxPending ?? 100;
  }

  /**
   * Start the aggregation loop
   */
  start(flushCallback: (notifications: PendingNotification[]) => void): void {
    this.flushCallback = flushCallback;
    this.flushTimer = setInterval(() => this.flush(), this.windowMs);
    this.logger.info('Notification aggregator started');
  }

  /**
   * Stop the aggregation loop and flush remaining
   */
  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush();
    this.logger.info('Notification aggregator stopped');
  }

  /**
   * Add a notification to the aggregation buffer
   * Returns true if this is a new notification, false if it was deduplicated
   */
  add(params: {
    type: string;
    title: string;
    message: string;
    level: string;
    channel: string;
    metadata?: Record<string, unknown>;
    targetUserId?: string;
  }): { isNew: boolean; aggregatedCount: number } {
    // Generate dedup key from type + target + key metadata fields
    const dedupKey = this.generateDedupKey(params);

    const existing = this.pending.get(dedupKey);
    if (existing) {
      existing.count++;
      existing.lastSeenAt = new Date();
      return { isNew: false, aggregatedCount: existing.count };
    }

    const pending: PendingNotification = {
      id: `agg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: params.type,
      title: params.title,
      message: params.message,
      level: params.level,
      channel: params.channel,
      metadata: params.metadata,
      targetUserId: params.targetUserId,
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      count: 1,
    };

    this.pending.set(dedupKey, pending);

    // Auto-flush if too many pending
    if (this.pending.size >= this.maxPending) {
      this.flush();
    }

    return { isNew: true, aggregatedCount: 1 };
  }

  /**
   * Flush all pending notifications
   */
  flush(): void {
    if (this.pending.size === 0) return;

    const notifications = Array.from(this.pending.values());
    this.pending.clear();

    if (this.flushCallback) {
      this.flushCallback(notifications);
    }

    this.logger.debug(`Flushed ${notifications.length} aggregated notifications`);
  }

  /**
   * Get current pending count
   */
  get pendingCount(): number {
    return this.pending.size;
  }

  private generateDedupKey(params: {
    type: string;
    title: string;
    message: string;
    targetUserId?: string;
    metadata?: Record<string, unknown>;
  }): string {
    // Dedup by type + target user + first 50 chars of message
    const userPart = params.targetUserId || 'global';
    const messagePart = params.message.slice(0, 50);
    return `${params.type}:${userPart}:${messagePart}`;
  }
}
