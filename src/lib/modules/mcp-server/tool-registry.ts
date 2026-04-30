// ============================================================
// MCP Tool Registry - Dynamic tool collection from modules
// ============================================================

import type { Module, McpToolConfig } from '@/lib/core/types';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ILogger } from '@/lib/core/types';
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

/**
 * Resolved tool handler with metadata
 */
export interface ResolvedMcpTool {
  name: string;
  description: string;
  sourceModule: string;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
  inputSchema: Record<string, unknown>;
}

/**
 * MCP Tool Registry
 *
 * Collects MCP tool declarations from all enabled modules
 * and registers them with the McpServer instance.
 * When modules are enabled/disabled, tools are dynamically updated.
 */
export class McpToolRegistry {
  private tools: Map<string, ResolvedMcpTool> = new Map();
  private server: McpServer | null = null;
  private logger: ILogger;

  constructor(logger: ILogger) {
    this.logger = logger;
  }

  /**
   * Set the McpServer instance (called once during initialization)
   */
  setServer(server: McpServer): void {
    this.server = server;
    this.logger.info('MCP server instance set');
  }

  /**
   * Collect and register tools from a module
   */
  async registerModuleTools(module: Module, handlerResolver: (moduleName: string, toolName: string) => ((args: Record<string, unknown>) => Promise<unknown>) | undefined): Promise<void> {
    if (!module.mcpTools || module.mcpTools.length === 0) {
      this.logger.debug(`Module ${module.id} has no MCP tools`);
      return;
    }

    for (const toolConfig of module.mcpTools) {
      const handler = handlerResolver(module.id, toolConfig.name);
      if (!handler) {
        this.logger.warn(`No handler found for tool ${toolConfig.name} from module ${module.id}`);
        continue;
      }

      const tool: ResolvedMcpTool = {
        name: toolConfig.name,
        description: toolConfig.description ?? `Tool: ${toolConfig.name}`,
        sourceModule: module.id,
        handler,
        inputSchema: toolConfig.inputSchema ?? {},
      };

      this.tools.set(toolConfig.name, tool);
      this.logger.info(`Registered MCP tool: ${toolConfig.name} (from ${module.id})`);
    }

    // Notify clients about tool list changes
    if (this.server) {
      this.server.sendToolListChanged();
    }
  }

  /**
   * Unregister all tools from a module
   */
  unregisterModuleTools(moduleId: string): void {
    let removed = 0;
    for (const [name, tool] of this.tools) {
      if (tool.sourceModule === moduleId) {
        this.tools.delete(name);
        removed++;
      }
    }
    if (removed > 0) {
      this.logger.info(`Unregistered ${removed} MCP tools from module ${moduleId}`);
      if (this.server) {
        this.server.sendToolListChanged();
      }
    }
  }

  /**
   * Register all collected tools with the McpServer
   */
  async registerWithServer(): Promise<void> {
    if (!this.server) {
      throw new Error('MCP server not set. Call setServer() first.');
    }

    for (const [name, tool] of this.tools) {
      const zodShape = jsonSchemaToZodShape(tool.inputSchema);
      this.server.tool(
        name,
        tool.description,
        zodShape,
        async (args: Record<string, unknown>) => {
          try {
            const result = await tool.handler(args);
            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          } catch (error: any) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `Error: ${error.message}`,
                },
              ],
              isError: true,
            };
          }
        },
      );
    }

    this.logger.info(`Registered ${this.tools.size} tools with MCP server`);
  }

  /**
   * Get all registered tools
   */
  getTools(): ResolvedMcpTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tool by name
   */
  getTool(name: string): ResolvedMcpTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get tools grouped by source module
   */
  getToolsByModule(): Map<string, ResolvedMcpTool[]> {
    const grouped = new Map<string, ResolvedMcpTool[]>();
    for (const tool of this.tools.values()) {
      const existing = grouped.get(tool.sourceModule) ?? [];
      existing.push(tool);
      grouped.set(tool.sourceModule, existing);
    }
    return grouped;
  }

  /**
   * Clear all tools
   */
  clear(): void {
    this.tools.clear();
  }
}
