import type { INotificationChannel, Notification } from '../types';
import type { ILogger } from '@/lib/core/types';

/**
 * Browser Push notification channel
 * Stores notifications for client-side polling
 */
export class BrowserPushChannel implements INotificationChannel {
  readonly id = 'browser_push';
  readonly name = '浏览器推送';

  private pendingNotifications: Notification[] = [];
  private maxPending = 100;

  constructor(private logger?: ILogger) {}

  async send(notification: Notification): Promise<void> {
    this.pendingNotifications.unshift(notification);
    if (this.pendingNotifications.length > this.maxPending) {
      this.pendingNotifications = this.pendingNotifications.slice(0, this.maxPending);
    }
    this.logger?.debug(`BrowserPushChannel: notification queued (${this.pendingNotifications.length} pending)`);
  }

  /**
   * Get pending notifications (for client polling)
   */
  getPending(): Notification[] {
    return [...this.pendingNotifications];
  }

  /**
   * Clear pending notifications
   */
  clearPending(): void {
    this.pendingNotifications = [];
  }
}
