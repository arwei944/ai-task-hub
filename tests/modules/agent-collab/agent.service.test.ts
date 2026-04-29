import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventBus } from '@/lib/core/event-bus';
import { Logger } from '@/lib/core/logger';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { AgentRepository } from '@/lib/modules/agent-collab/agent.repository';
import { AgentOperationRepository } from '@/lib/modules/agent-collab/agent-operation.repository';
import { AgentService } from '@/lib/modules/agent-collab/agent.service';
import { join } from 'node:path';

const TEST_DB_PATH = join(process.cwd(), 'test-db', 'test-task-core.db');

function createTestServices() {
  const adapter = new PrismaBetterSqlite3({ url: TEST_DB_PATH });
  const prisma = new PrismaClient({ adapter });
  const eventBus = new EventBus();
  const logger = new Logger('test');

  const agentRepo = new AgentRepository(prisma);
  const operationRepo = new AgentOperationRepository(prisma);

  const agentService = new AgentService(agentRepo, operationRepo, eventBus, logger);

  return { prisma, eventBus, logger, agentRepo, operationRepo, agentService };
}

describe('AgentService', () => {
  let services: ReturnType<typeof createTestServices>;

  beforeEach(async () => {
    services = createTestServices();
    await services.prisma.agentOperation.deleteMany();
    await services.prisma.agent.deleteMany();
  });

  afterEach(async () => {
    await services.prisma.$disconnect();
  });

  // --- 注册 ---

  it('should register a new agent with API key', async () => {
    const agent = await services.agentService.registerAgent({
      name: 'Test Agent',
      description: 'A test agent',
      capabilities: ['task_crud', 'ai_extract'],
    });

    expect(agent.id).toBeDefined();
    expect(agent.name).toBe('Test Agent');
    expect(agent.apiKey).toMatch(/^ath_[a-zA-Z0-9]{32}$/);
    expect(agent.capabilities).toEqual(['task_crud', 'ai_extract']);
    expect(agent.permissionLevel).toBe('agent');
    expect(agent.isActive).toBe(true);
  });

  it('should register a user-level agent', async () => {
    const agent = await services.agentService.registerAgent({
      name: 'Admin User',
      permissionLevel: 'user',
    });

    expect(agent.permissionLevel).toBe('user');
  });

  it('should use default capabilities when not provided', async () => {
    const agent = await services.agentService.registerAgent({ name: 'Default' });
    expect(agent.capabilities).toEqual(['task_crud']);
  });

  it('should emit agent.registered event on register', async () => {
    const eventSpy = vi.fn();
    services.eventBus.on('agent.registered', eventSpy);

    await services.agentService.registerAgent({ name: 'Event Agent' });

    expect(eventSpy).toHaveBeenCalled();
    const event = eventSpy.mock.calls[0][0];
    expect(event.type).toBe('agent.registered');
    expect(event.payload.agent.name).toBe('Event Agent');
  });

  // --- 认证 ---

  it('should authenticate an agent by API key', async () => {
    const registered = await services.agentService.registerAgent({ name: 'Auth Test' });
    const authenticated = await services.agentService.authenticate(registered.apiKey);

    expect(authenticated).not.toBeNull();
    expect(authenticated!.id).toBe(registered.id);
    expect(authenticated!.name).toBe('Auth Test');
  });

  it('should reject authentication with invalid API key', async () => {
    const result = await services.agentService.authenticate('ath_invalid_key');
    expect(result).toBeNull();
  });

  it('should reject authentication for inactive agent', async () => {
    const registered = await services.agentService.registerAgent({ name: 'Inactive' });
    await services.agentService.deactivateAgent(registered.id);

    const result = await services.agentService.authenticate(registered.apiKey);
    expect(result).toBeNull();
  });

  it('should update lastSeenAt on authentication', async () => {
    const registered = await services.agentService.registerAgent({ name: 'Seen' });
    const before = registered.lastSeenAt;

    await services.agentService.authenticate(registered.apiKey);

    const agent = await services.agentService.getAgent(registered.id);
    expect(agent!.lastSeenAt).not.toBeNull();
  });

  // --- CRUD ---

  it('should get agent by ID', async () => {
    const registered = await services.agentService.registerAgent({ name: 'Find Me' });
    const found = await services.agentService.getAgent(registered.id);

    expect(found).not.toBeNull();
    expect(found!.name).toBe('Find Me');
  });

  it('should return null for non-existent agent', async () => {
    const found = await services.agentService.getAgent('non-existent-id');
    expect(found).toBeNull();
  });

  it('should list agents', async () => {
    await services.agentService.registerAgent({ name: 'Agent 1' });
    await services.agentService.registerAgent({ name: 'Agent 2' });

    const { agents, total } = await services.agentService.listAgents();
    expect(total).toBeGreaterThanOrEqual(2);
    expect(agents.length).toBeGreaterThanOrEqual(2);
  });

  it('should list agents with isActive filter', async () => {
    const a1 = await services.agentService.registerAgent({ name: 'Active' });
    const a2 = await services.agentService.registerAgent({ name: 'To Deactivate' });
    await services.agentService.deactivateAgent(a2.id);

    const { agents, total } = await services.agentService.listAgents({ isActive: true });
    expect(total).toBeGreaterThanOrEqual(1);
    expect(agents.every(a => a.isActive)).toBe(true);
  });

  it('should update an agent', async () => {
    const agent = await services.agentService.registerAgent({ name: 'Original' });
    const updated = await services.agentService.updateAgent(agent.id, {
      name: 'Updated',
      description: 'New description',
    });

    expect(updated).not.toBeNull();
    expect(updated!.name).toBe('Updated');
    expect(updated!.description).toBe('New description');
  });

  it('should deactivate an agent', async () => {
    const agent = await services.agentService.registerAgent({ name: 'To Deactivate' });
    await services.agentService.deactivateAgent(agent.id);

    const refreshed = await services.agentService.getAgent(agent.id);
    expect(refreshed!.isActive).toBe(false);
  });

  it('should delete an agent and its operations', async () => {
    const agent = await services.agentService.registerAgent({ name: 'To Delete' });
    await services.operationRepo.create({ agentId: agent.id, action: 'test' });

    await services.agentService.deleteAgent(agent.id);

    const deleted = await services.agentService.getAgent(agent.id);
    expect(deleted).toBeNull();

    const ops = await services.agentService.getAgentOperations(agent.id);
    expect(ops.total).toBe(0);
  });

  // --- 操作历史 ---

  it('should get agent operations', async () => {
    const agent = await services.agentService.registerAgent({ name: 'Ops' });
    await services.operationRepo.create({ agentId: agent.id, action: 'create_task' });
    await services.operationRepo.create({ agentId: agent.id, action: 'update_task' });

    const ops = await services.agentService.getAgentOperations(agent.id);
    expect(ops.total).toBe(2);
  });

  it('should get recent operations across all agents', async () => {
    const a1 = await services.agentService.registerAgent({ name: 'A1' });
    const a2 = await services.agentService.registerAgent({ name: 'A2' });
    await services.operationRepo.create({ agentId: a1.id, action: 'action1' });
    await services.operationRepo.create({ agentId: a2.id, action: 'action2' });

    const recent = await services.agentService.getRecentOperations(10);
    expect(recent.length).toBeGreaterThanOrEqual(2);
  });

  it('should get agent stats', async () => {
    const agent = await services.agentService.registerAgent({ name: 'Stats' });
    await services.operationRepo.create({ agentId: agent.id, action: 'create_task', success: true });
    await services.operationRepo.create({ agentId: agent.id, action: 'create_task', success: true });
    await services.operationRepo.create({ agentId: agent.id, action: 'update_task', success: false, error: 'fail' });

    const stats = await services.agentService.getAgentStats(agent.id);
    expect(stats.total).toBe(3);
    expect(stats.success).toBe(2);
    expect(stats.failed).toBe(1);
    expect(stats.byAction.create_task).toBe(2);
    expect(stats.byAction.update_task).toBe(1);
  });
});
