// ============================================================
// Context Aggregation MCP Tools
// ============================================================
//
// Provides tools that aggregate project state into a single call,
// so AI agents can quickly understand the full picture without
// making multiple individual tool calls.
//

import type { McpToolConfig } from '@/lib/core/types';

export const contextMcpTools: McpToolConfig[] = [
  {
    name: 'get_project_context',
    description: `获取项目全貌上下文。一次性返回项目的完整状态，包括：
- 基本信息（名称、描述、当前阶段、创建时间）
- 任务统计（按状态分组：todo/in_progress/done/blocked）
- 需求统计（按状态分组：draft/reviewing/approved/implemented）
- 测试统计（通过率、用例数）
- 最近活动（最近 10 条）
- 当前阶段可用操作
- 风险提示（阻塞任务、过期需求等）

适用于：项目状态汇报、决策支持、进度评估`,
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 ID' },
        includeTasks: { type: 'boolean', description: '是否包含任务详情（默认 false，只返回统计）' },
        includeRequirements: { type: 'boolean', description: '是否包含需求详情（默认 false）' },
        includeRecentActivity: { type: 'boolean', description: '是否包含最近活动（默认 true）' },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'get_task_context',
    description: `获取任务完整上下文。返回任务详情及其关联信息：
- 任务基本信息（标题、描述、状态、优先级）
- 关联需求（如果从需求创建）
- 子任务列表
- 依赖关系（前置和后续任务）
- 执行历史（最近 5 条状态变更）
- 相关测试用例

适用于：任务分析、阻塞排查、进度跟踪`,
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: '任务 ID' },
      },
      required: ['taskId'],
    },
  },
];
