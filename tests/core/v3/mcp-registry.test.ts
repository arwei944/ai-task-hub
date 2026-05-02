// ============================================================
// MCP Auto-Discovery Registry Tests
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { McpAutoRegistry, jsonSchemaToZodShape } from '@/lib/core/v3/mcp-registry';
import type { McpToolModuleDescriptor, ModuleContext } from '@/lib/core/v3/mcp-registry';

// ---- Helpers ----

function createMockContext(): ModuleContext {
  return {
    logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
    eventBus: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
    prisma: {},
    services: new Map(),
  };
}

// Paths for test fixtures (moved from src/ to tests/)
const fixturesBase = '@/../tests/core/v3/mcp-test-fixtures';

function testModule(id: string, opts?: Partial<Pick<McpToolModuleDescriptor, 'init' | 'dependsOn' | 'optional'>>): McpToolModuleDescriptor {
  return {
    id,
    name: id,
    toolsPath: `${fixturesBase}/__test_tools_${id}`,
    toolsExport: 'tools',
    handlersPath: `${fixturesBase}/__test_handlers_${id}`,
    handlersExport: 'createHandlers',
    init: opts?.init ?? (async (ctx) => [ctx]),
    dependsOn: opts?.dependsOn,
    optional: opts?.optional,
  };
}

// ---- jsonSchemaToZodShape ----

describe('jsonSchemaToZodShape', () => {
  it('should convert simple schema to zod shape', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
        active: { type: 'boolean' },
      },
      required: ['name'],
    };

    const shape = jsonSchemaToZodShape(schema);
    expect(shape).toHaveProperty('name');
    expect(shape).toHaveProperty('age');
    expect(shape).toHaveProperty('active');
  });

  it('should return empty object for null schema', () => {
    expect(jsonSchemaToZodShape(null)).toEqual({});
    expect(jsonSchemaToZodShape(undefined)).toEqual({});
    expect(jsonSchemaToZodShape({})).toEqual({});
  });

  it('should handle array and object types', () => {
    const schema = {
      type: 'object',
      properties: {
        tags: { type: 'array', items: { type: 'string' } },
        meta: { type: 'object', properties: { key: { type: 'string' } } },
      },
    };

    const shape = jsonSchemaToZodShape(schema);
    expect(shape).toHaveProperty('tags');
    expect(shape).toHaveProperty('meta');
  });

  it('should handle enum types', () => {
    const schema = {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['active', 'inactive'] },
      },
      required: ['status'],
    };

    const shape = jsonSchemaToZodShape(schema);
    expect(shape).toHaveProperty('status');
  });
});

// ---- McpAutoRegistry ----

describe('McpAutoRegistry', () => {
  let registry: McpAutoRegistry;

  beforeEach(() => {
    registry = new McpAutoRegistry();
  });

  // ---- Registration ----

  describe('register', () => {
    it('should register a single module', () => {
      registry.register(testModule('dep'));
      expect(registry.isInitialized()).toBe(false);
    });

    it('should reject duplicate module ids', () => {
      registry.register(testModule('dup'));
      expect(() => registry.register(testModule('dup'))).toThrow(
        "module 'dup' already registered",
      );
    });

    it('should register multiple modules via registerAll', () => {
      registry.registerAll([testModule('a'), testModule('b'), testModule('c')]);
      expect(registry.isInitialized()).toBe(false);
    });
  });

  // ---- Dependency Resolution ----

  describe('dependency resolution', () => {
    it('should detect circular dependencies', async () => {
      registry.registerAll([
        { ...testModule('dep'), dependsOn: ['main'] },
        { ...testModule('main'), dependsOn: ['dep'] },
      ]);

      await expect(
        registry.initialize(createMockContext()),
      ).rejects.toThrow('Circular dependency');
    });

    it('should detect missing dependencies', async () => {
      registry.register(testModule('a'));
      registry.register({ ...testModule('b'), dependsOn: ['nonexistent'] });

      await expect(
        registry.initialize(createMockContext()),
      ).rejects.toThrow("Module 'nonexistent' not found");
    });

    it('should initialize dependencies before dependents', async () => {
      const order: string[] = [];

      registry.register({
        ...testModule('dep'),
        init: async (ctx) => { order.push('dep'); return [ctx]; },
      });
      registry.register({
        ...testModule('main'),
        dependsOn: ['dep'],
        init: async (ctx) => { order.push('main'); return [ctx]; },
      });

      await registry.initialize(createMockContext());
      expect(order).toEqual(['dep', 'main']);
    });
  });

  // ---- Tool Resolution ----

  describe('tool resolution', () => {
    it('should resolve tools from module descriptors', async () => {
      registry.register(testModule('resolved'));

      const tools = await registry.initialize(createMockContext());
      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe('tool_a');
      expect(tools[0].sourceModule).toBe('resolved');
      expect(tools[0].description).toBe('Tool A');
      expect(tools[1].name).toBe('tool_b');
      expect(tools[1].description).toBe('Tool B');
    });

    it('should skip tools without matching handlers', async () => {
      registry.register(testModule('partial'));

      const tools = await registry.initialize(createMockContext());
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('has_handler');
    });

    it('should invoke handlers with correct arguments from init', async () => {
      registry.register({
        ...testModule('custom'),
        init: async (ctx) => {
          ctx.services.set('myService', { value: 42 });
          return ['custom-arg-1', 'custom-arg-2'];
        },
      });

      const tools = await registry.initialize(createMockContext());
      expect(tools).toHaveLength(1);

      // Verify the handler was called with custom args
      const result = await tools[0].handler({});
      expect(result).toEqual({ result: 'custom', args: ['custom-arg-1', 'custom-arg-2'] });
    });
  });

  // ---- Optional Modules ----

  describe('optional modules', () => {
    it('should not fail when optional module throws', async () => {
      registry.register({
        ...testModule('optfail'),
        optional: true,
        init: async () => { throw new Error('Intentional failure'); },
      });

      const ctx = createMockContext();
      const tools = await registry.initialize(ctx);
      expect(tools).toHaveLength(0);
      expect(ctx.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Optional module 'optfail' failed"),
      );
    });

    it('should fail when non-optional module throws', async () => {
      registry.register({
        ...testModule('reqfail'),
        init: async () => { throw new Error('Intentional failure'); },
      });

      await expect(
        registry.initialize(createMockContext()),
      ).rejects.toThrow("Failed to init module 'reqfail'");
    });
  });

  // ---- Query Methods ----

  describe('query methods', () => {
    it('should return tools via getTools()', async () => {
      registry.register(testModule('qmod'));

      await registry.initialize(createMockContext());
      expect(registry.getTools()).toHaveLength(2);
    });

    it('should group tools by module via getToolsByModule()', async () => {
      registry.register(testModule('ga'));
      registry.register(testModule('gb'));

      await registry.initialize(createMockContext());
      const grouped = registry.getToolsByModule();
      expect(grouped.get('ga')).toHaveLength(1);
      expect(grouped.get('gb')).toHaveLength(2);
    });

    it('should return init order via getInitOrder()', async () => {
      registry.register(testModule('dep'));
      registry.register({ ...testModule('main'), dependsOn: ['dep'] });

      await registry.initialize(createMockContext());
      expect(registry.getInitOrder()).toEqual(['dep', 'main']);
    });
  });

  // ---- Reset ----

  describe('reset', () => {
    it('should allow re-initialization after reset', async () => {
      registry.register(testModule('reset'));

      const tools1 = await registry.initialize(createMockContext());
      expect(tools1).toHaveLength(1);

      registry.reset();
      expect(registry.isInitialized()).toBe(false);
      expect(registry.getTools()).toHaveLength(0);

      const tools2 = await registry.initialize(createMockContext());
      expect(tools2).toHaveLength(1);
    });
  });

  // ---- Idempotency ----

  describe('idempotency', () => {
    it('should return cached tools on second initialize call', async () => {
      registry.register(testModule('idem'));

      const ctx = createMockContext();
      const tools1 = await registry.initialize(ctx);
      const tools2 = await registry.initialize(ctx);

      expect(tools1).toBe(tools2); // Same reference
    });
  });

  // ---- Module Count ----

  describe('module count', () => {
    it('should report correct number of resolved tools', async () => {
      registry.registerAll([testModule('dep'), testModule('main')]);

      const tools = await registry.initialize(createMockContext());
      // dep has 1 tool, main has 1 tool
      expect(tools).toHaveLength(2);
    });
  });
});
