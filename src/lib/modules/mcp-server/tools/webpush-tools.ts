import type { McpToolConfig } from '@/lib/core/types';

export const webpushMcpTools: McpToolConfig[] = [
  {
    name: 'webpush_subscribe',
    description: '为用户注册 Web Push 推送订阅',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: '用户 ID',
        },
        endpoint: {
          type: 'string',
          description: 'Push subscription endpoint URL',
        },
        keys: {
          type: 'object',
          description: 'Push subscription keys (p256dh, auth)',
          properties: {
            p256dh: { type: 'string' },
            auth: { type: 'string' },
          },
        },
      },
      required: ['userId', 'endpoint'],
    },
  },
  {
    name: 'webpush_unsubscribe',
    description: '移除用户的 Web Push 推送订阅',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: '用户 ID',
        },
      },
      required: ['userId'],
    },
  },
  {
    name: 'webpush_send',
    description: '向指定用户发送 Web Push 推送通知',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: '目标用户 ID',
        },
        title: {
          type: 'string',
          description: '通知标题',
        },
        body: {
          type: 'string',
          description: '通知内容',
        },
        data: {
          type: 'object',
          description: '附加数据 (可选)',
        },
      },
      required: ['userId', 'title', 'body'],
    },
  },
  {
    name: 'webpush_get_vapid_key',
    description: '获取 VAPID 公钥，用于前端推送订阅',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];
