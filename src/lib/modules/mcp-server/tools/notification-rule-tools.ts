import type { McpToolConfig } from '@/lib/core/types';

export const notificationRuleMcpTools: McpToolConfig[] = [
  {
    name: 'create_notification_rule',
    description: '创建持久化的通知规则，指定事件模式、动作、通知级别和目标渠道',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '规则名称' },
        eventPattern: { type: 'string', description: '事件匹配模式 (如 "task.*", "deployment.*", "release.published")' },
        action: { type: 'string', enum: ['notify', 'log', 'webhook'], description: '触发动作' },
        level: { type: 'string', enum: ['info', 'warning', 'error', 'success'], description: '通知级别 (可选，默认自动推断)' },
        titleTemplate: { type: 'string', description: '自定义标题模板 (支持 {event}, {source}, {timestamp})' },
        messageTemplate: { type: 'string', description: '自定义消息模板' },
        channels: { type: 'string', description: '目标渠道 (逗号分隔，如 "system,telegram,webhook"，默认 "system")' },
        priority: { type: 'number', description: '优先级 (数字越大越先评估，默认 0)' },
      },
      required: ['name', 'eventPattern'],
    },
  },
  {
    name: 'list_notification_rules',
    description: '列出所有持久化的通知规则，可按激活状态筛选',
    inputSchema: {
      type: 'object',
      properties: {
        isActive: { type: 'boolean', description: '按激活状态筛选' },
      },
    },
  },
  {
    name: 'update_notification_rule',
    description: '更新通知规则配置（名称、事件模式、动作、渠道等）',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '规则 ID' },
        name: { type: 'string', description: '新名称' },
        eventPattern: { type: 'string', description: '新事件模式' },
        action: { type: 'string', enum: ['notify', 'log', 'webhook'], description: '新动作' },
        level: { type: 'string', enum: ['info', 'warning', 'error', 'success'], description: '新通知级别' },
        titleTemplate: { type: 'string', description: '新标题模板' },
        messageTemplate: { type: 'string', description: '新消息模板' },
        channels: { type: 'string', description: '新目标渠道' },
        isActive: { type: 'boolean', description: '是否激活' },
        priority: { type: 'number', description: '新优先级' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_notification_rule',
    description: '删除通知规则',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '规则 ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'reload_notification_rules',
    description: '从数据库重新加载所有激活的通知规则到内存',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_notification_channels',
    description: '获取所有已注册的通知渠道列表',
    inputSchema: { type: 'object', properties: {} },
  },
];
