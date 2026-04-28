// ============================================================
// MCP Tool Definitions for AI Engine Module
// ============================================================

import type { McpToolConfig } from '@/lib/core/types';

export const aiEngineMcpTools: McpToolConfig[] = [
  {
    name: 'extract_tasks',
    description: '从文本中智能提取任务。可以分析对话记录、会议纪要、文档等文本，自动识别其中的任务、行动项和待办事项。',
    handler: 'extract_tasks',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '要分析的文本内容（必填）' },
        source: { type: 'string', description: '文本来源标识' },
        creator: { type: 'string', description: '创建者标识' },
      },
      required: ['text'],
    },
  },
  {
    name: 'decompose_task',
    description: '将复杂任务智能拆解为可执行的子任务。AI 会分析任务内容，生成有序的子任务列表，包含依赖关系和工作量估算。',
    handler: 'decompose_task',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '任务标题（必填）' },
        description: { type: 'string', description: '任务详细描述' },
      },
      required: ['title'],
    },
  },
  {
    name: 'infer_task_status',
    description: '根据上下文推断任务应该处于什么状态。例如根据"我已经完成了"推断状态应为 done。',
    handler: 'infer_task_status',
    inputSchema: {
      type: 'object',
      properties: {
        taskTitle: { type: 'string', description: '任务标题' },
        currentStatus: { type: 'string', description: '当前状态' },
        context: { type: 'string', description: '最新上下文信息（必填）' },
      },
      required: ['taskTitle', 'currentStatus', 'context'],
    },
  },
  {
    name: 'generate_report',
    description: '根据任务数据生成智能分析报告，包含完成率、风险识别和改进建议。',
    handler: 'generate_report',
    inputSchema: {
      type: 'object',
      properties: {
        totalTasks: { type: 'number', description: '总任务数' },
        statusCounts: { type: 'object', description: '状态分布（如 {"todo": 5, "done": 3}）' },
        recentTasks: {
          type: 'array',
          description: '最近任务列表',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              status: { type: 'string' },
              priority: { type: 'string' },
              dueDate: { type: 'string' },
              createdAt: { type: 'string' },
            },
          },
        },
      },
      required: ['totalTasks', 'statusCounts', 'recentTasks'],
    },
  },
];
