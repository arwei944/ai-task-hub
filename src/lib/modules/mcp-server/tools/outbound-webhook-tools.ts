import type { McpToolConfig } from '@/lib/core/types';

export const outboundWebhookMcpTools: McpToolConfig[] = [
  {
    name: 'create_outbound_webhook',
    description: '创建出站 Webhook，将事件自动推送到外部系统（CI/CD、Slack 等）',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Webhook 名称' },
        url: { type: 'string', description: '目标 URL' },
        secret: { type: 'string', description: 'HMAC 签名密钥 (可选)' },
        eventPatterns: { type: 'string', description: '订阅的事件模式 (逗号分隔，如 "task.*,deployment.*"，默认 "*")' },
        headers: { type: 'string', description: '自定义请求头 (JSON 格式)' },
      },
      required: ['name', 'url'],
    },
  },
  {
    name: 'list_outbound_webhooks',
    description: '列出所有出站 Webhook',
    inputSchema: {
      type: 'object',
      properties: {
        isActive: { type: 'boolean', description: '按激活状态筛选' },
      },
    },
  },
  {
    name: 'update_outbound_webhook',
    description: '更新出站 Webhook 配置',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Webhook ID' },
        name: { type: 'string', description: '新名称' },
        url: { type: 'string', description: '新 URL' },
        secret: { type: 'string', description: '新签名密钥' },
        eventPatterns: { type: 'string', description: '新事件模式' },
        headers: { type: 'string', description: '新自定义请求头' },
        isActive: { type: 'boolean', description: '是否激活' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_outbound_webhook',
    description: '删除出站 Webhook',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Webhook ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_webhook_deliveries',
    description: '查看 Webhook 投递日志，包含请求/响应、状态码、耗时',
    inputSchema: {
      type: 'object',
      properties: {
        webhookId: { type: 'string', description: '按 Webhook ID 筛选' },
        eventType: { type: 'string', description: '按事件类型筛选' },
        success: { type: 'boolean', description: '按成功/失败筛选' },
        limit: { type: 'number', description: '返回数量 (默认 50)' },
      },
    },
  },
  {
    name: 'dispatch_event_to_webhooks',
    description: '手动触发事件分发到所有匹配的出站 Webhook',
    inputSchema: {
      type: 'object',
      properties: {
        eventType: { type: 'string', description: '事件类型' },
        payload: { type: 'object', description: '事件数据' },
      },
      required: ['eventType', 'payload'],
    },
  },
];
