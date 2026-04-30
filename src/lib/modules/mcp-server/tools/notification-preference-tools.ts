import type { McpToolConfig } from '@/lib/core/types';

export const notificationPreferenceMcpTools: McpToolConfig[] = [
  {
    name: 'get_notification_preference',
    description: '获取用户的通知偏好设置（事件订阅、渠道、静默时段等）',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: '用户 ID' },
      },
      required: ['userId'],
    },
  },
  {
    name: 'set_notification_preference',
    description: '设置用户的通知偏好（事件模式、渠道、最低级别、摘要模式、静默时段）',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: '用户 ID' },
        eventPatterns: { type: 'string', description: '订阅事件模式 (逗号分隔，如 "task.*,deployment.*")' },
        channels: { type: 'string', description: '通知渠道 (逗号分隔，如 "system,browser-push,telegram")' },
        minLevel: { type: 'string', enum: ['info', 'warning', 'error', 'success'], description: '最低通知级别' },
        digestEnabled: { type: 'boolean', description: '启用摘要模式' },
        digestInterval: { type: 'number', description: '摘要间隔 (分钟，默认 60)' },
        quietHoursEnabled: { type: 'boolean', description: '启用静默时段' },
        quietHoursStart: { type: 'string', description: '静默开始时间 (HH:MM，如 "22:00")' },
        quietHoursEnd: { type: 'string', description: '静默结束时间 (HH:MM，如 "08:00")' },
        includeOwnActions: { type: 'boolean', description: '接收自己操作的通知' },
      },
      required: ['userId'],
    },
  },
  {
    name: 'check_notification_delivery',
    description: '检查通知是否应该发送给指定用户（基于偏好设置）',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: '用户 ID' },
        eventType: { type: 'string', description: '事件类型' },
        level: { type: 'string', description: '通知级别' },
        actorId: { type: 'string', description: '触发者 ID' },
      },
      required: ['userId', 'eventType', 'level'],
    },
  },
];
