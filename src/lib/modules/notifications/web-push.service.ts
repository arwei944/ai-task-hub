// ============================================================
// Web Push Notification Service
// ============================================================
// Web Push subscription management with real push notification delivery.
// Uses the `web-push` npm package (optional dependency).
// Falls back to logging-only mode when web-push is not installed
// or VAPID keys are not configured.
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
  private webPushModule: any = null;
  private vapidConfigured = false;

  constructor(logger?: ILogger) {
    this.logger = logger;
  }

  // ----------------------------------------------------------
  // VAPID Key Management
  // ----------------------------------------------------------

  /**
   * Generate a new VAPID key pair.
   * Requires the `web-push` package to be installed.
   * @returns Object with publicKey and privateKey, or null if web-push is not available.
   */
  static async generateVAPIDKeys(): Promise<{
    publicKey: string;
    privateKey: string;
  } | null> {
    try {
      const webpush = await import('web-push');
      const vapidKeys = webpush.generateVAPIDKeys();
      return {
        publicKey: vapidKeys.publicKey,
        privateKey: vapidKeys.privateKey,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get the configured VAPID public key for frontend subscription.
   * @returns The VAPID public key string, or null if not configured.
   */
  getVAPIDPublicKey(): string | null {
    return process.env.VAPID_PUBLIC_KEY ?? null;
  }

  /**
   * Check if VAPID is configured and web-push is available.
   */
  private async ensureWebPush(): Promise<boolean> {
    if (this.webPushModule) return true;

    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT;

    if (!publicKey || !privateKey || !subject) {
      if (!this.vapidConfigured) {
        this.logger?.warn(
          'WebPush: VAPID keys not configured (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT). Falling back to logging mode.',
        );
        this.vapidConfigured = true; // Only warn once
      }
      return false;
    }

    try {
      const webpush = await import('web-push');
      webpush.setVapidDetails(
        subject,
        publicKey,
        privateKey,
      );
      this.webPushModule = webpush;
      this.logger?.info('WebPush: VAPID configured, real push notifications enabled');
      return true;
    } catch {
      if (!this.vapidConfigured) {
        this.logger?.warn(
          'WebPush: web-push package not installed. Install with: pnpm add web-push. Falling back to logging mode.',
        );
        this.vapidConfigured = true;
      }
      return false;
    }
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
   * Uses real Web Push when web-push is installed and VAPID keys are configured.
   * Falls back to logging when not available.
   *
   * @returns true if the notification was sent (or logged), false if no subscription exists.
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

    const isRealPush = await this.ensureWebPush();

    if (isRealPush && this.webPushModule) {
      try {
        await this.webPushModule.sendNotification(
          stored.subscription,
          payload,
          {
            TTL: 60,
          },
        );
        this.logger?.info(
          `WebPush: push notification sent to user ${userId} — title="${title}"`,
        );
        return true;
      } catch (error: any) {
        // Handle WebPushError - expired or invalid subscription
        if (error.statusCode === 404 || error.statusCode === 410) {
          this.logger?.warn(
            `WebPush: subscription expired for user ${userId}, auto-unsubscribing (status: ${error.statusCode})`,
          );
          this.subscriptions.delete(userId);
          return false;
        }
        this.logger?.error(
          `WebPush: failed to send to user ${userId}: ${error.message}`,
        );
        return false;
      }
    }

    // Fallback: log the notification
    this.logger?.info(
      `WebPush: notification queued for user ${userId} — title="${title}" body="${body}"`,
    );
    return true;
  }

  /**
   * Send a push notification to multiple specific users.
   * @param userIds Array of user IDs to send to.
   * @returns Object with sent and failed counts.
   */
  async sendToUsers(
    userIds: string[],
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<{ sent: number; failed: number; results: Array<{ userId: string; success: boolean }> }> {
    const results: Array<{ userId: string; success: boolean }> = [];

    for (const userId of userIds) {
      const ok = await this.sendNotification(userId, title, body, data);
      results.push({ userId, success: ok });
    }

    const sent = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    this.logger?.info(
      `WebPush: multi-user send complete — sent=${sent} failed=${failed} total=${userIds.length}`,
    );

    return { sent, failed, results };
  }

  /** Send a push notification to all subscribed users. */
  async sendToAll(
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<{ sent: number; failed: number }> {
    const userIds = Array.from(this.subscriptions.keys());
    const { sent, failed } = await this.sendToUsers(userIds, title, body, data);

    this.logger?.info(`WebPush: broadcast complete — sent=${sent} failed=${failed}`);
    return { sent, failed };
  }
}
