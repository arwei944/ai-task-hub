import type { ILogger } from '@/lib/core/types';

/**
 * Create tool handlers for email notification tools.
 */
export function createEmailNotificationToolHandlers(logger: ILogger) {
  return {
    email_send_test: async (args: Record<string, unknown>) => {
      const customTo = args.to as string | undefined;
      const customSubject = args.subject as string | undefined;

      try {
        const { EmailNotificationChannel } = await import(
          '@/lib/modules/notifications/channels/email-channel'
        );
        const channel = new EmailNotificationChannel(logger);

        const testNotification = {
          type: 'email.test',
          title: customSubject ?? 'AI Task Hub 邮件测试',
          message:
            '这是一封测试邮件，用于验证 SMTP 配置是否正确。如果您收到此邮件，说明邮件通知渠道已成功配置。',
          level: 'info' as const,
          channel: 'email',
          createdAt: new Date(),
        };

        // If custom recipient is provided, temporarily set NOTIFY_EMAIL_TO
        if (customTo) {
          const originalTo = process.env.NOTIFY_EMAIL_TO;
          process.env.NOTIFY_EMAIL_TO = customTo;
          try {
            await channel.send(testNotification);
          } finally {
            if (originalTo !== undefined) {
              process.env.NOTIFY_EMAIL_TO = originalTo;
            } else {
              delete process.env.NOTIFY_EMAIL_TO;
            }
          }
        } else {
          await channel.send(testNotification);
        }

        return {
          success: true,
          message: customTo
            ? `测试邮件已发送至 ${customTo}`
            : '测试邮件已发送',
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },

    email_get_config: async () => {
      const configItems = [
        { key: 'SMTP_HOST', value: process.env.SMTP_HOST, required: true },
        { key: 'SMTP_PORT', value: process.env.SMTP_PORT ?? '587', required: false },
        { key: 'SMTP_SECURE', value: process.env.SMTP_SECURE ?? 'false', required: false },
        { key: 'SMTP_USER', value: process.env.SMTP_USER, required: true },
        { key: 'SMTP_PASS', value: process.env.SMTP_PASS ? '***configured***' : null, required: true },
        { key: 'NOTIFY_EMAIL_FROM', value: process.env.NOTIFY_EMAIL_FROM, required: true },
        { key: 'NOTIFY_EMAIL_TO', value: process.env.NOTIFY_EMAIL_TO, required: true },
      ];

      const configured = configItems.filter(c => c.value && c.value !== 'null');
      const missing = configItems.filter(c => c.required && (!c.value || c.value === 'null'));

      // Check if nodemailer is available
      let nodemailerAvailable = false;
      try {
        // @ts-ignore -- optional dependency, fallback handled below
        await import('nodemailer');
        nodemailerAvailable = true;
      } catch {
        // not available
      }

      return {
        success: true,
        configured: missing.length === 0 && nodemailerAvailable,
        configItems,
        configuredCount: configured.length,
        missingCount: missing.length,
        missingKeys: missing.map(c => c.key),
        nodemailerAvailable,
        summary: missing.length === 0
          ? nodemailerAvailable
            ? 'Email notification channel is fully configured and ready'
            : 'Email configuration is set but nodemailer is not installed. Run: pnpm add nodemailer'
          : `Missing required configuration: ${missing.map(c => c.key).join(', ')}`,
      };
    },
  };
}
