// ============================================================
// MCP Auto-Discovery Registry (v3)
// ============================================================
//
// Replaces the 525-line initializeSharedTools() in route.ts.
// Each tool module declares itself via McpToolModuleDescriptor,
// and the registry handles dynamic import, dependency injection,
// handler creation, and tool registration automatically.
//

import type { McpToolConfig } from '@/lib/core/types';
import { z } from 'zod';

// ---- Types ----

/** A resolved tool ready for McpServer registration */
export interface ResolvedTool {
  name: string;
  description: string;
  sourceModule: string;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
  schema: Record<string, any>; // ZodRawShapeCompat
}

/** Shared context passed to all module initializers */
export interface ModuleContext {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logger: any;
  eventBus: any;
  prisma: any;
  /** Shared service instances that modules can register for cross-module deps */
  services: Map<string, any>;
}

/** A tool module's self-descriptor */
export interface McpToolModuleDescriptor {
  /** Unique module id (e.g., 'task-core', 'notification-rule') */
  id: string;
  /** Display name for logging */
  name: string;
  /** Import path for tool definitions (McpToolConfig[]) */
  toolsPath: string;
  /** Named export of the tool definitions array */
  toolsExport: string;
  /** Import path for handler factory */
  handlersPath: string;
  /** Named export of the handler factory function */
  handlersExport: string;
  /**
   * Optional: custom initialization function.
   * Called before handler factory. Use this for:
   * - Creating service instances and registering them in ctx.services
   * - Running side effects (e.g., ruleEngine.start())
   * - Setting up cross-module dependencies
   *
   * Must return the args to pass to the handler factory.
   * If omitted, the handler factory is called with (ctx) directly.
   */
  init?: (ctx: ModuleContext) => Promise<any[]> | any[];
  /**
   * Optional: dependencies on other modules (by id).
   * The registry ensures these are initialized first.
   */
  dependsOn?: string[];
  /**
   * Optional: if true, errors during init are caught and logged as warnings
   * instead of failing the entire registry.
   */
  optional?: boolean;
}

// ---- JSON Schema → Zod helpers (moved from route.ts) ----

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

export function jsonSchemaToZodShape(schema: any): Record<string, z.ZodTypeAny> {
  if (!schema?.properties) return {};
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [key, prop] of Object.entries(schema.properties)) {
    const zodType = jsonSchemaPropToZod(prop);
    if (schema.required?.includes(key)) {
      shape[key] = zodType;
    } else {
      shape[key] = zodType.optional();
    }
  }
  return shape;
}

// ---- Registry ----

export class McpAutoRegistry {
  private modules = new Map<string, McpToolModuleDescriptor>();
  private tools: ResolvedTool[] = [];
  private initialized = false;
  private initOrder: string[] = [];

  /** Register a tool module descriptor */
  register(descriptor: McpToolModuleDescriptor): this {
    if (this.modules.has(descriptor.id)) {
      throw new Error(`MCP tool module '${descriptor.id}' already registered`);
    }
    this.modules.set(descriptor.id, descriptor);
    return this;
  }

  /** Register multiple descriptors at once */
  registerAll(descriptors: McpToolModuleDescriptor[]): this {
    for (const d of descriptors) {
      this.register(d);
    }
    return this;
  }

  /**
   * Initialize all registered modules in dependency order.
   * Returns the resolved tool list.
   */
  async initialize(ctx: ModuleContext): Promise<ResolvedTool[]> {
    if (this.initialized) return this.tools;

    const order = this.resolveInitOrder();
    this.initOrder = order;

    for (const moduleId of order) {
      const mod = this.modules.get(moduleId)!;
      try {
        await this.initModule(mod, ctx);
      } catch (err: any) {
        if (mod.optional) {
          ctx.logger.warn(`[MCP Registry] Optional module '${mod.id}' failed to init: ${err.message}`);
        } else {
          throw new Error(`[MCP Registry] Failed to init module '${mod.id}': ${err.message}`);
        }
      }
    }

    this.initialized = true;
    ctx.logger.info(`[MCP Registry] ${this.tools.length} tools from ${order.length} modules ready.`);
    return this.tools;
  }

  /** Get all resolved tools */
  getTools(): ResolvedTool[] {
    return this.tools;
  }

  /** Get initialization order */
  getInitOrder(): string[] {
    return [...this.initOrder];
  }

  /** Get tools grouped by module */
  getToolsByModule(): Map<string, ResolvedTool[]> {
    const grouped = new Map<string, ResolvedTool[]>();
    for (const tool of this.tools) {
      const list = grouped.get(tool.sourceModule) ?? [];
      list.push(tool);
      grouped.set(tool.sourceModule, list);
    }
    return grouped;
  }

  /** Check if initialized */
  isInitialized(): boolean {
    return this.initialized;
  }

  /** Reset for testing */
  reset(): void {
    this.tools = [];
    this.initialized = false;
    this.initOrder = [];
  }

  // ---- Internal ----

  /** Topological sort of modules based on dependsOn */
  private resolveInitOrder(): string[] {
    const visited = new Set<string>();
    const order: string[] = [];
    const visiting = new Set<string>();

    const visit = (id: string) => {
      if (visited.has(id)) return;
      if (visiting.has(id)) {
        throw new Error(`Circular dependency detected involving module '${id}'`);
      }
      visiting.add(id);

      const mod = this.modules.get(id);
      if (!mod) {
        throw new Error(`Module '${id}' not found (declared as dependency)`);
      }

      for (const dep of mod.dependsOn ?? []) {
        visit(dep);
      }

      visiting.delete(id);
      visited.add(id);
      order.push(id);
    };

    for (const id of this.modules.keys()) {
      visit(id);
    }

    return order;
  }

  /** Initialize a single module */
  private async initModule(mod: McpToolModuleDescriptor, ctx: ModuleContext): Promise<void> {
    // Dynamic import tool definitions
    const toolsModule = await import(mod.toolsPath);
    const toolConfigs: McpToolConfig[] = toolsModule[mod.toolsExport];
    if (!toolConfigs || toolConfigs.length === 0) {
      ctx.logger.debug(`[MCP Registry] Module '${mod.id}' has no tool definitions, skipping.`);
      return;
    }

    // Dynamic import handler factory
    const handlersModule = await import(mod.handlersPath);
    const handlerFactory = handlersModule[mod.handlersExport];
    if (typeof handlerFactory !== 'function') {
      throw new Error(`Handler factory '${mod.handlersExport}' is not a function in ${mod.handlersPath}`);
    }

    // Run custom init if provided, otherwise use ctx directly
    let handlerArgs: any[];
    if (mod.init) {
      handlerArgs = await mod.init(ctx);
      if (!Array.isArray(handlerArgs)) {
        handlerArgs = [handlerArgs];
      }
    } else {
      handlerArgs = [ctx];
    }

    // Create handler map
    const handlerMap = handlerFactory(...handlerArgs);
    if (!handlerMap || typeof handlerMap !== 'object') {
      throw new Error(`Handler factory for '${mod.id}' did not return an object`);
    }

    // Resolve tools
    for (const toolConfig of toolConfigs) {
      const handler = (handlerMap as any)[toolConfig.name];
      if (handler !== undefined) {
        this.tools.push({
          name: toolConfig.name,
          description: toolConfig.description ?? `Tool: ${toolConfig.name}`,
          sourceModule: mod.id,
          handler,
          schema: jsonSchemaToZodShape(toolConfig.inputSchema),
        });
      }
    }

    ctx.logger.debug(`[MCP Registry] Module '${mod.id}': ${toolConfigs.length} definitions, ${this.tools.filter(t => t.sourceModule === mod.id).length} resolved.`);
  }
}
