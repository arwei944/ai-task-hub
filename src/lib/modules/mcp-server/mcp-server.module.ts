// ============================================================
// MCP Server Module Definition
// ============================================================

import type { Module, ModuleContext } from '@/lib/core/types';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { McpToolRegistry } from './tool-registry';
import { createTaskCoreToolHandlers, createAIEngineToolHandlers } from './tools/handlers';
import { taskCoreMcpTools } from './tools/task-core-tools';
import { aiEngineMcpTools } from './tools/ai-engine-tools';

export default class McpServerModule implements Module {
  id = 'mcp-server';
  name = 'MCP 服务';
  version = '1.0.0';
  description = 'MCP 协议服务端，支持 Trae 和外部智能体通过 MCP 操作任务';
  dependencies = ['task-core'];

  // Declare MCP tools that this module provides
  // (In practice, tools come from task-core and ai-engine modules,
  //  but we declare them here for the module system to discover)
  mcpTools = [...taskCoreMcpTools, ...aiEngineMcpTools];

  private mcpServer: McpServer | null = null;
  private toolRegistry: McpToolRegistry | null = null;

  /**
   * Get the MCP server instance (for external access, e.g., API routes)
   */
  getMcpServer(): McpServer | null {
    return this.mcpServer;
  }

  /**
   * Get the tool registry (for external access)
   */
  getToolRegistry(): McpToolRegistry | null {
    return this.toolRegistry;
  }

  lifecycle = {
    install: async (context: ModuleContext): Promise<void> => {
      context.logger.info('McpServerModule installing...');
    },

    enable: async (context: ModuleContext): Promise<void> => {
      context.logger.info('McpServerModule enabling...');

      const mode = context.config.getModuleConfig<string>('mcp-server', 'mode', 'embedded');
      const transport = context.config.getModuleConfig<string>('mcp-server', 'transport', 'stdio');

      // Create MCP Server
      this.mcpServer = new McpServer({
        name: 'AI Task Hub',
        version: '1.0.0',
      });

      // Create Tool Registry
      this.toolRegistry = new McpToolRegistry(context.logger);
      this.toolRegistry.setServer(this.mcpServer);

      // Register tool handlers
      const handlerMap: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {};

      // Task-core handlers
      if (context.container.has('TaskService')) {
        const taskService = context.container.resolve<any>('TaskService');
        const taskHandlers = createTaskCoreToolHandlers(taskService, context.logger);
        Object.assign(handlerMap, taskHandlers);
      }

      // AI Engine handlers
      if (context.container.has('TaskExtractor')) {
        const extractor = context.container.resolve<any>('TaskExtractor');
        const decomposer = context.container.resolve<any>('TaskDecomposer');
        const inferencer = context.container.resolve<any>('StatusInferencer');
        const analyzer = context.container.resolve<any>('TaskAnalyzer');
        const aiHandlers = createAIEngineToolHandlers(
          extractor, decomposer, inferencer, analyzer, context.logger,
        );
        Object.assign(handlerMap, aiHandlers);
      }

      // Register all tools from module declarations
      await this.toolRegistry.registerModuleTools(
        { id: 'task-core', mcpTools: taskCoreMcpTools } as any,
        (_mod, toolName) => handlerMap[toolName],
      );

      if (context.container.has('TaskExtractor')) {
        await this.toolRegistry.registerModuleTools(
          { id: 'ai-engine', mcpTools: aiEngineMcpTools } as any,
          (_mod, toolName) => handlerMap[toolName],
        );
      }

      // Register tools with MCP server
      await this.toolRegistry.registerWithServer();

      // Register in DI container for external access
      context.container.register('McpServer', () => this.mcpServer!);
      context.container.register('McpToolRegistry', () => this.toolRegistry!);

      // Start transport in standalone mode
      if (mode === 'standalone' && transport === 'stdio') {
        const stdioTransport = new StdioServerTransport();
        await this.mcpServer.connect(stdioTransport);
        context.logger.info('MCP Server started in standalone mode with stdio transport');
      }

      context.logger.info(
        `McpServerModule enabled (${mode} mode, ${this.toolRegistry.getTools().length} tools registered)`,
      );
    },

    disable: async (): Promise<void> => {
      if (this.toolRegistry) {
        this.toolRegistry.clear();
      }
      this.mcpServer = null;
      this.toolRegistry = null;
      console.log('[McpServerModule] Disabled');
    },

    uninstall: async (): Promise<void> => {
      console.log('[McpServerModule] Uninstalled');
    },
  };
}
