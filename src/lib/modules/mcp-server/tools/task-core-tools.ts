// ============================================================
// MCP Tool Definitions for Task Core Module
// ============================================================

import type { McpToolConfig } from '@/lib/core/types';

export const taskCoreMcpTools: McpToolConfig[] = [
  {
    name: 'create_task',
    description: '创建一个新任务。支持设置标题、描述、优先级、类型、截止日期、标签等。',
    handler: 'create_task',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '任务标题（必填）' },
        description: { type: 'string', description: '任务描述' },
        priority: { type: 'string', enum: ['urgent', 'high', 'medium', 'low'], description: '优先级' },
        type: { type: 'string', description: '任务类型（feature/bug/improvement/docs/general）' },
        source: { type: 'string', description: '任务来源' },
        sourceRef: { type: 'string', description: '来源引用' },
        creator: { type: 'string', description: '创建者标识' },
        assignee: { type: 'string', description: '负责人' },
        parentTaskId: { type: 'string', description: '父任务 ID（用于子任务）' },
        dueDate: { type: 'string', description: '截止日期（ISO 格式）' },
        tags: { type: 'array', items: { type: 'string' }, description: '标签列表' },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_task',
    description: '更新已有任务的信息。可以更新标题、描述、状态、优先级、进度等。',
    handler: 'update_task',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '任务 ID（必填）' },
        title: { type: 'string', description: '新标题' },
        description: { type: 'string', description: '新描述' },
        status: { type: 'string', enum: ['todo', 'in_progress', 'done', 'closed'], description: '新状态' },
        priority: { type: 'string', enum: ['urgent', 'high', 'medium', 'low'], description: '新优先级' },
        progress: { type: 'number', description: '进度百分比（0-100）' },
        type: { type: 'string', description: '任务类型' },
        assignee: { type: 'string', description: '负责人' },
        dueDate: { type: 'string', description: '截止日期（ISO 格式）' },
        tags: { type: 'array', items: { type: 'string' }, description: '标签列表' },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_task',
    description: '获取单个任务的详细信息，包含标签、依赖关系、子任务等。',
    handler: 'get_task',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '任务 ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_tasks',
    description: '列出任务，支持按状态、优先级、类型筛选，支持搜索和分页。',
    handler: 'list_tasks',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'array', items: { type: 'string' }, description: '按状态筛选' },
        priority: { type: 'array', items: { type: 'string' }, description: '按优先级筛选' },
        type: { type: 'string', description: '按类型筛选' },
        creator: { type: 'string', description: '按创建者筛选' },
        search: { type: 'string', description: '搜索关键词' },
        page: { type: 'number', description: '页码（从 1 开始）' },
        pageSize: { type: 'number', description: '每页数量（最大 100）' },
        sortBy: { type: 'string', enum: ['createdAt', 'updatedAt', 'priority', 'dueDate', 'progress'], description: '排序字段' },
        sortOrder: { type: 'string', enum: ['asc', 'desc'], description: '排序方向' },
      },
    },
  },
  {
    name: 'delete_task',
    description: '删除任务（软删除，不会真正删除数据）。',
    handler: 'delete_task',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '任务 ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'update_task_status',
    description: '更新任务状态，支持状态流转验证（todo→in_progress→done→closed）。',
    handler: 'update_task_status',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '任务 ID' },
        status: { type: 'string', enum: ['todo', 'in_progress', 'done', 'closed'], description: '目标状态' },
      },
      required: ['id', 'status'],
    },
  },
  {
    name: 'get_task_history',
    description: '获取任务的变更历史记录。',
    handler: 'get_task_history',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: '任务 ID' },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'get_sub_tasks',
    description: '获取指定任务的子任务列表。',
    handler: 'get_sub_tasks',
    inputSchema: {
      type: 'object',
      properties: {
        parentTaskId: { type: 'string', description: '父任务 ID' },
      },
      required: ['parentTaskId'],
    },
  },
  {
    name: 'get_status_counts',
    description: '获取所有任务的状态统计（各状态的任务数量）。',
    handler: 'get_status_counts',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];
