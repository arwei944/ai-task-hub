// ============================================================
// Lifecycle MCP Tools
// ============================================================

import type { McpToolConfig } from '@/lib/core/types';

export interface LifecycleMcpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export const lifecycleMcpTools: LifecycleMcpTool[] = [
  {
    name: 'request_phase_transition',
    description: '请求项目阶段转换。当项目满足条件时，可以请求从一个阶段转换到下一个阶段。',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 ID' },
        targetPhase: {
          type: 'string',
          enum: ['requirements', 'planning', 'architecture', 'implementation', 'testing', 'deployment', 'completed'],
          description: '目标阶段',
        },
        reason: { type: 'string', description: '转换原因' },
        triggeredBy: { type: 'string', description: '触发者 ID（Agent ID 或用户 ID）' },
      },
      required: ['projectId', 'targetPhase'],
    },
  },
  {
    name: 'approve_phase_transition',
    description: '批准一个待审批的阶段转换请求。',
    inputSchema: {
      type: 'object',
      properties: {
        transitionId: { type: 'string', description: '转换记录 ID' },
      },
      required: ['transitionId'],
    },
  },
  {
    name: 'reject_phase_transition',
    description: '拒绝一个待审批的阶段转换请求。',
    inputSchema: {
      type: 'object',
      properties: {
        transitionId: { type: 'string', description: '转换记录 ID' },
        reason: { type: 'string', description: '拒绝原因' },
      },
      required: ['transitionId'],
    },
  },
  {
    name: 'get_phase_validation',
    description: '检查项目是否可以转换到指定阶段，返回条件验证结果。',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 ID' },
        targetPhase: {
          type: 'string',
          enum: ['requirements', 'planning', 'architecture', 'implementation', 'testing', 'deployment', 'completed'],
          description: '目标阶段',
        },
      },
      required: ['projectId', 'targetPhase'],
    },
  },
  {
    name: 'get_transition_history',
    description: '获取项目的阶段转换历史记录。',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 ID' },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'get_available_transitions',
    description: '获取项目当前可用的阶段转换列表，包含条件、审批要求和自动操作。',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 ID' },
      },
      required: ['projectId'],
    },
  },
];
