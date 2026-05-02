// ============================================================
// AI Task Hub - Event Catalog
// Central registry of all domain event types
// ============================================================

export const EVENT_CATALOG = {
  // Project events
  'project.created': { domain: 'project', description: '项目创建' },
  'project.phase.changed': { domain: 'project', description: '项目阶段变更' },
  'project.archived': { domain: 'project', description: '项目归档' },
  'project.deleted': { domain: 'project', description: '项目删除' },
  'project.health.updated': { domain: 'project', description: '项目健康度更新' },

  // Task events
  'task.created': { domain: 'task', description: '任务创建' },
  'task.status.changed': { domain: 'task', description: '任务状态变更' },
  'task.assigned': { domain: 'task', description: '任务分配' },
  'task.priority.changed': { domain: 'task', description: '优先级变更' },
  'task.completed': { domain: 'task', description: '任务完成' },
  'task.blocked': { domain: 'task', description: '任务阻塞' },
  'task.dependency.added': { domain: 'task', description: '依赖添加' },
  'task.comment.added': { domain: 'task', description: '评论添加' },

  // Workflow events
  'workflow.triggered': { domain: 'workflow', description: '工作流触发' },
  'workflow.step.completed': { domain: 'workflow', description: '步骤完成' },
  'workflow.step.failed': { domain: 'workflow', description: '步骤失败' },
  'workflow.completed': { domain: 'workflow', description: '工作流完成' },
  'workflow.failed': { domain: 'workflow', description: '工作流失败' },
  'workflow.approval.requested': { domain: 'workflow', description: '审批请求' },
  'workflow.approval.decided': { domain: 'workflow', description: '审批决定' },

  // Release events
  'release.created': { domain: 'release', description: '发布创建' },
  'release.status.changed': { domain: 'release', description: '发布状态变更' },
  'release.published': { domain: 'release', description: '发布完成' },
  'release.rolled.back': { domain: 'release', description: '发布回滚' },

  // Requirement events
  'requirement.created': { domain: 'requirement', description: '需求创建' },
  'requirement.status.changed': { domain: 'requirement', description: '需求状态变更' },
  'requirement.mapped.to.task': { domain: 'requirement', description: '需求映射到任务' },

  // Agent events
  'agent.registered': { domain: 'agent', description: 'Agent 注册' },
  'agent.task.claimed': { domain: 'agent', description: 'Agent 认领任务' },
  'agent.task.completed': { domain: 'agent', description: 'Agent 完成任务' },

  // Integration events
  'integration.github.push': { domain: 'integration', description: 'GitHub Push' },
  'integration.github.pr.opened': { domain: 'integration', description: 'GitHub PR 创建' },
  'integration.github.pr.merged': { domain: 'integration', description: 'GitHub PR 合并' },
  'integration.github.issue.created': { domain: 'integration', description: 'GitHub Issue 创建' },

  // System events
  'system.module.loaded': { domain: 'system', description: '模块加载' },
  'system.module.unloaded': { domain: 'system', description: '模块卸载' },
  'system.config.changed': { domain: 'system', description: '配置变更' },
} as const;

export type EventType = keyof typeof EVENT_CATALOG;
export const VALID_EVENT_TYPES = Object.keys(EVENT_CATALOG);
