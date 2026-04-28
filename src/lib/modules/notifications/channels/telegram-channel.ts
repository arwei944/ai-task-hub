import type { INotificationChannel, Notification } from '../types';
import type { ILogger } from '@/lib/core/types';

/**
 * Telegram notification channel
 * Sends notifications via Telegram Bot
 */
export class TelegramNotificationChannel implements INotificationChannel {
  readonly id = 'telegram';
  readonly name = 'Telegram 通知';

  constructor(private logger?: ILogger) {}

  async send(notification: Notification): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_NOTIFY_CHAT_ID;
    if (!token || !chatId) {
      this.logger?.warn('TelegramNotificationChannel: token or chatId not configured');
      return;
    }

    const levelEmoji: Record<string, string> = {
      info: 'ℹ️', warning: '⚠️', error: '🚨', success: '✅',
    };

    const text = [
      `${levelEmoji[notification.level] ?? '📢'} <b>${notification.title}</b>`,
      notification.message ? `\n${notification.message}` : '',
      `\n<i>${new Date(notification.createdAt ?? Date.now()).toLocaleString()}</i>`,
    ].join('');

    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
        }),
      });

      if (!response.ok) {
        this.logger?.warn(`TelegramNotificationChannel: ${response.status}`);
      }
    } catch (error: any) {
      this.logger?.error(`TelegramNotificationChannel: ${error.message}`);
    }
  }
}
