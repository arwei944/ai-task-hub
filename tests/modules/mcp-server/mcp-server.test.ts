import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpToolRegistry } from '@/lib/modules/mcp-server/tool-registry';
import type { ILogger } from '@/lib/core/types';
import type { Module, McpToolConfig } from '@/lib/core/types';

function createMockLogger(): ILogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => createMockLogger()),
  };
}

function createMockModule(id: string, tools: McpToolConfig[]): Module {
  return {
    id,
    name: `Module ${id}`,
    version: '1.0.0',
    lifecycle: {},
    mcpTools: tools,
  };
}

describe('McpToolRegistry', () => {
  let registry: McpToolRegistry;
  let logger: ILogger;

  beforeEach(() => {
    logger = createMockLogger();
    registry = new McpToolRegistry(logger);
  });

  describe('registerModuleTools', () => {
    it('should register tools from a module', async () => {
      const module = createMockModule('test-module', [
        { name: 'tool_a', description: 'Tool A', handler: 'handler_a' },
        { name: 'tool_b', description: 'Tool B', handler: 'handler_b' },
      ]);

      const handlerA = vi.fn().mockResolvedValue({ result: 'a' });
      const handlerB = vi.fn().mockResolvedValue({ result: 'b' });

      await registry.registerModuleTools(module, (_mod, toolName) => {
        if (toolName === 'tool_a') return handlerA;
        if (toolName === 'tool_b') return handlerB;
        return undefined;
      });

      expect(registry.getTools()).toHaveLength(2);
      expect(registry.getTool('tool_a')).toBeDefined();
      expect(registry.getTool('tool_a')!.sourceModule).toBe('test-module');
      expect(registry.getTool('tool_b')).toBeDefined();
    });

    it('should skip tools with no handler', async () => {
      const module = createMockModule('test-module', [
        { name: 'tool_a', description: 'Tool A', handler: 'handler_a' },
        { name: 'tool_no_handler', description: 'No Handler', handler: 'missing' },
      ]);

      await registry.registerModuleTools(module, () => undefined);

      expect(registry.getTools()).toHaveLength(0);
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should handle module with no MCP tools', async () => {
      const module = createMockModule('empty-module', []);

      await registry.registerModuleTools(module, () => undefined);

      expect(registry.getTools()).toHaveLength(0);
    });
  });

  describe('unregisterModuleTools', () => {
    it('should remove all tools from a specific module', async () => {
      const moduleA = createMockModule('module-a', [
        { name: 'tool_a1', description: 'A1', handler: 'h' },
        { name: 'tool_a2', description: 'A2', handler: 'h' },
      ]);
      const moduleB = createMockModule('module-b', [
        { name: 'tool_b1', description: 'B1', handler: 'h' },
      ]);

      const handler = vi.fn().mockResolvedValue({});
      await registry.registerModuleTools(moduleA, () => handler);
      await registry.registerModuleTools(moduleB, () => handler);

      expect(registry.getTools()).toHaveLength(3);

      registry.unregisterModuleTools('module-a');

      expect(registry.getTools()).toHaveLength(1);
      expect(registry.getTool('tool_a1')).toBeUndefined();
      expect(registry.getTool('tool_b1')).toBeDefined();
    });

    it('should do nothing if module has no tools', () => {
      registry.unregisterModuleTools('non-existent');
      expect(registry.getTools()).toHaveLength(0);
    });
  });

  describe('getToolsByModule', () => {
    it('should group tools by source module', async () => {
      const moduleA = createMockModule('module-a', [
        { name: 'tool_a1', description: 'A1', handler: 'h' },
      ]);
      const moduleB = createMockModule('module-b', [
        { name: 'tool_b1', description: 'B1', handler: 'h' },
        { name: 'tool_b2', description: 'B2', handler: 'h' },
      ]);

      const handler = vi.fn().mockResolvedValue({});
      await registry.registerModuleTools(moduleA, () => handler);
      await registry.registerModuleTools(moduleB, () => handler);

      const grouped = registry.getToolsByModule();

      expect(grouped.get('module-a')).toHaveLength(1);
      expect(grouped.get('module-b')).toHaveLength(2);
    });
  });

  describe('clear', () => {
    it('should remove all registered tools', async () => {
      const module = createMockModule('test', [
        { name: 'tool_a', description: 'A', handler: 'h' },
        { name: 'tool_b', description: 'B', handler: 'h' },
      ]);

      await registry.registerModuleTools(module, () => vi.fn().mockResolvedValue({}));
      expect(registry.getTools()).toHaveLength(2);

      registry.clear();
      expect(registry.getTools()).toHaveLength(0);
    });
  });

  describe('tool handler execution', () => {
    it('should call the correct handler when invoked', async () => {
      const module = createMockModule('test', [
        { name: 'my_tool', description: 'My Tool', handler: 'my_handler' },
      ]);

      const handler = vi.fn().mockResolvedValue({ success: true, data: 42 });
      await registry.registerModuleTools(module, () => handler);

      const tool = registry.getTool('my_tool')!;
      const result = await tool.handler({ input: 'test' });

      expect(handler).toHaveBeenCalledWith({ input: 'test' });
      expect(result).toEqual({ success: true, data: 42 });
    });
  });
});

describe('MCP Tool Definitions', () => {
  it('task-core tools should have correct names and descriptions', async () => {
    const { taskCoreMcpTools } = await import('@/lib/modules/mcp-server/tools/task-core-tools');

    expect(taskCoreMcpTools).toHaveLength(9);

    const names = taskCoreMcpTools.map(t => t.name);
    expect(names).toContain('create_task');
    expect(names).toContain('update_task');
    expect(names).toContain('get_task');
    expect(names).toContain('list_tasks');
    expect(names).toContain('delete_task');
    expect(names).toContain('update_task_status');
    expect(names).toContain('get_task_history');
    expect(names).toContain('get_sub_tasks');
    expect(names).toContain('get_status_counts');

    // All tools should have descriptions
    for (const tool of taskCoreMcpTools) {
      expect(tool.description).toBeTruthy();
      expect(tool.handler).toBeTruthy();
    }
  });

  it('ai-engine tools should have correct names and descriptions', async () => {
    const { aiEngineMcpTools } = await import('@/lib/modules/mcp-server/tools/ai-engine-tools');

    expect(aiEngineMcpTools).toHaveLength(4);

    const names = aiEngineMcpTools.map(t => t.name);
    expect(names).toContain('extract_tasks');
    expect(names).toContain('decompose_task');
    expect(names).toContain('infer_task_status');
    expect(names).toContain('generate_report');

    for (const tool of aiEngineMcpTools) {
      expect(tool.description).toBeTruthy();
      expect(tool.handler).toBeTruthy();
    }
  });

  it('task-core tools should have input schemas with required fields', async () => {
    const { taskCoreMcpTools } = await import('@/lib/modules/mcp-server/tools/task-core-tools');

    const createTool = taskCoreMcpTools.find(t => t.name === 'create_task')!;
    const schema = createTool.inputSchema as any;
    expect(schema.required).toContain('title');

    const getTool = taskCoreMcpTools.find(t => t.name === 'get_task')!;
    const getSchema = getTool.inputSchema as any;
    expect(getSchema.required).toContain('id');
  });
});
