import type { Module, ModuleContext } from '@/lib/core/types';
import { APP_VERSION } from '@/lib/core/version';

export default class NotificationsModule implements Module {
  id = 'notifications';
  name = '通知';
  version = APP_VERSION;
  description = '事件驱动通知系统，支持可插拔通知渠道和规则引擎';

  lifecycle = {
    install: async (context: ModuleContext): Promise<void> => {
      context.logger.info('NotificationsModule installing...');
    },

    enable: async (context: ModuleContext): Promise<void> => {
      context.logger.info('NotificationsModule enabling...');

      // Initialize database
      const { getPrisma } = await import('@/lib/db');
      const prisma = getPrisma();

      // Repository
      const { NotificationRepository } = await import('./notification.repository');
      const notificationRepo = new NotificationRepository(prisma);
      context.container.register('NotificationRepository', () => notificationRepo);

      // Rule Engine
      const { NotificationRuleEngine } = await import('./rule-engine');
      const ruleEngine = new NotificationRuleEngine(notificationRepo, context.eventBus, context.logger);
      context.container.register('NotificationRuleEngine', () => ruleEngine);

      // Register default rules
      ruleEngine.addRule({ event: 'task.*', action: 'notify' });
      ruleEngine.addRule({ event: 'agent.operation', action: 'log' });
      ruleEngine.addRule({ event: 'integration.synced', action: 'log' });

      // Load persisted rules from database
      await ruleEngine.loadRulesFromDb();

      // Register built-in channels
      const { WebhookChannel } = await import('./channels/webhook-channel');
      const { BrowserPushChannel } = await import('./channels/browser-push-channel');
      const { TelegramNotificationChannel } = await import('./channels/telegram-channel');
      const { WeChatNotificationChannel } = await import('./channels/wechat-channel');

      const browserPush = new BrowserPushChannel(context.logger);
      ruleEngine.registerChannel(browserPush);

      // Register Telegram channel if token is configured
      if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_NOTIFY_CHAT_ID) {
        const telegram = new TelegramNotificationChannel(context.logger);
        ruleEngine.registerChannel(telegram);
      }

      // Register WeChat channel if webhook URL is configured
      if (process.env.WECHAT_BOT_WEBHOOK_URL) {
        const wechat = new WeChatNotificationChannel(context.logger);
        ruleEngine.registerChannel(wechat);
      }

      // Register webhook channel if URL is configured
      const webhookUrl = process.env.NOTIFICATION_WEBHOOK_URL;
      if (webhookUrl) {
        const webhook = new WebhookChannel(webhookUrl, process.env.NOTIFICATION_WEBHOOK_SECRET, context.logger);
        ruleEngine.registerChannel(webhook);
      }

      // Register email channel if SMTP is configured
      if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.NOTIFY_EMAIL_FROM && process.env.NOTIFY_EMAIL_TO) {
        const { EmailNotificationChannel } = await import('./channels/email-channel');
        const email = new EmailNotificationChannel(context.logger);
        ruleEngine.registerChannel(email);
      }

      // Start listening to events
      ruleEngine.start();

      context.logger.info('NotificationsModule enabled with rule engine started');
    },

    disable: async (): Promise<void> => {
      console.log('[NotificationsModule] Disabled');
    },

    uninstall: async (): Promise<void> => {
      console.log('[NotificationsModule] Uninstalled');
    },
  };
}
