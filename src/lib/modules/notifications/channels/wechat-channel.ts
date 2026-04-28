import type { INotificationChannel, Notification } from '../types';
import type { ILogger } from '@/lib/core/types';

/**
 * WeChat Work notification channel
 * Sends notifications via WeChat Work Bot webhook
 */
export class WeChatNotificationChannel implements INotificationChannel {
  readonly id = 'wechat';
  readonly name = '企业微信通知';

  constructor(private logger?: ILogger) {}

  async send(notification: Notification): Promise<void> {
    const webhookUrl = process.env.WECHAT_BOT_WEBHOOK_URL;
    if (!webhookUrl) {
      this.logger?.warn('WeChatNotificationChannel: webhook URL not configured');
      return;
    }

    const levelLabel: Record<string, string> = {
      info: 'ℹ️信息', warning: '⚠️警告', error: '🚨错误', success: '✅成功',
    };

    const content = [
      `${levelLabel[notification.level] ?? '📢'} ${notification.title}`,
      notification.message ? `\n${notification.message}` : '',
      `\n${new Date(notification.createdAt ?? Date.now()).toLocaleString()}`,
    ].join('\n');

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          msgtype: 'text',
          text: { content },
        }),
      });

      const data = await response.json();
      if (data.errcode !== 0) {
        this.logger?.warn(`WeChatNotificationChannel: ${data.errmsg}`);
      }
    } catch (error: any) {
      this.logger?.error(`WeChatNotificationChannel: ${error.message}`);
    }
  }
}
