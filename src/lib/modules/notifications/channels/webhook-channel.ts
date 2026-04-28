import type { INotificationChannel, Notification } from '../types';
import type { ILogger } from '@/lib/core/types';

/**
 * Webhook notification channel
 * Sends notifications to configured URLs via HTTP POST
 */
export class WebhookChannel implements INotificationChannel {
  readonly id = 'webhook';
  readonly name = 'Webhook 通知';

  private url: string;
  private secret?: string;

  constructor(url: string, secret?: string, private logger?: ILogger) {
    this.url = url;
    this.secret = secret;
  }

  async send(notification: Notification): Promise<void> {
    if (!this.url) {
      this.logger?.warn('WebhookChannel: no URL configured');
      return;
    }

    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.secret ? { 'X-Webhook-Secret': this.secret } : {}),
        },
        body: JSON.stringify({
          id: notification.id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          level: notification.level,
          timestamp: notification.createdAt ?? new Date().toISOString(),
          metadata: notification.metadata,
        }),
      });

      if (!response.ok) {
        this.logger?.warn(`WebhookChannel: ${response.status} from ${this.url}`);
      } else {
        this.logger?.debug(`WebhookChannel: notification sent to ${this.url}`);
      }
    } catch (error: any) {
      this.logger?.error(`WebhookChannel: failed to send - ${error.message}`);
      throw error;
    }
  }
}
