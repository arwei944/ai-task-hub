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
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { NextRequest } from 'next/server';
import { z } from 'zod';

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
    version: '1.0.0',
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
  await initializeSharedTools();

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
}

export const GET = handler;
export const POST = handler;
export const DELETE = handler;
