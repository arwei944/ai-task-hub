import type { INotificationChannel, Notification } from '../types';
import type { ILogger } from '@/lib/core/types';

/**
 * Email notification channel
 * Sends notifications via SMTP using nodemailer (optional dependency).
 * Gracefully degrades if nodemailer is not installed.
 */
export class EmailNotificationChannel implements INotificationChannel {
  readonly id = 'email';
  readonly name = 'Email 通知';

  constructor(private logger?: ILogger) {}

  /**
   * Send a notification via email.
   * Uses nodemailer with SMTP configuration from environment variables.
   * Falls back to logging if nodemailer is not installed.
   */
  async send(notification: Notification): Promise<void> {
    const config = this.getSmtpConfig();
    if (!config) {
      this.logger?.warn('EmailNotificationChannel: SMTP not configured, skipping email send');
      return;
    }

    try {
      // Dynamic import nodemailer
      let nodemailer: any;
      try {
        // @ts-ignore -- optional dependency, fallback handled below
        nodemailer = await import('nodemailer');
      } catch {
        this.logger?.warn(
          'EmailNotificationChannel: nodemailer not installed. Install with: pnpm add nodemailer',
        );
        return;
      }

      const transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.user,
          pass: config.pass,
        },
      });

      const levelEmoji: Record<string, string> = {
        info: '\u2139\ufe0f',
        warning: '\u26a0\ufe0f',
        error: '\ud83d\udea8',
        success: '\u2705',
      };

      const subject = `[AI Task Hub] ${levelEmoji[notification.level] ?? '\ud83d\udce2'} ${notification.title}`;
      const html = this.buildHtmlEmail(notification);

      const recipients = config.to.split(',').map((r: string) => r.trim()).filter(Boolean);

      await transporter.sendMail({
        from: config.from,
        to: recipients.join(', '),
        subject,
        html,
      });

      this.logger?.info(
        `EmailNotificationChannel: email sent to ${recipients.length} recipient(s)`,
      );
    } catch (error: any) {
      this.logger?.error(`EmailNotificationChannel: failed to send email: ${error.message}`);
    }
  }

  /**
   * Read SMTP configuration from environment variables.
   */
  private getSmtpConfig(): {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    from: string;
    to: string;
  } | null {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.NOTIFY_EMAIL_FROM;
    const to = process.env.NOTIFY_EMAIL_TO;

    if (!host || !user || !pass || !from || !to) {
      const missing: string[] = [];
      if (!host) missing.push('SMTP_HOST');
      if (!user) missing.push('SMTP_USER');
      if (!pass) missing.push('SMTP_PASS');
      if (!from) missing.push('NOTIFY_EMAIL_FROM');
      if (!to) missing.push('NOTIFY_EMAIL_TO');
      this.logger?.warn(
        `EmailNotificationChannel: missing configuration: ${missing.join(', ')}`,
      );
      return null;
    }

    return {
      host,
      port: parseInt(process.env.SMTP_PORT ?? '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      user,
      pass,
      from,
      to,
    };
  }

  /**
   * Build a styled HTML email body.
   */
  private buildHtmlEmail(notification: Notification): string {
    const levelColors: Record<string, string> = {
      info: '#3b82f6',
      warning: '#f59e0b',
      error: '#ef4444',
      success: '#22c55e',
    };

    const levelLabels: Record<string, string> = {
      info: 'INFO',
      warning: 'WARNING',
      error: 'ERROR',
      success: 'SUCCESS',
    };

    const color = levelColors[notification.level] ?? '#6b7280';
    const label = levelLabels[notification.level] ?? notification.level.toUpperCase();
    const timestamp = new Date(notification.createdAt ?? Date.now()).toLocaleString();

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #1f2937; padding: 20px 24px;">
              <h1 style="margin: 0; color: #ffffff; font-size: 18px; font-weight: 600;">AI Task Hub</h1>
            </td>
          </tr>
          <!-- Level Badge -->
          <tr>
            <td style="padding: 16px 24px 0;">
              <span style="display: inline-block; background-color: ${color}; color: #ffffff; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; letter-spacing: 0.5px;">${label}</span>
            </td>
          </tr>
          <!-- Title -->
          <tr>
            <td style="padding: 12px 24px 0;">
              <h2 style="margin: 0; color: #111827; font-size: 20px; font-weight: 600;">${this.escapeHtml(notification.title)}</h2>
            </td>
          </tr>
          <!-- Message -->
          <tr>
            <td style="padding: 12px 24px 0;">
              <p style="margin: 0; color: #4b5563; font-size: 14px; line-height: 1.6;">${this.escapeHtml(notification.message)}</p>
            </td>
          </tr>
          <!-- Metadata -->
          <tr>
            <td style="padding: 16px 24px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border-top: 1px solid #e5e7eb; padding-top: 12px;">
                <tr>
                  <td style="color: #9ca3af; font-size: 12px;">
                    Type: ${this.escapeHtml(notification.type)}
                  </td>
                  <td style="color: #9ca3af; font-size: 12px; text-align: right;">
                    Channel: ${this.escapeHtml(notification.channel)}
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="color: #9ca3af; font-size: 12px; padding-top: 4px;">
                    ${timestamp}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 24px; border-top: 1px solid #e5e7eb; margin-top: 16px;">
              <p style="margin: 0; color: #9ca3af; font-size: 11px; text-align: center;">
                This notification was sent by AI Task Hub
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  /**
   * Escape HTML special characters to prevent XSS.
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
