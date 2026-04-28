// ============================================================
// Notification Types & Interfaces
// ============================================================

export interface Notification {
  id?: string;
  type: string;
  title: string;
  message: string;
  level: 'info' | 'warning' | 'error' | 'success';
  channel: string;
  isRead?: boolean;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
}

export interface NotificationRule {
  /** Event pattern to match (e.g., "task.*", "task.status_changed") */
  event: string;
  /** Action to take: "notify", "log", "webhook" */
  action: 'notify' | 'log' | 'webhook';
  /** Notification level */
  level?: 'info' | 'warning' | 'error' | 'success';
  /** Custom title template (supports {event}, {payload.field} placeholders) */
  titleTemplate?: string;
  /** Custom message template */
  messageTemplate?: string;
}

export interface INotificationChannel {
  readonly id: string;
  readonly name: string;
  send(notification: Notification): Promise<void>;
}

export interface NotificationData {
  id: string;
  type: string;
  title: string;
  message: string;
  level: string;
  channel: string;
  isRead: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}
