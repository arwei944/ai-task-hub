import type { McpToolConfig } from '@/lib/core/types';

/**
 * MCP tools for outbound webhook retry management
 */
export const webhookRetryMcpTools: McpToolConfig[] = [
  {
    name: 'webhook_retry_delivery',
    description: '手动重试失败的 Webhook 投递',
    inputSchema: {
      type: 'object',
      properties: {
        deliveryId: { type: 'string', description: '投递记录 ID' },
      },
      required: ['deliveryId'],
    },
  },
  {
    name: 'webhook_get_retry_queue',
    description: '获取 Webhook 重试队列状态和待处理项',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'webhook_clear_retry_queue',
    description: '清除所有待重试的 Webhook 投递',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];
