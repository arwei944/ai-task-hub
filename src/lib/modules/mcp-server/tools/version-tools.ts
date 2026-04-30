// ============================================================
// Version Management MCP Tools
// ============================================================

import type { McpToolConfig } from '@/lib/core/types';

export interface VersionMcpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export const versionMcpTools: VersionMcpTool[] = [
  {
    name: 'create_release',
    description: '创建新版本发布。当项目达到一个里程碑或需要发布新版本时调用。',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 ID' },
        version: { type: 'string', description: '版本号，如 "1.0.0"（可选，不填则自动生成）' },
        title: { type: 'string', description: '发布标题' },
        description: { type: 'string', description: '发布描述' },
        channel: { type: 'string', enum: ['stable', 'beta', 'canary', 'hotfix'], description: '发布渠道' },
        type: { type: 'string', enum: ['major', 'minor', 'patch', 'prerelease', 'hotfix'], description: '版本类型' },
        releaseNotes: { type: 'string', description: 'Markdown 格式的发布说明' },
        changelogs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              category: { type: 'string' },
              title: { type: 'string' },
              description: { type: 'string' },
            },
            required: ['category', 'title'],
          },
          description: '变更日志条目',
        },
        tags: { type: 'array', items: { type: 'string' }, description: '标签列表' },
        agentId: { type: 'string', description: '操作 Agent ID' },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'get_release',
    description: '获取版本发布详情，包含变更日志、标签、审批记录和里程碑。',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '发布 ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_releases',
    description: '列出项目的所有版本发布，支持按状态、渠道、类型筛选。',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 ID' },
        status: { type: 'string', enum: ['draft', 'review', 'approved', 'published', 'archived', 'rolled_back'] },
        channel: { type: 'string', enum: ['stable', 'beta', 'canary', 'hotfix'] },
        type: { type: 'string', enum: ['major', 'minor', 'patch', 'prerelease', 'hotfix'] },
        limit: { type: 'number', description: '返回数量限制' },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'update_release',
    description: '更新版本发布信息（标题、描述、状态、发布说明等）。',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '发布 ID' },
        title: { type: 'string' },
        description: { type: 'string' },
        status: { type: 'string', enum: ['draft', 'review', 'approved', 'published', 'archived', 'rolled_back'] },
        releaseNotes: { type: 'string' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_release',
    description: '删除草稿状态的版本发布。',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '发布 ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'publish_release',
    description: '发布版本。将已审批的版本发布到指定渠道。',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '发布 ID' },
        agentId: { type: 'string', description: '操作 Agent ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'add_changelog',
    description: '向版本发布添加变更日志条目。',
    inputSchema: {
      type: 'object',
      properties: {
        releaseId: { type: 'string', description: '发布 ID' },
        category: {
          type: 'string',
          enum: ['added', 'changed', 'fixed', 'deprecated', 'removed', 'security', 'performance', 'docs', 'refactor', 'test', 'chore'],
        },
        title: { type: 'string', description: '变更标题' },
        description: { type: 'string', description: '变更描述' },
        impact: { type: 'string', enum: ['major', 'minor', 'patch'] },
      },
      required: ['releaseId', 'category', 'title'],
    },
  },
  {
    name: 'compare_versions',
    description: '对比两个版本之间的差异，返回新增、移除的变更条目。',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 ID' },
        baseVersion: { type: 'string', description: '基准版本号' },
        targetVersion: { type: 'string', description: '目标版本号' },
      },
      required: ['projectId', 'baseVersion', 'targetVersion'],
    },
  },
  {
    name: 'get_next_version',
    description: '根据版本类型自动计算下一个版本号。',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 ID' },
        type: { type: 'string', enum: ['major', 'minor', 'patch'], description: '版本递增类型' },
      },
      required: ['projectId', 'type'],
    },
  },
  {
    name: 'get_release_stats',
    description: '获取项目的版本发布统计数据。',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 ID' },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'submit_for_review',
    description: '将草稿版本提交审批。',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '发布 ID' },
        agentId: { type: 'string', description: '提交人 Agent ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'approve_release',
    description: '审批通过版本发布。',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '发布 ID' },
        decision: { type: 'string', enum: ['approved', 'rejected', 'skipped'] },
        comment: { type: 'string', description: '审批意见' },
        agentId: { type: 'string', description: '审批人 Agent ID' },
      },
      required: ['id', 'decision'],
    },
  },
  {
    name: 'rollback_release',
    description: '回滚已发布的版本。',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '发布 ID' },
        reason: { type: 'string', description: '回滚原因' },
        agentId: { type: 'string', description: '操作 Agent ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'generate_changelog',
    description: '根据项目活动日志自动生成变更日志。',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 ID' },
        fromVersion: { type: 'string', description: '起始版本号（可选）' },
        toVersion: { type: 'string', description: '目标版本号（可选）' },
      },
      required: ['projectId'],
    },
  },
];
