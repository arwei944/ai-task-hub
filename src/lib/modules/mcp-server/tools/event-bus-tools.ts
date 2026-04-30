import type { McpToolConfig } from '@/lib/core/types';

export const eventBusMcpTools: McpToolConfig[] = [
  {
    name: 'get_event_bus_metrics',
    description: '获取事件总线运行指标：总发射数、处理数、失败数、重试数、DLQ 大小、按类型分组统计',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_dead_letter_queue',
    description: '获取死信队列中的所有失败事件，包含错误信息、重试次数、下次重试时间',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'retry_dead_letter_queue',
    description: '重试死信队列中所有到期的失败事件，返回重试/成功/失败计数',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'clear_dead_letter_queue',
    description: '清空死信队列，返回清除的条目数',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'remove_dlq_entry',
    description: '从死信队列中移除指定条目',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'DLQ 条目 ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'clean_expired_events',
    description: '清理过期的事件存储记录（默认 TTL 7 天），返回清理的条目数',
    inputSchema: { type: 'object', properties: {} },
  },
];
