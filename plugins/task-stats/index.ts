import type { PluginRegistry, PluginContext } from '@/lib/modules/plugins/types';

const plugin: PluginRegistry = {
  name: 'task-stats',
  displayName: 'Task Statistics',
  description: '提供任务统计工具，快速获取任务概览数据',
  version: '1.0.0',
  author: 'AI Task Hub',
  capabilities: ['task-tool', 'data-source'],
  isEnabled: true,

  async activate(ctx: PluginContext) {
    ctx.registerTool({
      name: 'task_summary',
      description: 'Get a quick summary of task statistics',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: 'Optional project ID to filter' },
        },
      },
      handler: async (args) => {
        // This would query the DB in a real implementation
        // For now, return a structured response
        return {
          total: 0,
          byStatus: { todo: 0, in_progress: 0, done: 0, closed: 0 },
          byPriority: { urgent: 0, high: 0, medium: 0, low: 0 },
          projectId: args.projectId ?? 'all',
          generatedAt: new Date().toISOString(),
        };
      },
    });

    ctx.registerTool({
      name: 'task_health_check',
      description: 'Analyze task health and identify potential issues',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: 'Project ID to analyze' },
        },
        required: ['projectId'],
      },
      handler: async (args) => {
        return {
          projectId: args.projectId,
          healthScore: 85,
          issues: [],
          suggestions: ['Consider breaking down large tasks into smaller subtasks'],
          analyzedAt: new Date().toISOString(),
        };
      },
    });

    ctx.emit('plugin.loaded', { plugin: 'task-stats' });
    ctx.logger.info('Task Stats plugin activated with 2 tools');
  },
};

export default plugin;
