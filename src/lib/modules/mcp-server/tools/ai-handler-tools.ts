import type { McpToolConfig } from '@/lib/core/types';

export const aiHandlerMcpTools: McpToolConfig[] = [
  {
    name: 'ai_list_handlers',
    description: '列出所有已注册的 AI 事件处理器及其监听的事件类型',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'ai_trigger_analysis',
    description: '手动触发指定事件类型的 AI 分析，用于测试或重新分析',
    inputSchema: {
      type: 'object',
      properties: {
        eventType: {
          type: 'string',
          description: '要触发分析的事件类型 (如 "task.created", "requirement.created", "deployment.status.changed", "workflow.completed", "knowledge.entry.updated")',
        },
        payload: {
          type: 'object',
          description: '事件负载 (JSON 对象)',
        },
      },
      required: ['eventType', 'payload'],
    },
  },
  {
    name: 'ai_get_suggestions',
    description: '获取最近的 AI 建议和分析结果',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: '返回结果数量限制 (默认 10)',
        },
        type: {
          type: 'string',
          description: '按建议类型筛选 (如 "phase-recommendation", "complexity")',
        },
      },
    },
  },
  {
    name: 'ai_handler_stats',
    description: '获取 AI 事件处理器的执行统计信息',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];
