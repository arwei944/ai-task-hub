// ============================================================
// AI Task Hub - Notification Preference Service (v3)
// ============================================================

import { getPrisma } from '@/lib/db';
import type { ILogger } from '@/lib/core/types';

export interface UserNotificationPreference {
  id: string;
  userId: string;
  /** Comma-separated event patterns to subscribe (e.g., "task.*,deployment.*") */
  eventPatterns: string;
  /** Comma-separated channels (e.g., "system,browser-push,telegram") */
  channels: string;
  /** Minimum notification level to receive */
  minLevel: 'info' | 'warning' | 'error' | 'success';
  /** Enable digest mode (aggregate notifications) */
  digestEnabled: boolean;
  /** Digest interval in minutes (default: 60) */
  digestInterval: number;
  /** Enable quiet hours */
  quietHoursEnabled: boolean;
  /** Quiet hours start (HH:MM, e.g., "22:00") */
  quietHoursStart: string;
  /** Quiet hours end (HH:MM, e.g., "08:00") */
  quietHoursEnd: string;
  /** Whether to receive notifications for own actions */
  includeOwnActions: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class NotificationPreferenceService {
  constructor(
    private logger: ILogger,
    private prismaFn: () => ReturnType<typeof getPrisma> = getPrisma,
  ) {}

  async getPreference(userId: string): Promise<UserNotificationPreference | null> {
    const prisma = this.prismaFn();
    try {
      const pref = await prisma.notificationPreference.findUnique({
        where: { userId },
      });
      if (!pref) return null;
      return this.mapPref(pref);
    } finally {
      await prisma.$disconnect();
    }
  }

  async upsertPreference(userId: string, updates: {
    eventPatterns?: string;
    channels?: string;
    minLevel?: string;
    digestEnabled?: boolean;
    digestInterval?: number;
    quietHoursEnabled?: boolean;
    quietHoursStart?: string;
    quietHoursEnd?: string;
    includeOwnActions?: boolean;
  }): Promise<UserNotificationPreference> {
    const prisma = this.prismaFn();
    try {
      const pref = await prisma.notificationPreference.upsert({
        where: { userId },
        create: {
          userId,
          eventPatterns: updates.eventPatterns ?? '*',
          channels: updates.channels ?? 'system',
          minLevel: updates.minLevel ?? 'info',
          digestEnabled: updates.digestEnabled ?? false,
          digestInterval: updates.digestInterval ?? 60,
          quietHoursEnabled: updates.quietHoursEnabled ?? false,
          quietHoursStart: updates.quietHoursStart ?? '22:00',
          quietHoursEnd: updates.quietHoursEnd ?? '08:00',
          includeOwnActions: updates.includeOwnActions ?? true,
        },
        update: {
          ...(updates.eventPatterns !== undefined && { eventPatterns: updates.eventPatterns }),
          ...(updates.channels !== undefined && { channels: updates.channels }),
          ...(updates.minLevel !== undefined && { minLevel: updates.minLevel }),
          ...(updates.digestEnabled !== undefined && { digestEnabled: updates.digestEnabled }),
          ...(updates.digestInterval !== undefined && { digestInterval: updates.digestInterval }),
          ...(updates.quietHoursEnabled !== undefined && { quietHoursEnabled: updates.quietHoursEnabled }),
          ...(updates.quietHoursStart !== undefined && { quietHoursStart: updates.quietHoursStart }),
          ...(updates.quietHoursEnd !== undefined && { quietHoursEnd: updates.quietHoursEnd }),
          ...(updates.includeOwnActions !== undefined && { includeOwnActions: updates.includeOwnActions }),
        },
      });

      return this.mapPref(pref);
    } finally {
      await prisma.$disconnect();
    }
  }

  /**
   * Check if a notification should be delivered to a user based on preferences
   */
  shouldDeliver(pref: UserNotificationPreference, params: {
    eventType: string;
    level: string;
    actorId?: string;
    userId: string;
  }): { deliver: boolean; reason: string } {
    // Check quiet hours
    if (pref.quietHoursEnabled) {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const [startH, startM] = pref.quietHoursStart.split(':').map(Number);
      const [endH, endM] = pref.quietHoursEnd.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      if (startMinutes > endMinutes) {
        // Crosses midnight (e.g., 22:00 - 08:00)
        if (currentMinutes >= startMinutes || currentMinutes < endMinutes) {
          return { deliver: false, reason: 'quiet_hours' };
        }
      } else {
        if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
          return { deliver: false, reason: 'quiet_hours' };
        }
      }
    }

    // Check own actions
    if (!pref.includeOwnActions && params.actorId && params.actorId === params.userId) {
      return { deliver: false, reason: 'own_action' };
    }

    // Check event pattern
    const patterns = pref.eventPatterns.split(',').map(p => p.trim());
    const matches = patterns.some(p => {
      if (p === '*') return true;
      if (p === params.eventType) return true;
      if (p.endsWith('.*')) return params.eventType.startsWith(p.slice(0, -2));
      return false;
    });
    if (!matches) {
      return { deliver: false, reason: 'event_pattern_mismatch' };
    }

    // Check minimum level
    const levelPriority: Record<string, number> = { info: 0, success: 1, warning: 2, error: 3 };
    const prefPriority = levelPriority[pref.minLevel] ?? 0;
    const eventPriority = levelPriority[params.level] ?? 0;
    if (eventPriority < prefPriority) {
      return { deliver: false, reason: 'below_min_level' };
    }

    return { deliver: true, reason: 'ok' };
  }

  private mapPref(pref: any): UserNotificationPreference {
    return {
      id: pref.id,
      userId: pref.userId,
      eventPatterns: pref.eventPatterns,
      channels: pref.channels,
      minLevel: pref.minLevel,
      digestEnabled: pref.digestEnabled,
      digestInterval: pref.digestInterval,
      quietHoursEnabled: pref.quietHoursEnabled,
      quietHoursStart: pref.quietHoursStart,
      quietHoursEnd: pref.quietHoursEnd,
      includeOwnActions: pref.includeOwnActions,
      createdAt: pref.createdAt,
      updatedAt: pref.updatedAt,
    };
  }
}
