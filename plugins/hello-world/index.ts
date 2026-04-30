import type { PluginRegistry, PluginContext } from '@/lib/modules/plugins/types';

const plugin: PluginRegistry = {
  name: 'hello-world',
  displayName: 'Hello World',
  description: '示例插件 - 注册一个问候工具',
  version: '1.0.0',
  author: 'AI Task Hub',
  capabilities: ['task-tool'],
  isEnabled: true,

  async activate(ctx: PluginContext) {
    ctx.registerTool({
      name: 'hello',
      description: 'Say hello to someone',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name to greet' },
        },
        required: ['name'],
      },
      handler: async (args) => {
        return { message: `Hello, ${args.name}! Welcome to AI Task Hub! 🎉` };
      },
    });

    ctx.logger.info('Hello World plugin activated');
  },

  async deactivate() {
    // Cleanup
  },
};

export default plugin;
