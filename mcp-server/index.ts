// ============================================================
// Standalone MCP Server Entry Point
// ============================================================
//
// Usage: npx tsx mcp-server/index.ts
//
// This starts the MCP server as a standalone process using stdio transport.
// Trae IDE or other MCP clients can connect by spawning this process.
//

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Read version from package.json (single source of truth)
function getPackageVersion(): string {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

const APP_VERSION = getPackageVersion();

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Logger } from '@/lib/core/logger';
import { EventBus } from '@/lib/core/event-bus';
import { DIContainer } from '@/lib/core/di-container';
import { ConfigAccessor } from '@/lib/core/config';
import { McpToolRegistry } from '@/lib/modules/mcp-server/tool-registry';
import { createTaskCoreToolHandlers, createAIEngineToolHandlers, createProjectToolHandlers } from '@/lib/modules/mcp-server/tools/handlers';
import { createTestManagementToolHandlers } from '@/lib/modules/mcp-server/tools/test-management-handlers';
import { createRequirementToolHandlers } from '@/lib/modules/mcp-server/tools/requirement-handlers';
import { createKnowledgeToolHandlers } from '@/lib/modules/mcp-server/tools/knowledge-handlers';
import { createLifecycleToolHandlers } from '@/lib/modules/mcp-server/tools/lifecycle-handlers';
import { createContextToolHandlers } from '@/lib/modules/mcp-server/tools/context-handlers';
import { taskCoreMcpTools } from '@/lib/modules/mcp-server/tools/task-core-tools';
import { testManagementMcpTools } from '@/lib/modules/mcp-server/tools/test-management-tools';
import { requirementMcpTools } from '@/lib/modules/mcp-server/tools/requirement-tools';
import { knowledgeMcpTools } from '@/lib/modules/mcp-server/tools/knowledge-tools';
import { lifecycleMcpTools } from '@/lib/modules/mcp-server/tools/lifecycle-tools';
import { contextMcpTools } from '@/lib/modules/mcp-server/tools/context-tools';
import { promptMcpTools } from '@/lib/modules/mcp-server/tools/prompt-tools';
import { createPromptToolHandlers } from '@/lib/modules/mcp-server/tools/prompt-handlers';
import { deploymentMcpTools } from '@/lib/modules/mcp-server/tools/deployment-tools';
import { createDeploymentToolHandlers } from '@/lib/modules/mcp-server/tools/deployment-handlers';
import { dashboardMcpTools } from '@/lib/modules/mcp-server/tools/dashboard-tools';
import { createDashboardToolHandlers } from '@/lib/modules/mcp-server/tools/dashboard-handlers';
import { aiEngineMcpTools } from '@/lib/modules/mcp-server/tools/ai-engine-tools';
import { projectMcpTools } from '@/lib/modules/mcp-server/tools/project-tools';
import { versionMcpTools } from '@/lib/modules/mcp-server/tools/version-tools';
import { createVersionToolHandlers } from '@/lib/modules/mcp-server/tools/version-handlers';
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
    version: APP_VERSION,
  });

  // Create Tool Registry and register tools
  const toolRegistry = new McpToolRegistry(logger);
  toolRegistry.setServer(mcpServer);

  // Build handler map
  const handlerMap: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {};
  const taskHandlers = createTaskCoreToolHandlers(taskService, logger);
  const projectHandlers = createProjectToolHandlers(logger, eventBus);
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

  // Register version management tools
  const { VersionMgmtService } = await import('@/lib/modules/version-mgmt/version-mgmt.service');
  const versionService = new VersionMgmtService(logger, eventBus);
  const versionHandlers = createVersionToolHandlers(versionService, logger);
  Object.assign(handlerMap, versionHandlers);

  await toolRegistry.registerModuleTools(
    { id: 'version-mgmt', mcpTools: versionMcpTools } as any,
    (_mod, toolName) => handlerMap[toolName],
  );

  // Register test management tools
  const { TestManagementService } = await import('@/lib/modules/test-management/test-management.service');
  const testMgmtService = new TestManagementService(logger, eventBus, () => prisma);
  const testMgmtHandlers = createTestManagementToolHandlers(testMgmtService, logger);
  Object.assign(handlerMap, testMgmtHandlers);

  await toolRegistry.registerModuleTools(
    { id: 'test-management', mcpTools: testManagementMcpTools } as any,
    (_mod, toolName) => handlerMap[toolName],
  );

  // Register requirement tools
  const { RequirementsService } = await import('@/lib/modules/requirements/requirements.service');
  const reqService = new RequirementsService(logger, eventBus, () => prisma);
  const reqHandlers = createRequirementToolHandlers(reqService, logger);
  Object.assign(handlerMap, reqHandlers);

  await toolRegistry.registerModuleTools(
    { id: 'requirement-tools', mcpTools: requirementMcpTools } as any,
    (_mod, toolName) => handlerMap[toolName],
  );

  // Register knowledge tools
  const { KnowledgeService } = await import('@/lib/modules/knowledge/knowledge.service');
  const knowledgeService = new KnowledgeService(logger, eventBus, () => prisma);
  const knowledgeHandlers = createKnowledgeToolHandlers(knowledgeService, logger);
  Object.assign(handlerMap, knowledgeHandlers);

  await toolRegistry.registerModuleTools(
    { id: 'knowledge-tools', mcpTools: knowledgeMcpTools } as any,
    (_mod, toolName) => handlerMap[toolName],
  );

  // Register lifecycle tools
  const { LifecycleService } = await import('@/lib/modules/lifecycle/lifecycle.service');
  const lifecycleService = new LifecycleService(logger, eventBus, () => prisma);
  const lifecycleHandlers = createLifecycleToolHandlers(lifecycleService, logger);
  Object.assign(handlerMap, lifecycleHandlers);

  await toolRegistry.registerModuleTools(
    { id: 'lifecycle-tools', mcpTools: lifecycleMcpTools } as any,
    (_mod, toolName) => handlerMap[toolName],
  );

  // Register context aggregation tools
  const contextHandlers = createContextToolHandlers(logger, eventBus, () => prisma);
  Object.assign(handlerMap, contextHandlers);

  await toolRegistry.registerModuleTools(
    { id: 'context-tools', mcpTools: contextMcpTools } as any,
    (_mod, toolName) => handlerMap[toolName],
  );

  // Register prompt template tools
  const promptHandlers = createPromptToolHandlers(logger);
  Object.assign(handlerMap, promptHandlers);

  await toolRegistry.registerModuleTools(
    { id: 'prompt-tools', mcpTools: promptMcpTools } as any,
    (_mod, toolName) => handlerMap[toolName],
  );

  // Register deployment management tools
  const { DeploymentService } = await import('@/lib/modules/deployment-mgmt/deployment.service');
  const deploymentService = new DeploymentService(logger, eventBus, () => prisma);
  const deploymentHandlers = createDeploymentToolHandlers(deploymentService, logger);
  Object.assign(handlerMap, deploymentHandlers);

  await toolRegistry.registerModuleTools(
    { id: 'deployment-tools', mcpTools: deploymentMcpTools } as any,
    (_mod, toolName) => handlerMap[toolName],
  );

  // Register dashboard statistics tools
  const { StatisticsService } = await import('@/lib/modules/dashboard/statistics.service');
  const statsService = new StatisticsService(prisma, logger, eventBus);
  const dashboardHandlers = createDashboardToolHandlers(statsService, logger);
  Object.assign(handlerMap, dashboardHandlers);

  await toolRegistry.registerModuleTools(
    { id: 'dashboard-tools', mcpTools: dashboardMcpTools } as any,
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
