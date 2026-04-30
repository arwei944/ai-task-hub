// ============================================================
// MCP Streamable HTTP Transport API Route
// ============================================================
//
// Provides Streamable HTTP transport for MCP over HTTP.
// Remote clients can connect to this endpoint.
//
// Session management: each session gets its own McpServer instance.
// Tool definitions and handlers are shared (initialized once).
//

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { Logger } from '@/lib/core/logger';
import { EventBus } from '@/lib/core/event-bus';
import { createTaskCoreToolHandlers, createAIEngineToolHandlers } from '@/lib/modules/mcp-server/tools/handlers';
import { taskCoreMcpTools } from '@/lib/modules/mcp-server/tools/task-core-tools';
import { aiEngineMcpTools } from '@/lib/modules/mcp-server/tools/ai-engine-tools';
import { projectMcpTools } from '@/lib/modules/mcp-server/tools/project-tools';
import { createProjectToolHandlers } from '@/lib/modules/mcp-server/tools/project-handlers';
import { versionMcpTools } from '@/lib/modules/mcp-server/tools/version-tools';
import { createVersionToolHandlers } from '@/lib/modules/mcp-server/tools/version-handlers';
import { testManagementMcpTools } from '@/lib/modules/mcp-server/tools/test-management-tools';
import { createTestManagementToolHandlers } from '@/lib/modules/mcp-server/tools/test-management-handlers';
import { requirementMcpTools } from '@/lib/modules/mcp-server/tools/requirement-tools';
import { createRequirementToolHandlers } from '@/lib/modules/mcp-server/tools/requirement-handlers';
import { knowledgeMcpTools } from '@/lib/modules/mcp-server/tools/knowledge-tools';
import { createKnowledgeToolHandlers } from '@/lib/modules/mcp-server/tools/knowledge-handlers';
import { lifecycleMcpTools } from '@/lib/modules/mcp-server/tools/lifecycle-tools';
import { createLifecycleToolHandlers } from '@/lib/modules/mcp-server/tools/lifecycle-handlers';
import { contextMcpTools } from '@/lib/modules/mcp-server/tools/context-tools';
import { createContextToolHandlers } from '@/lib/modules/mcp-server/tools/context-handlers';
import { promptMcpTools } from '@/lib/modules/mcp-server/tools/prompt-tools';
import { createPromptToolHandlers } from '@/lib/modules/mcp-server/tools/prompt-handlers';
import { deploymentMcpTools } from '@/lib/modules/mcp-server/tools/deployment-tools';
import { createDeploymentToolHandlers } from '@/lib/modules/mcp-server/tools/deployment-handlers';
import { dashboardMcpTools } from '@/lib/modules/mcp-server/tools/dashboard-tools';
import { createDashboardToolHandlers } from '@/lib/modules/mcp-server/tools/dashboard-handlers';
import { notificationRuleMcpTools } from '@/lib/modules/mcp-server/tools/notification-rule-tools';
import { createNotificationRuleToolHandlers } from '@/lib/modules/mcp-server/tools/notification-rule-handlers';
import { eventBusMcpTools } from '@/lib/modules/mcp-server/tools/event-bus-tools';
import { createEventBusToolHandlers } from '@/lib/modules/mcp-server/tools/event-bus-handlers';
import { outboundWebhookMcpTools } from '@/lib/modules/mcp-server/tools/outbound-webhook-tools';
import { createOutboundWebhookToolHandlers } from '@/lib/modules/mcp-server/tools/outbound-webhook-handlers';
import { workflowV3McpTools } from '@/lib/modules/mcp-server/tools/workflow-v3-tools';
import { createWorkflowV3ToolHandlers } from '@/lib/modules/mcp-server/tools/workflow-v3-handlers';
import { notificationPreferenceMcpTools } from '@/lib/modules/mcp-server/tools/notification-preference-tools';
import { createNotificationPreferenceToolHandlers } from '@/lib/modules/mcp-server/tools/notification-preference-handlers';
import { soloBridgeMcpTools } from '@/lib/modules/mcp-server/tools/solo-bridge-tools';
import { createSOLOBridgeToolHandlers } from '@/lib/modules/mcp-server/tools/solo-bridge-handlers';
import { aiHandlerMcpTools } from '@/lib/modules/mcp-server/tools/ai-handler-tools';
import { createAIHandlerToolHandlers } from '@/lib/modules/mcp-server/tools/ai-handler-handlers';
import { emailNotificationMcpTools } from '@/lib/modules/mcp-server/tools/email-notification-tools';
import { createEmailNotificationToolHandlers } from '@/lib/modules/mcp-server/tools/email-notification-handlers';
import { webpushMcpTools } from '@/lib/modules/mcp-server/tools/webpush-tools';
import { createWebPushToolHandlers } from '@/lib/modules/mcp-server/tools/webpush-handlers';
import { getPrisma } from '@/lib/db';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { APP_VERSION } from '@/lib/core/version';

/**
 * Convert JSON Schema property definition to Zod type
 */
function jsonSchemaPropToZod(prop: any): z.ZodTypeAny {
  if (!prop) return z.unknown();

  if (prop.type === 'string') {
    if (prop.enum) return z.enum(prop.enum as [string, ...string[]]);
    return z.string().optional();
  }
  if (prop.type === 'number') return z.number().optional();
  if (prop.type === 'boolean') return z.boolean().optional();
  if (prop.type === 'integer') return z.number().int().optional();
  if (prop.type === 'array') {
    const itemType = jsonSchemaPropToZod(prop.items);
    return z.array(itemType).optional();
  }
  if (prop.type === 'object') {
    const shape: Record<string, z.ZodTypeAny> = {};
    if (prop.properties) {
      for (const [key, val] of Object.entries(prop.properties)) {
        shape[key] = jsonSchemaPropToZod(val);
      }
    }
    return z.object(shape).optional();
  }
  return z.unknown().optional();
}

/**
 * Convert JSON Schema (from tool config) to Zod raw shape for MCP SDK
 */
function jsonSchemaToZodShape(schema: any): Record<string, z.ZodTypeAny> {
  if (!schema?.properties) return {};
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [key, prop] of Object.entries(schema.properties)) {
    const zodType = jsonSchemaPropToZod(prop);
    // If required, make it non-optional
    if (schema.required?.includes(key)) {
      shape[key] = zodType;
    } else {
      shape[key] = zodType.optional();
    }
  }
  return shape;
}

// Shared state: tool definitions + handlers (initialized once)
interface SharedTool {
  name: string;
  description: string;
  sourceModule: string;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
  schema: Record<string, any>; // ZodRawShapeCompat
}

let _sharedTools: SharedTool[] | null = null;
let _initialized = false;

// Session → McpServer mapping
const sessions = new Map<string, { server: McpServer; transport: WebStandardStreamableHTTPServerTransport }>();

async function initializeSharedTools() {
  if (_initialized) return;

  const logger = new Logger('mcp-http');
  logger.info('Initializing MCP shared tools for HTTP transport...');

  const eventBus = new EventBus();

  // Initialize database
  const prisma = getPrisma();
  logger.info('Prisma client initialized');

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

  // Build handler map
  const handlerMap: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {};
  const taskHandlers = createTaskCoreToolHandlers(taskService, logger);
  Object.assign(handlerMap, taskHandlers);

  // Collect tool definitions
  const allTools: SharedTool[] = [];

  for (const toolConfig of taskCoreMcpTools) {
    const handler = handlerMap[toolConfig.name];
    if (handler !== undefined) {
      allTools.push({
        name: toolConfig.name,
        description: toolConfig.description ?? `Tool: ${toolConfig.name}`,
        sourceModule: 'task-core',
        handler,
        schema: jsonSchemaToZodShape(toolConfig.inputSchema),
      });
    }
  }

  // AI engine handlers (optional)
  if (process.env.OPENAI_API_KEY) {
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

      const aiHandlers = createAIEngineToolHandlers(
        new TaskExtractor(aiModel, logger),
        new TaskDecomposer(aiModel, logger),
        new StatusInferencer(aiModel, logger),
        new TaskAnalyzer(aiModel, logger),
        logger,
      );
      Object.assign(handlerMap, aiHandlers);

      for (const toolConfig of aiEngineMcpTools) {
        const handler = handlerMap[toolConfig.name];
        if (handler !== undefined) {
          allTools.push({
            name: toolConfig.name,
            description: toolConfig.description ?? `Tool: ${toolConfig.name}`,
            sourceModule: 'ai-engine',
            handler,
            schema: jsonSchemaToZodShape(toolConfig.inputSchema),
          });
        }
      }
    } catch (error: any) {
      logger.warn(`AI Engine init failed for HTTP: ${error.message}`);
    }
  }

  // Register project lifecycle tools
  const projectHandlers = createProjectToolHandlers(logger, eventBus);
  for (const toolConfig of projectMcpTools) {
    const handler = (projectHandlers as any)[toolConfig.name];
    if (handler !== undefined) {
      allTools.push({
        name: toolConfig.name,
        description: toolConfig.description ?? `Tool: ${toolConfig.name}`,
        sourceModule: 'project-lifecycle',
        handler,
        schema: jsonSchemaToZodShape(toolConfig.inputSchema),
      });
    }
  }

  // Register version management tools
  const { VersionMgmtService } = await import('@/lib/modules/version-mgmt/version-mgmt.service');
  const versionService = new VersionMgmtService(logger, eventBus);
  const versionHandlers = createVersionToolHandlers(versionService, logger);
  for (const toolConfig of versionMcpTools) {
    const handler = (versionHandlers as any)[toolConfig.name];
    if (handler !== undefined) {
      allTools.push({
        name: toolConfig.name,
        description: toolConfig.description ?? `Tool: ${toolConfig.name}`,
        sourceModule: 'version-mgmt',
        handler,
        schema: jsonSchemaToZodShape(toolConfig.inputSchema),
      });
    }
  }

  // Register test management tools
  const { TestManagementService } = await import('@/lib/modules/test-management/test-management.service');
  const testMgmtService = new TestManagementService(logger, eventBus, () => prisma);
  const testMgmtHandlers = createTestManagementToolHandlers(testMgmtService, logger);
  for (const toolConfig of testManagementMcpTools) {
    const handler = (testMgmtHandlers as any)[toolConfig.name];
    if (handler !== undefined) {
      allTools.push({
        name: toolConfig.name,
        description: toolConfig.description ?? `Tool: ${toolConfig.name}`,
        sourceModule: 'test-management',
        handler,
        schema: jsonSchemaToZodShape(toolConfig.inputSchema),
      });
    }
  }

  // Register requirement tools
  const { RequirementsService } = await import('@/lib/modules/requirements/requirements.service');
  const reqService = new RequirementsService(logger, eventBus, () => prisma);
  const reqHandlers = createRequirementToolHandlers(reqService, logger);
  for (const toolConfig of requirementMcpTools) {
    const handler = (reqHandlers as any)[toolConfig.name];
    if (handler !== undefined) {
      allTools.push({
        name: toolConfig.name,
        description: toolConfig.description ?? `Tool: ${toolConfig.name}`,
        sourceModule: 'requirement-tools',
        handler,
        schema: jsonSchemaToZodShape(toolConfig.inputSchema),
      });
    }
  }

  // Register knowledge tools
  const { KnowledgeService } = await import('@/lib/modules/knowledge/knowledge.service');
  const knowledgeService = new KnowledgeService(logger, eventBus, () => prisma);
  const knowledgeHandlers = createKnowledgeToolHandlers(knowledgeService, logger);
  for (const toolConfig of knowledgeMcpTools) {
    const handler = (knowledgeHandlers as any)[toolConfig.name];
    if (handler !== undefined) {
      allTools.push({
        name: toolConfig.name,
        description: toolConfig.description ?? `Tool: ${toolConfig.name}`,
        sourceModule: 'knowledge-tools',
        handler,
        schema: jsonSchemaToZodShape(toolConfig.inputSchema),
      });
    }
  }

  // Register lifecycle tools
  const { LifecycleService } = await import('@/lib/modules/lifecycle/lifecycle.service');
  const lifecycleService = new LifecycleService(logger, eventBus, () => prisma);
  const lifecycleHandlers = createLifecycleToolHandlers(lifecycleService, logger);
  for (const toolConfig of lifecycleMcpTools) {
    const handler = (lifecycleHandlers as any)[toolConfig.name];
    if (handler !== undefined) {
      allTools.push({
        name: toolConfig.name,
        description: toolConfig.description ?? `Tool: ${toolConfig.name}`,
        sourceModule: 'lifecycle-tools',
        handler,
        schema: jsonSchemaToZodShape(toolConfig.inputSchema),
      });
    }
  }

  // Register context aggregation tools
  const contextHandlers = createContextToolHandlers(logger, eventBus, () => prisma);
  for (const toolConfig of contextMcpTools) {
    const handler = (contextHandlers as any)[toolConfig.name];
    if (handler !== undefined) {
      allTools.push({
        name: toolConfig.name,
        description: toolConfig.description ?? `Tool: ${toolConfig.name}`,
        sourceModule: 'context-tools',
        handler,
        schema: jsonSchemaToZodShape(toolConfig.inputSchema),
      });
    }
  }

  // Register prompt template tools
  const promptHandlers = createPromptToolHandlers(logger);
  for (const toolConfig of promptMcpTools) {
    const handler = (promptHandlers as any)[toolConfig.name];
    if (handler !== undefined) {
      allTools.push({
        name: toolConfig.name,
        description: toolConfig.description ?? `Tool: ${toolConfig.name}`,
        sourceModule: 'prompt-tools',
        handler,
        schema: jsonSchemaToZodShape(toolConfig.inputSchema),
      });
    }
  }

  // Register deployment management tools
  const { DeploymentService } = await import('@/lib/modules/deployment-mgmt/deployment.service');
  const deploymentService = new DeploymentService(logger, eventBus, () => prisma);
  const deploymentHandlers = createDeploymentToolHandlers(deploymentService, logger);
  for (const toolConfig of deploymentMcpTools) {
    const handler = (deploymentHandlers as any)[toolConfig.name];
    if (handler !== undefined) {
      allTools.push({
        name: toolConfig.name,
        description: toolConfig.description ?? `Tool: ${toolConfig.name}`,
        sourceModule: 'deployment-tools',
        handler,
        schema: jsonSchemaToZodShape(toolConfig.inputSchema),
      });
    }
  }

  // Register dashboard statistics tools
  const { StatisticsService } = await import('@/lib/modules/dashboard/statistics.service');
  const statsService = new StatisticsService(prisma, logger, eventBus);
  const dashboardHandlers = createDashboardToolHandlers(statsService, logger);
  for (const toolConfig of dashboardMcpTools) {
    const handler = (dashboardHandlers as any)[toolConfig.name];
    if (handler !== undefined) {
      allTools.push({
        name: toolConfig.name,
        description: toolConfig.description ?? `Tool: ${toolConfig.name}`,
        sourceModule: 'dashboard-tools',
        handler,
        schema: jsonSchemaToZodShape(toolConfig.inputSchema),
      });
    }
  }

  // Register notification rule tools
  const { NotificationRepository } = await import('@/lib/modules/notifications/notification.repository');
  const notificationRepo = new NotificationRepository(prisma);
  const { NotificationRuleEngine } = await import('@/lib/modules/notifications/rule-engine');
  const ruleEngine = new NotificationRuleEngine(notificationRepo, eventBus, logger, () => prisma);
  const notifRuleHandlers = createNotificationRuleToolHandlers(ruleEngine, logger);
  for (const toolConfig of notificationRuleMcpTools) {
    const handler = (notifRuleHandlers as any)[toolConfig.name];
    if (handler !== undefined) {
      allTools.push({
        name: toolConfig.name,
        description: toolConfig.description ?? `Tool: ${toolConfig.name}`,
        sourceModule: 'notification-rule-tools',
        handler,
        schema: jsonSchemaToZodShape(toolConfig.inputSchema),
      });
    }
  }

  // Register event bus tools
  const eventBusHandlers = createEventBusToolHandlers(eventBus, logger);
  for (const toolConfig of eventBusMcpTools) {
    const handler = (eventBusHandlers as any)[toolConfig.name];
    if (handler !== undefined) {
      allTools.push({
        name: toolConfig.name,
        description: toolConfig.description ?? `Tool: ${toolConfig.name}`,
        sourceModule: 'event-bus-tools',
        handler,
        schema: jsonSchemaToZodShape(toolConfig.inputSchema),
      });
    }
  }

  // Register outbound webhook tools
  const { OutboundWebhookService } = await import('@/lib/modules/integration-webhook/outbound-webhook.service');
  const outboundWebhookService = new OutboundWebhookService(logger, eventBus, () => prisma);
  const outboundWebhookHandlers = createOutboundWebhookToolHandlers(outboundWebhookService, logger);
  for (const toolConfig of outboundWebhookMcpTools) {
    const handler = (outboundWebhookHandlers as any)[toolConfig.name];
    if (handler !== undefined) {
      allTools.push({
        name: toolConfig.name,
        description: toolConfig.description ?? `Tool: ${toolConfig.name}`,
        sourceModule: 'outbound-webhook-tools',
        handler,
        schema: jsonSchemaToZodShape(toolConfig.inputSchema),
      });
    }
  }

  // Register workflow v3 tools
  const { ExecutionStateManager } = await import('@/lib/modules/workflow-engine/execution-state');
  const executionStateManager = new ExecutionStateManager(logger, () => prisma);
  const workflowV3Handlers = createWorkflowV3ToolHandlers(executionStateManager, logger);
  for (const toolConfig of workflowV3McpTools) {
    const handler = (workflowV3Handlers as any)[toolConfig.name];
    if (handler !== undefined) {
      allTools.push({
        name: toolConfig.name,
        description: toolConfig.description ?? `Tool: ${toolConfig.name}`,
        sourceModule: 'workflow-v3-tools',
        handler,
        schema: jsonSchemaToZodShape(toolConfig.inputSchema),
      });
    }
  }

  // Register notification preference tools
  const { NotificationPreferenceService } = await import('@/lib/modules/notifications/preference.service');
  const prefService = new NotificationPreferenceService(logger, () => prisma);
  const notifPrefHandlers = createNotificationPreferenceToolHandlers(prefService, logger);
  for (const toolConfig of notificationPreferenceMcpTools) {
    const handler = (notifPrefHandlers as any)[toolConfig.name];
    if (handler !== undefined) {
      allTools.push({
        name: toolConfig.name,
        description: toolConfig.description ?? `Tool: ${toolConfig.name}`,
        sourceModule: 'notification-preference-tools',
        handler,
        schema: jsonSchemaToZodShape(toolConfig.inputSchema),
      });
    }
  }

  // Register SOLO Bridge tools
  const { SOLOBridge } = await import('@/lib/modules/workflow-engine/solo/solo-bridge');
  const soloBridge = new SOLOBridge(
    {
      defaultMode: (process.env.SOLO_DEFAULT_MODE as any) || 'mcp',
      mcpEndpoint: process.env.SOLO_MCP_ENDPOINT || 'http://localhost:3001/mcp',
      restEndpoint: process.env.SOLO_REST_ENDPOINT || 'http://localhost:3001/api/solo/call',
      defaultTimeoutMs: parseInt(process.env.SOLO_TIMEOUT_MS || '30000', 10),
      maxConcurrentSessions: 5,
    },
    eventBus,
    logger,
  );
  const soloBridgeHandlers = createSOLOBridgeToolHandlers(() => soloBridge, logger);
  for (const toolConfig of soloBridgeMcpTools) {
    const handler = (soloBridgeHandlers as any)[toolConfig.name];
    if (handler !== undefined) {
      allTools.push({
        name: toolConfig.name,
        description: toolConfig.description ?? `Tool: ${toolConfig.name}`,
        sourceModule: 'solo-bridge-tools',
        handler,
        schema: jsonSchemaToZodShape(toolConfig.inputSchema),
      });
    }
  }

  // Register AI handler management tools
  const { AIOrchestrator } = await import('@/lib/modules/ai-engine/ai-orchestrator');
  const aiOrchestrator = new AIOrchestrator(eventBus, logger);
  const aiHandlerHandlers = createAIHandlerToolHandlers(() => aiOrchestrator, eventBus, logger);
  for (const toolConfig of aiHandlerMcpTools) {
    const handler = (aiHandlerHandlers as any)[toolConfig.name];
    if (handler !== undefined) {
      allTools.push({
        name: toolConfig.name,
        description: toolConfig.description ?? `Tool: ${toolConfig.name}`,
        sourceModule: 'ai-handler-tools',
        handler,
        schema: jsonSchemaToZodShape(toolConfig.inputSchema),
      });
    }
  }

  // Register email notification tools
  const emailNotifHandlers = createEmailNotificationToolHandlers(logger);
  for (const toolConfig of emailNotificationMcpTools) {
    const handler = (emailNotifHandlers as any)[toolConfig.name];
    if (handler !== undefined) {
      allTools.push({
        name: toolConfig.name,
        description: toolConfig.description ?? `Tool: ${toolConfig.name}`,
        sourceModule: 'email-notification-tools',
        handler,
        schema: jsonSchemaToZodShape(toolConfig.inputSchema),
      });
    }
  }

  // Register web push tools
  const { WebPushService } = await import('@/lib/modules/notifications/web-push.service');
  const webPushService = new WebPushService(logger);
  const webPushHandlers = createWebPushToolHandlers(() => webPushService, logger);
  for (const toolConfig of webpushMcpTools) {
    const handler = (webPushHandlers as any)[toolConfig.name];
    if (handler !== undefined) {
      allTools.push({
        name: toolConfig.name,
        description: toolConfig.description ?? `Tool: ${toolConfig.name}`,
        sourceModule: 'webpush-tools',
        handler,
        schema: jsonSchemaToZodShape(toolConfig.inputSchema),
      });
    }
  }

  _sharedTools = allTools;
  _initialized = true;
  logger.info(`MCP HTTP transport ready. ${allTools.length} tools available.`);
}

/**
 * Create a new McpServer instance with shared tools
 */
function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'AI Task Hub',
    version: APP_VERSION,
  });

  for (const tool of _sharedTools!) {
    // Use registerTool with inputSchema as raw shape
    server.registerTool(tool.name, {
      description: tool.description,
      inputSchema: tool.schema,
    }, async (args) => {
      try {
        const result = await tool.handler(args as Record<string, unknown>);
        return {
          content: [
            { type: 'text' as const, text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            { type: 'text' as const, text: `Error: ${error.message}` },
          ],
          isError: true,
        };
      }
    });
  }

  return server;
}

/**
 * Handle all HTTP methods (GET, POST, DELETE) for MCP Streamable HTTP
 */
export async function handler(request: NextRequest) {
  try {
    await initializeSharedTools();
  } catch (error: any) {
    console.error('[MCP] Failed to initialize shared tools:', error);
    return new Response(
      JSON.stringify({ error: 'MCP initialization failed', detail: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  try {
    // Check for existing session
    const sessionId = request.headers.get('mcp-session-id');

    if (sessionId && sessions.has(sessionId)) {
      // Reuse existing session's transport
      const session = sessions.get(sessionId)!;
      const webRequest = new Request(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        duplex: 'half',
      } as RequestInit);
      return session.transport.handleRequest(webRequest);
    }

    // New session: create McpServer + transport
    const mcpServer = createMcpServer();
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
    });

    await mcpServer.connect(transport);

    const webRequest = new Request(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      duplex: 'half',
    } as RequestInit);

    const response = await transport.handleRequest(webRequest);

    // Store session
    const newSessionId = transport.sessionId;
    if (newSessionId) {
      sessions.set(newSessionId, { server: mcpServer, transport });
    }

    return response;
  } catch (error: any) {
    console.error('[MCP] Handler error:', error);
    return new Response(
      JSON.stringify({ error: 'MCP request failed', detail: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}

export const GET = handler;
export const POST = handler;
export const DELETE = handler;
