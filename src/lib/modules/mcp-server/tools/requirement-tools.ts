// ============================================================
// Requirements MCP Tools
// ============================================================

import type { McpToolConfig } from '@/lib/core/types';

export interface RequirementMcpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export const requirementMcpTools: RequirementMcpTool[] = [
  {
    name: 'create_requirement',
    description: '创建新需求。支持功能需求、缺陷、改进和史诗类型。',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 ID' },
        title: { type: 'string', description: '需求标题' },
        description: { type: 'string', description: '需求描述' },
        type: { type: 'string', enum: ['feature', 'bug', 'improvement', 'epic'], description: '需求类型' },
        priority: { type: 'number', description: '优先级 (0-5)' },
        complexity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], description: '复杂度' },
        acceptance: { type: 'string', description: '验收标准' },
        source: { type: 'string', description: '需求来源' },
        parentReqId: { type: 'string', description: '父需求 ID' },
        createdBy: { type: 'string', description: '创建者 ID' },
        tags: { type: 'array', items: { type: 'string' }, description: '标签列表' },
      },
      required: ['projectId', 'title', 'description'],
    },
  },
  {
    name: 'get_requirement',
    description: '获取需求详情，包含标签和子需求数量。',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '需求 ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'update_requirement',
    description: '更新需求信息（标题、描述、类型、优先级、状态等）。',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '需求 ID' },
        title: { type: 'string' },
        description: { type: 'string' },
        type: { type: 'string', enum: ['feature', 'bug', 'improvement', 'epic'] },
        priority: { type: 'number' },
        status: { type: 'string', enum: ['draft', 'reviewing', 'approved', 'implemented', 'verified', 'rejected'] },
        complexity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
        acceptance: { type: 'string' },
        source: { type: 'string' },
        parentReqId: { type: 'string', description: '父需求 ID，设为 null 可解除关联' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_requirement',
    description: '删除需求（软删除，状态设为 rejected）。',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '需求 ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_requirements',
    description: '列出需求，支持按项目、状态、类型、复杂度筛选和搜索。',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 ID' },
        status: { type: 'string', enum: ['draft', 'reviewing', 'approved', 'implemented', 'verified', 'rejected'] },
        type: { type: 'string', enum: ['feature', 'bug', 'improvement', 'epic'] },
        complexity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
        parentReqId: { type: 'string', description: '父需求 ID（不传则返回所有层级）' },
        search: { type: 'string', description: '搜索关键词（匹配标题和描述）' },
        limit: { type: 'number', description: '返回数量限制' },
        offset: { type: 'number', description: '偏移量' },
      },
    },
  },
  {
    name: 'update_requirement_status',
    description: '更新需求状态，触发状态变更事件。',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '需求 ID' },
        status: { type: 'string', enum: ['draft', 'reviewing', 'approved', 'implemented', 'verified', 'rejected'], description: '目标状态' },
      },
      required: ['id', 'status'],
    },
  },
  {
    name: 'add_requirement_tag',
    description: '为需求添加标签。',
    inputSchema: {
      type: 'object',
      properties: {
        requirementId: { type: 'string', description: '需求 ID' },
        tagName: { type: 'string', description: '标签名称' },
      },
      required: ['requirementId', 'tagName'],
    },
  },
  {
    name: 'remove_requirement_tag',
    description: '移除需求的标签。',
    inputSchema: {
      type: 'object',
      properties: {
        requirementId: { type: 'string', description: '需求 ID' },
        tagName: { type: 'string', description: '标签名称' },
      },
      required: ['requirementId', 'tagName'],
    },
  },
  {
    name: 'decompose_requirement',
    description: '将需求分解为多个子需求。',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '父需求 ID' },
        subRequirements: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              type: { type: 'string', enum: ['feature', 'bug', 'improvement', 'epic'] },
              priority: { type: 'number' },
              complexity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
              tags: { type: 'array', items: { type: 'string' } },
            },
            required: ['title', 'description'],
          },
          description: '子需求列表',
        },
      },
      required: ['id', 'subRequirements'],
    },
  },
  {
    name: 'map_requirement_to_task',
    description: '将需求映射为任务，自动创建任务并更新需求状态。',
    inputSchema: {
      type: 'object',
      properties: {
        requirementId: { type: 'string', description: '需求 ID' },
        title: { type: 'string', description: '任务标题（可选，默认使用需求标题）' },
        description: { type: 'string', description: '任务描述（可选，默认使用需求描述）' },
        priority: { type: 'string', enum: ['urgent', 'high', 'medium', 'low'], description: '任务优先级' },
        assignee: { type: 'string', description: '指派人' },
        createdBy: { type: 'string', description: '创建者 ID' },
      },
      required: ['requirementId'],
    },
  },
  {
    name: 'analyze_requirement',
    description: '分析需求，返回复杂度评估、优先级建议和验收标准模板。',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '需求标题' },
        description: { type: 'string', description: '需求描述' },
        type: { type: 'string', enum: ['feature', 'bug', 'improvement', 'epic'], description: '需求类型' },
        complexity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], description: '已知复杂度（可选）' },
        priority: { type: 'number', description: '已知优先级（可选）' },
      },
      required: ['title', 'description', 'type'],
    },
  },
  {
    name: 'get_requirement_stats',
    description: '获取项目的需求统计数据（按状态、类型、复杂度分组）。',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 ID' },
      },
      required: ['projectId'],
    },
  },
];
