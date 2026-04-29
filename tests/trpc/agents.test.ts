/**
 * Integration tests for agents tRPC router.
 * Tests: register, authenticate, checkPermission, list, get, update, deactivate, delete, operations, stats
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestContext, destroyTestContext, createMockContext } from './helpers';
import type { TestContext } from './helpers';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});

afterAll(async () => {
  await destroyTestContext(ctx);
});

beforeEach(async () => {
  await ctx.prisma.agent.deleteMany();
  await ctx.prisma.agentOperation.deleteMany();
  await ctx.prisma.task.deleteMany();
});

describe('agents.register', () => {
  it('should register a new agent with minimal fields', async () => {
    const agent = await ctx.agentService.registerAgent({ name: 'Test Agent' });

    expect(agent).toBeDefined();
    expect(agent.id).toBeDefined();
    expect(agent.name).toBe('Test Agent');
    expect(agent.apiKey).toMatch(/^ath_/);
    expect(agent.isActive).toBe(true);
    expect(agent.permissionLevel).toBe('agent');
  });

  it('should register with all fields', async () => {
    const agent = await ctx.agentService.registerAgent({
      name: 'Full Agent',
      description: 'A full-featured agent',
      capabilities: ['task_crud', 'ai_extract'],
      permissionLevel: 'user',
    });

    expect(agent.name).toBe('Full Agent');
    expect(agent.description).toBe('A full-featured agent');
    expect(agent.capabilities).toEqual(['task_crud', 'ai_extract']);
    expect(agent.permissionLevel).toBe('user');
  });

  it('should generate unique API keys', async () => {
    const a1 = await ctx.agentService.registerAgent({ name: 'Agent 1' });
    const a2 = await ctx.agentService.registerAgent({ name: 'Agent 2' });

    expect(a1.apiKey).not.toBe(a2.apiKey);
  });

  it('should default capabilities to task_crud', async () => {
    const agent = await ctx.agentService.registerAgent({ name: 'Default Cap' });
    expect(agent.capabilities).toEqual(['task_crud']);
  });
});

describe('agents.authenticate', () => {
  it('should authenticate with valid API key', async () => {
    const registered = await ctx.agentService.registerAgent({ name: 'Auth Agent' });
    const authenticated = await ctx.agentService.authenticate(registered.apiKey);

    expect(authenticated).not.toBeNull();
    expect(authenticated!.id).toBe(registered.id);
    expect(authenticated!.name).toBe('Auth Agent');
  });

  it('should return null for invalid API key', async () => {
    const result = await ctx.agentService.authenticate('invalid-key');
    expect(result).toBeNull();
  });

  it('should return null for deactivated agent', async () => {
    const agent = await ctx.agentService.registerAgent({ name: 'Inactive' });
    await ctx.agentService.deactivateAgent(agent.id);

    const result = await ctx.agentService.authenticate(agent.apiKey);
    expect(result).toBeNull();
  });

  it('should update lastSeenAt on authentication', async () => {
    const agent = await ctx.agentService.registerAgent({ name: 'Seen Agent' });
    expect(agent.lastSeenAt).toBeNull();

    await ctx.agentService.authenticate(agent.apiKey);
    const refreshed = await ctx.agentRepo.findById(agent.id);
    expect(refreshed!.lastSeenAt).not.toBeNull();
  });
});

describe('agents.checkPermission', () => {
  it('should allow read for all agents', async () => {
    const agent = await ctx.agentService.registerAgent({ name: 'Reader' });
    const result = await ctx.permissionService.checkPermission(agent, 'read');
    expect(result.allowed).toBe(true);
  });

  it('should allow create for all agents', async () => {
    const agent = await ctx.agentService.registerAgent({ name: 'Creator' });
    const result = await ctx.permissionService.checkPermission(agent, 'create');
    expect(result.allowed).toBe(true);
  });

  it('should allow update for own task', async () => {
    const agent = await ctx.agentService.registerAgent({ name: 'Owner' });
    const task = await ctx.taskService.createTask({ title: 'My Task', creator: agent.id }, agent.id);

    const result = await ctx.permissionService.checkPermission(agent, 'update', task.id);
    expect(result.allowed).toBe(true);
  });

  it('should deny update for other agent task', async () => {
    const agent1 = await ctx.agentService.registerAgent({ name: 'Agent 1' });
    const agent2 = await ctx.agentService.registerAgent({ name: 'Agent 2' });
    const task = await ctx.taskService.createTask({ title: 'Not Mine', creator: agent1.id }, agent1.id);

    const result = await ctx.permissionService.checkPermission(agent2, 'update', task.id);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('can only modify tasks it created');
  });

  it('should deny delete for other agent task', async () => {
    const agent1 = await ctx.agentService.registerAgent({ name: 'Agent 1' });
    const agent2 = await ctx.agentService.registerAgent({ name: 'Agent 2' });
    const task = await ctx.taskService.createTask({ title: 'Not Mine', creator: agent1.id }, agent1.id);

    const result = await ctx.permissionService.checkPermission(agent2, 'delete', task.id);
    expect(result.allowed).toBe(false);
  });

  it('should allow all actions for user-level permission', async () => {
    const agent = await ctx.agentService.registerAgent({
      name: 'User Agent',
      permissionLevel: 'user',
    });
    const task = await ctx.taskService.createTask({ title: 'Any Task', creator: 'other' }, 'other');

    const result = await ctx.permissionService.checkPermission(agent, 'delete', task.id);
    expect(result.allowed).toBe(true);
  });

  it('should allow all actions when no agent context (system)', async () => {
    const result = await ctx.permissionService.checkPermission(null, 'delete', 'any-id');
    expect(result.allowed).toBe(true);
  });

  it('should return task not found for non-existent task', async () => {
    const agent = await ctx.agentService.registerAgent({ name: 'Checker' });
    const result = await ctx.permissionService.checkPermission(agent, 'update', 'non-existent');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Task not found');
  });
});

describe('agents.list', () => {
  it('should return empty list when no agents', async () => {
    const result = await ctx.agentService.listAgents();
    expect(result.agents).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('should return all agents', async () => {
    await ctx.agentService.registerAgent({ name: 'Agent 1' });
    await ctx.agentService.registerAgent({ name: 'Agent 2' });

    const result = await ctx.agentService.listAgents();
    expect(result.agents).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it('should filter by isActive', async () => {
    const active = await ctx.agentService.registerAgent({ name: 'Active' });
    const inactive = await ctx.agentService.registerAgent({ name: 'Inactive' });
    await ctx.agentService.deactivateAgent(inactive.id);

    const result = await ctx.agentService.listAgents({ isActive: true });
    expect(result.agents).toHaveLength(1);
    expect(result.agents[0].id).toBe(active.id);
  });

  it('should paginate results', async () => {
    for (let i = 0; i < 5; i++) {
      await ctx.agentService.registerAgent({ name: `Agent ${i}` });
    }

    const result = await ctx.agentService.listAgents({ page: 1, pageSize: 2 });
    expect(result.agents).toHaveLength(2);
    expect(result.total).toBe(5);
  });
});

describe('agents.get', () => {
  it('should return agent by id', async () => {
    const created = await ctx.agentService.registerAgent({ name: 'Get Me' });
    const found = await ctx.agentService.getAgent(created.id);

    expect(found).toBeDefined();
    expect(found!.name).toBe('Get Me');
  });

  it('should return null for non-existent agent', async () => {
    const found = await ctx.agentService.getAgent('non-existent');
    expect(found).toBeNull();
  });
});

describe('agents.update', () => {
  it('should update agent name', async () => {
    const agent = await ctx.agentService.registerAgent({ name: 'Old Name' });
    const updated = await ctx.agentService.updateAgent(agent.id, { name: 'New Name' });

    expect(updated!.name).toBe('New Name');
  });

  it('should update agent capabilities', async () => {
    const agent = await ctx.agentService.registerAgent({ name: 'Cap Agent' });
    const updated = await ctx.agentService.updateAgent(agent.id, {
      capabilities: ['task_crud', 'ai_extract', 'workflow_run'],
    });

    expect(updated!.capabilities).toEqual(['task_crud', 'ai_extract', 'workflow_run']);
  });

  it('should throw for non-existent agent', async () => {
    await expect(
      ctx.agentService.updateAgent('non-existent', { name: 'Nope' }),
    ).rejects.toThrow();
  });
});

describe('agents.deactivate', () => {
  it('should deactivate an agent', async () => {
    const agent = await ctx.agentService.registerAgent({ name: 'To Deactivate' });
    await ctx.agentService.deactivateAgent(agent.id);

    const found = await ctx.agentService.getAgent(agent.id);
    expect(found!.isActive).toBe(false);
  });
});

describe('agents.delete', () => {
  it('should delete an agent and its operations', async () => {
    const agent = await ctx.agentService.registerAgent({ name: 'To Delete' });
    await ctx.operationLogger.logSuccess(agent.id, agent.name, 'test_action');

    await ctx.agentService.deleteAgent(agent.id);

    const found = await ctx.agentService.getAgent(agent.id);
    expect(found).toBeNull();

    const ops = await ctx.agentService.getAgentOperations(agent.id);
    expect(ops.operations).toHaveLength(0);
  });
});

describe('agents.operations', () => {
  it('should return operations for an agent', async () => {
    const agent = await ctx.agentService.registerAgent({ name: 'Ops Agent' });
    await ctx.operationLogger.logSuccess(agent.id, agent.name, 'create_task', 'task-1');
    await ctx.operationLogger.logSuccess(agent.id, agent.name, 'update_task', 'task-2');

    const ops = await ctx.agentService.getAgentOperations(agent.id);
    expect(ops.operations).toHaveLength(2);
    expect(ops.total).toBe(2);
  });

  it('should filter operations by action', async () => {
    const agent = await ctx.agentService.registerAgent({ name: 'Filter Agent' });
    await ctx.operationLogger.logSuccess(agent.id, agent.name, 'create_task');
    await ctx.operationLogger.logSuccess(agent.id, agent.name, 'update_task');

    const ops = await ctx.agentService.getAgentOperations(agent.id, { action: 'create_task' });
    expect(ops.operations).toHaveLength(1);
  });

  it('should paginate operations', async () => {
    const agent = await ctx.agentService.registerAgent({ name: 'Pag Agent' });
    for (let i = 0; i < 5; i++) {
      await ctx.operationLogger.logSuccess(agent.id, agent.name, `action_${i}`);
    }

    const ops = await ctx.agentService.getAgentOperations(agent.id, { limit: 2, offset: 0 });
    expect(ops.operations).toHaveLength(2);
  });
});

describe('agents.stats', () => {
  it('should return agent statistics', async () => {
    const agent = await ctx.agentService.registerAgent({ name: 'Stats Agent' });
    await ctx.operationLogger.logSuccess(agent.id, agent.name, 'create_task');
    await ctx.operationLogger.logFailure(agent.id, agent.name, 'update_task', 'some error');

    const stats = await ctx.agentService.getAgentStats(agent.id);
    expect(stats.total).toBe(2);
    expect(stats.success).toBe(1);
    expect(stats.failed).toBe(1);
    expect(stats.byAction['create_task']).toBe(1);
    expect(stats.byAction['update_task']).toBe(1);
  });
});
