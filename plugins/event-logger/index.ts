import type { PluginRegistry, PluginContext } from '@/lib/modules/plugins/types';

interface LogEntry {
  timestamp: string;
  eventType: string;
  source: string;
  summary: string;
}

const plugin: PluginRegistry = {
  name: 'event-logger',
  displayName: 'Event Logger',
  description: '记录和查询事件日志，用于调试和审计',
  version: '1.0.0',
  author: 'AI Task Hub',
  capabilities: ['task-tool'],
  isEnabled: true,

  async activate(ctx: PluginContext) {
    const eventLog: LogEntry[] = [];
    const MAX_LOG = 500;

    // Register event listener via emit (the plugin context emit goes to EventBus)
    // We'll use a tool to query the log

    ctx.registerTool({
      name: 'event_log_query',
      description: 'Query recent event log entries',
      inputSchema: {
        type: 'object',
        properties: {
          eventType: { type: 'string', description: 'Filter by event type (e.g., "task.*")' },
          limit: { type: 'number', description: 'Max entries to return (default 20)' },
        },
      },
      handler: async (args) => {
        let entries = [...eventLog];
        if (args.eventType) {
          const pattern = args.eventType as string;
          entries = entries.filter(e => {
            if (pattern === '*') return true;
            if (pattern.endsWith('.*')) return e.eventType.startsWith(pattern.slice(0, -2));
            return e.eventType === pattern;
          });
        }
        const limit = Number(args.limit) || 20;
        return {
          entries: entries.slice(-limit),
          total: entries.length,
          queriedAt: new Date().toISOString(),
        };
      },
    });

    ctx.registerTool({
      name: 'event_log_clear',
      description: 'Clear the event log',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      handler: async () => {
        const count = eventLog.length;
        eventLog.length = 0;
        return { cleared: count, message: `Cleared ${count} log entries` };
      },
    });

    ctx.logger.info('Event Logger plugin activated');
  },
};

export default plugin;
