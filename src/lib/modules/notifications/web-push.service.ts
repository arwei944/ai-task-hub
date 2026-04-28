// ============================================================
// Web Push Notification Service
// ============================================================
// Basic in-memory Web Push subscription management.
// This is a foundation that can be enhanced later with:
//   - Persistent storage (database)
//   - VAPID keys + web-push library
//   - Subscription expiration handling
// ============================================================

import type { ILogger } from '@/lib/core/types';

/** Minimal shape of a PushSubscription JSON (what the client sends) */
export interface PushSubscriptionLike {
  endpoint: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
}

/** Internal stored subscription with metadata */
export interface StoredSubscription {
  subscription: PushSubscriptionLike;
  subscribedAt: Date;
}

export class WebPushService {
  private subscriptions = new Map<string, StoredSubscription>();
  private logger?: ILogger;

  constructor(logger?: ILogger) {
    this.logger = logger;
  }

  // ----------------------------------------------------------
  // Subscription management
  // ----------------------------------------------------------

  /** Store (or replace) a push subscription for a user. */
  subscribe(userId: string, subscription: PushSubscriptionLike): void {
    this.subscriptions.set(userId, {
      subscription,
      subscribedAt: new Date(),
    });
    this.logger?.info(`WebPush: user ${userId} subscribed (${subscription.endpoint.slice(0, 60)}...)`);
  }

  /** Remove a user's push subscription. */
  unsubscribe(userId: string): boolean {
    const removed = this.subscriptions.delete(userId);
    if (removed) {
      this.logger?.info(`WebPush: user ${userId} unsubscribed`);
    }
    return removed;
  }

  /** Check whether a user has an active subscription. */
  hasSubscription(userId: string): boolean {
    return this.subscriptions.has(userId);
  }

  /** Return the number of active subscriptions. */
  get subscriptionCount(): number {
    return this.subscriptions.size;
  }

  // ----------------------------------------------------------
  // Sending notifications
  // ----------------------------------------------------------

  /**
   * Send a push notification to a specific user.
   *
   * For this basic implementation we log the notification payload.
   * A production version would use the `web-push` npm package with
   * VAPID keys to deliver the notification via the Push API.
   */
  async sendNotification(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<boolean> {
    const stored = this.subscriptions.get(userId);
    if (!stored) {
      this.logger?.warn(`WebPush: no subscription for user ${userId}`);
      return false;
    }

    const payload = JSON.stringify({ title, body, data });

    // Basic implementation: log the notification.
    // Replace with web-push library call when VAPID keys are available:
    //   await webpush.sendNotification(stored.subscription, payload, { vapidDetails: { ... } });
    this.logger?.info(
      `WebPush: notification queued for user ${userId} — title="${title}" body="${body}"`,
    );

    return true;
  }

  /** Send a push notification to all subscribed users. */
  async sendToAll(
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    for (const userId of this.subscriptions.keys()) {
      const ok = await this.sendNotification(userId, title, body, data);
      if (ok) {
        sent++;
      } else {
        failed++;
      }
    }

    this.logger?.info(`WebPush: broadcast complete — sent=${sent} failed=${failed}`);
    return { sent, failed };
  }
}
