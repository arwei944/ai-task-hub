import type { McpToolConfig } from '@/lib/core/types';

/**
 * MCP tools for GitHub Issue trigger management
 */
export const githubTriggerMcpTools: McpToolConfig[] = [
  {
    name: 'github_trigger_workflow',
    description: '使用 GitHub Issue 数据手动触发工作流',
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: { type: 'string', description: '目标工作流 ID' },
        action: { type: 'string', description: 'GitHub Issue 动作 (如 opened, closed, reopened, labeled)' },
        issueTitle: { type: 'string', description: 'Issue 标题' },
        issueBody: { type: 'string', description: 'Issue 内容' },
        issueNumber: { type: 'number', description: 'Issue 编号' },
        issueState: { type: 'string', enum: ['open', 'closed'], description: 'Issue 状态' },
        issueLabels: { type: 'array', items: { type: 'string' }, description: 'Issue 标签列表' },
        repository: { type: 'string', description: '仓库名称 (如 owner/repo)' },
        issueUrl: { type: 'string', description: 'Issue URL' },
        author: { type: 'string', description: 'Issue 作者' },
      },
      required: ['workflowId'],
    },
  },
  {
    name: 'github_get_trigger_stats',
    description: '获取 GitHub Issue 触发器统计信息',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];
