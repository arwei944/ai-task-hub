// ============================================================
// Agent Prompt Template MCP Tool Definitions
// ============================================================
//
// MCP tool declarations for the prompt template system.
// These tools allow AI agents to retrieve structured guidance
// for common work scenarios.
//

import type { McpToolConfig } from '@/lib/core/types';

export const promptMcpTools: McpToolConfig[] = [
  {
    name: 'get_agent_prompt',
    description: `获取 AI Agent 工作指引模板。返回针对特定场景的结构化操作指南，包括：
- 目标说明
- 推荐的工具调用步骤（按顺序）
- 每步的分析要点
- 最佳实践提示
- 输出格式建议

适用于：AI Agent 需要了解如何高效完成某个工作场景`,
    handler: 'prompt-handlers',
    inputSchema: {
      type: 'object',
      properties: {
        scenario: {
          type: 'string',
          enum: [
            'project_overview',
            'task_analysis',
            'requirement_analysis',
            'risk_assessment',
            'release_checklist',
            'daily_standup',
            'sprint_planning',
            'list_scenarios',
          ],
          description: '工作场景',
        },
        projectId: { type: 'string', description: '项目 ID（用于个性化模板中的占位符替换）' },
      },
      required: ['scenario'],
    },
  },
  {
    name: 'list_available_scenarios',
    description: '列出所有可用的 AI Agent 工作场景模板',
    handler: 'prompt-handlers',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];
