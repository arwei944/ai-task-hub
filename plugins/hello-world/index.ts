// ============================================================
// Hello World Plugin - 示例插件
// ============================================================
//
// A minimal plugin that registers a greeting tool.
// Used to demonstrate the plugin system.
//

import type { PluginContext } from '@/lib/modules/plugins/types';

export default {
  name: 'hello-world',
  displayName: 'Hello World',
  description: '示例插件 - 注册一个问候工具',
  version: '1.0.0',
  author: 'AI Task Hub',
  capabilities: ['task-tool'],

  async activate(ctx: PluginContext) {
    ctx.logger.info('Hello World plugin activating...');

    // Register a custom tool
    ctx.registerTool({
      name: 'hello',
      description: '返回一个友好的问候消息',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '被问候的人的名字' },
        },
        required: ['name'],
      },
      handler: async (args) => {
        const name = (args.name as string) || 'World';
        return {
          message: `👋 Hello, ${name}! Welcome to AI Task Hub!`,
          from: 'hello-world plugin',
          timestamp: new Date().toISOString(),
        };
      },
    });

    ctx.logger.info('Hello World plugin activated! Tool "hello" registered.');
  },

  async deactivate() {
    // Cleanup if needed
  },
};
