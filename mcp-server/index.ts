// ============================================================
// Standalone MCP Server Entry Point
// ============================================================
//
// Usage: npx tsx mcp-server/index.ts
//
// This starts the MCP server as a standalone process using stdio transport.
// Trae IDE or other MCP clients can connect by spawning this process.
//

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Logger } from '@/lib/core/logger';
import { EventBus } from '@/lib/core/event-bus';
import { DIContainer } from '@/lib/core/di-container';
import { ConfigAccessor } from '@/lib/core/config';
import { McpToolRegistry } from '@/lib/modules/mcp-server/tool-registry';
import { createTaskCoreToolHandlers, createAIEngineToolHandlers, createProjectToolHandlers } from '@/lib/modules/mcp-server/tools/handlers';
import { taskCoreMcpTools } from '@/lib/modules/mcp-server/tools/task-core-tools';
import { aiEngineMcpTools } from '@/lib/modules/mcp-server/tools/ai-engine-tools';
import { projectMcpTools } from '@/lib/modules/mcp-server/tools/project-tools';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

async function main() {
  const logger = new Logger('mcp-standalone');
  logger.info('Starting MCP Server in standalone mode...');

  // Initialize core services
  const eventBus = new EventBus();
  const container = new DIContainer();
  const config = new ConfigAccessor();

  container.register('EventBus', () => eventBus);
  container.register('Logger', () => logger);

  // Initialize database
  const dbPath = process.env.DATABASE_URL?.replace(/^file:/, '') ?? './prisma/dev.db';
  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  const prisma = new PrismaClient({ adapter });

  // Register task-core services
  const { TaskRepository } = await import('@/lib/modules/task-core/task.repository');
  const { TaskHistoryRepository } = await import('@/lib/modules/task-core/task-history.repository');
  const { TaskDependencyRepository } = await import('@/lib/modules/task-core/task-dependency.repository');
  const { TaskProgressService } = await import('@/lib/modules/task-core/task-progress.service');
  const { TaskService } = await import('@/lib/modules/task-core/task.service');

  const taskRepo = new TaskRepository(prisma);
  const historyRepo = new TaskHistoryRepository(prisma);
  const depRepo = new TaskDependencyRepository(prisma);
  const progressService = new TaskProgressService(taskRepo, logger);
  const taskService = new TaskService(taskRepo, historyRepo, depRepo, progressService, eventBus, logger);

  container.register('TaskRepository', () => taskRepo);
  container.register('TaskService', () => taskService);

  // Register AI engine services (if configured)
  let aiHandlers: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {};
  const aiEnabled = process.env.AI_ENGINE_ENABLED !== 'false';

  if (aiEnabled && process.env.OPENAI_API_KEY) {
    try {
      const { OpenAICompatibleAdapter } = await import('@/lib/modules/ai-engine/ai-model-adapter');
      const { TaskExtractor } = await import('@/lib/modules/ai-engine/extractors/task-extractor');
      const { TaskDecomposer } = await import('@/lib/modules/ai-engine/decomposers/task-decomposer');
      const { StatusInferencer } = await import('@/lib/modules/ai-engine/inferencers/status-inferencer');
      const { TaskAnalyzer } = await import('@/lib/modules/ai-engine/analyzers/task-analyzer');

      const aiModel = new OpenAICompatibleAdapter(
        {
          model: process.env.AI_MODEL ?? 'gpt-4o',
          baseURL: process.env.OPENAI_BASE_URL,
          apiKey: process.env.OPENAI_API_KEY,
        },
        logger,
      );

      const extractor = new TaskExtractor(aiModel, logger);
      const decomposer = new TaskDecomposer(aiModel, logger);
      const inferencer = new StatusInferencer(aiModel, logger);
      const analyzer = new TaskAnalyzer(aiModel, logger);

      container.register('TaskExtractor', () => extractor);
      container.register('TaskDecomposer', () => decomposer);
      container.register('StatusInferencer', () => inferencer);
      container.register('TaskAnalyzer', () => analyzer);

      aiHandlers = createAIEngineToolHandlers(extractor, decomposer, inferencer, analyzer, logger);
      logger.info('AI Engine services initialized');
    } catch (error: any) {
      logger.warn(`AI Engine initialization failed: ${error.message}. AI tools will not be available.`);
    }
  }

  // Create MCP Server
  const mcpServer = new McpServer({
    name: 'AI Task Hub',
    version: '1.0.0',
  });

  // Create Tool Registry and register tools
  const toolRegistry = new McpToolRegistry(logger);
  toolRegistry.setServer(mcpServer);

  // Build handler map
  const handlerMap: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {};
  const taskHandlers = createTaskCoreToolHandlers(taskService, logger);
  const projectHandlers = createProjectToolHandlers(logger);
  Object.assign(handlerMap, taskHandlers);
  Object.assign(handlerMap, aiHandlers);
  Object.assign(handlerMap, projectHandlers);

  // Register task-core tools
  await toolRegistry.registerModuleTools(
    { id: 'task-core', mcpTools: taskCoreMcpTools } as any,
    (_mod, toolName) => handlerMap[toolName],
  );

  // Register AI engine tools (if available)
  if (Object.keys(aiHandlers).length > 0) {
    await toolRegistry.registerModuleTools(
      { id: 'ai-engine', mcpTools: aiEngineMcpTools } as any,
      (_mod, toolName) => handlerMap[toolName],
    );
  }

  // Register project lifecycle tools
  await toolRegistry.registerModuleTools(
    { id: 'project-lifecycle', mcpTools: projectMcpTools } as any,
    (_mod, toolName) => handlerMap[toolName],
  );

  // Register all tools with MCP server
  await toolRegistry.registerWithServer();

  // Start stdio transport
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);

  logger.info(`MCP Server ready. ${toolRegistry.getTools().length} tools available.`);
  logger.info('Tools: ' + toolRegistry.getTools().map(t => t.name).join(', '));
}

main().catch((error) => {
  console.error('MCP Server failed to start:', error);
  process.exit(1);
});
