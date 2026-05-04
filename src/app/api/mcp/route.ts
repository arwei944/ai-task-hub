// ============================================================
// MCP Streamable HTTP Transport API Route (v3 — Slim)
// ============================================================
//
// Provides Streamable HTTP transport for MCP over HTTP.
// Remote clients can connect to this endpoint.
//
// Session management: each session gets its own McpServer instance.
// Tool definitions and handlers are shared (initialized once).
//
// v3: Replaced 525-line initializeSharedTools() with McpAutoRegistry.
//     All 24 tool modules are auto-discovered via declarative descriptors.
//     To add a new tool module: add a descriptor in mcp-modules.ts. Done.
// ============================================================

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { Logger } from '@/lib/core/logger';
import { EventBus } from '@/lib/core/event-bus';
import { getPrisma } from '@/lib/db';
import { NextRequest } from 'next/server';
import { APP_VERSION } from '@/lib/core/version';
import { McpAutoRegistry, mcpToolModules } from '@/lib/core/v3';
import type { ResolvedTool } from '@/lib/core/v3';

// ---- Shared state ----

let _sharedTools: ResolvedTool[] | null = null;
let _initialized = false;

// Session → McpServer mapping
const sessions = new Map<string, { server: McpServer; transport: WebStandardStreamableHTTPServerTransport }>();

// ---- Registry singleton ----

const registry = new McpAutoRegistry().registerAll(mcpToolModules);

// ---- Initialization ----

async function initializeSharedTools() {
  if (_initialized) return;

  const logger = new Logger('mcp-http');
  logger.info('Initializing MCP shared tools via auto-discovery registry...');

  const eventBus = new EventBus();
  const prisma = getPrisma();

  _sharedTools = await registry.initialize({
    logger: logger as unknown as Record<string, (...args: unknown[]) => void>,
    eventBus,
    prisma,
    services: new Map(),
  });

  _initialized = true;
}

// ---- McpServer factory ----

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'AI Task Hub',
    version: APP_VERSION,
  });

  for (const tool of _sharedTools!) {
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

// ---- HTTP Handler ----

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
