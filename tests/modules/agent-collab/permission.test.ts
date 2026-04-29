import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventBus } from '@/lib/core/event-bus';
import { Logger } from '@/lib/core/logger';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { AgentRepository } from '@/lib/modules/agent-collab/agent.repository';
import { AgentService } from '@/lib/modules/agent-collab/agent.service';
import { PermissionService } from '@/lib/modules/agent-collab/permission.service';
import { TaskRepository } from '@/lib/modules/task-core/task.repository';
import { TaskHistoryRepository } from '@/lib/modules/task-core/task-history.repository';
import { TaskDependencyRepository } from '@/lib/modules/task-core/task-dependency.repository';
import { TaskProgressService } from '@/lib/modules/task-core/task-progress.service';
import { TaskService } from '@/lib/modules/task-core/task.service';
import type { AgentData } from '@/lib/modules/agent-collab/agent.repository';
import { join } from 'node:path';

const TEST_DB_PATH = join(process.cwd(), 'test-db', 'test-task-core.db');

function createTestServices() {
  const adapter = new PrismaBetterSqlite3({ url: TEST_DB_PATH });
  const prisma = new PrismaClient({ adapter });
  const eventBus = new EventBus();
  const logger = new Logger('test');

  const agentRepo = new AgentRepository(prisma);
  const operationRepo = { deleteByAgent: vi.fn() };
  const agentService = new AgentService(agentRepo, operationRepo as any, eventBus, logger);

  const taskRepo = new TaskRepository(prisma);
  const historyRepo = new TaskHistoryRepository(prisma);
  const depRepo = new TaskDependencyRepository(prisma);
  const progressService = new TaskProgressService(taskRepo, logger);
  const taskService = new TaskService(taskRepo, historyRepo, depRepo, progressService, eventBus, logger);

  const permissionService = new PermissionService(taskRepo, logger);

  return { prisma, eventBus, logger, agentRepo, agentService, taskService, permissionService };
}

describe('PermissionService', () => {
  let services: ReturnType<typeof createTestServices>;

  beforeEach(async () => {
    services = createTestServices();
    await services.prisma.agentOperation.deleteMany();
    await services.prisma.agent.deleteMany();
    await services.prisma.taskHistory.deleteMany();
    await services.prisma.taskDependency.deleteMany();
    await services.prisma.taskTag.deleteMany();
    await services.prisma.tag.deleteMany();
    await services.prisma.task.deleteMany();
  });

  afterEach(async () => {
    await services.prisma.$disconnect();
  });

  // --- 系统权限（无 agent 上下文） ---

  it('should allow system (no agent) full access to any action', async () => {
    const actions = ['read', 'create', 'update', 'delete', 'status_change'] as const;
    for (const action of actions) {
      const result = await services.permissionService.checkPermission(null, action, 'any-id');
      expect(result.allowed).toBe(true);
    }
  });

  // --- 用户级权限 ---

  it('should allow user-level agent full access', async () => {
    const agent = await services.agentService.registerAgent({
      name: 'User Agent',
      permissionLevel: 'user',
    });

    const actions = ['read', 'create', 'update', 'delete', 'status_change'] as const;
    for (const action of actions) {
      const result = await services.permissionService.checkPermission(agent, action, 'any-id');
      expect(result.allowed).toBe(true);
    }
  });

  // --- Agent 级权限 ---

  it('should allow agent-level read access to any task', async () => {
    const agent = await services.agentService.registerAgent({ name: 'Reader' });
    const result = await services.permissionService.checkPermission(agent, 'read', 'any-id');
    expect(result.allowed).toBe(true);
  });

  it('should allow agent to create tasks', async () => {
    const agent = await services.agentService.registerAgent({ name: 'Creator' });
    const result = await services.permissionService.checkPermission(agent, 'create');
    expect(result.allowed).toBe(true);
  });

  it('should allow agent to modify own tasks', async () => {
    const agent = await services.agentService.registerAgent({ name: 'Owner' });
    const task = await services.taskService.createTask({ title: 'My Task' }, agent.id);

    const result = await services.permissionService.checkPermission(agent, 'update', task.id);
    expect(result.allowed).toBe(true);
  });

  it('should allow agent to delete own tasks', async () => {
    const agent = await services.agentService.registerAgent({ name: 'Owner' });
    const task = await services.taskService.createTask({ title: 'My Task' }, agent.id);

    const result = await services.permissionService.checkPermission(agent, 'delete', task.id);
    expect(result.allowed).toBe(true);
  });

  it('should allow agent to change status of own tasks', async () => {
    const agent = await services.agentService.registerAgent({ name: 'Owner' });
    const task = await services.taskService.createTask({ title: 'My Task' }, agent.id);

    const result = await services.permissionService.checkPermission(agent, 'status_change', task.id);
    expect(result.allowed).toBe(true);
  });

  it('should deny agent modifying other agent tasks', async () => {
    const owner = await services.agentService.registerAgent({ name: 'Owner' });
    const other = await services.agentService.registerAgent({ name: 'Other' });
    const task = await services.taskService.createTask({ title: 'Owner Task' }, owner.id);

    const result = await services.permissionService.checkPermission(other, 'update', task.id);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('can only modify tasks it created');
  });

  it('should deny agent deleting other agent tasks', async () => {
    const owner = await services.agentService.registerAgent({ name: 'Owner' });
    const other = await services.agentService.registerAgent({ name: 'Other' });
    const task = await services.taskService.createTask({ title: 'Owner Task' }, owner.id);

    const result = await services.permissionService.checkPermission(other, 'delete', task.id);
    expect(result.allowed).toBe(false);
  });

  it('should deny agent status change on other agent tasks', async () => {
    const owner = await services.agentService.registerAgent({ name: 'Owner' });
    const other = await services.agentService.registerAgent({ name: 'Other' });
    const task = await services.taskService.createTask({ title: 'Owner Task' }, owner.id);

    const result = await services.permissionService.checkPermission(other, 'status_change', task.id);
    expect(result.allowed).toBe(false);
  });

  it('should allow agent update without specific taskId (creating new)', async () => {
    const agent = await services.agentService.registerAgent({ name: 'Creator' });
    const result = await services.permissionService.checkPermission(agent, 'update');
    expect(result.allowed).toBe(true);
  });

  it('should return not found for non-existent task', async () => {
    const agent = await services.agentService.registerAgent({ name: 'Tester' });
    const result = await services.permissionService.checkPermission(agent, 'update', 'non-existent-task');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Task not found');
  });

  // --- 能力检查 ---

  it('should check agent capabilities - has capability', async () => {
    const agent = await services.agentService.registerAgent({
      name: 'Limited',
      capabilities: ['task_crud'],
    });

    expect(services.permissionService.checkAgentCapability(agent, 'task_crud').allowed).toBe(true);
  });

  it('should check agent capabilities - missing capability', async () => {
    const agent = await services.agentService.registerAgent({
      name: 'Limited',
      capabilities: ['task_crud'],
    });

    const result = services.permissionService.checkAgentCapability(agent, 'ai_extract');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('does not have capability');
  });

  it('should allow wildcard capabilities', async () => {
    const agent = await services.agentService.registerAgent({
      name: 'Super Agent',
      capabilities: ['*'],
    });

    expect(services.permissionService.checkAgentCapability(agent, 'anything').allowed).toBe(true);
    expect(services.permissionService.checkAgentCapability(agent, 'task_crud').allowed).toBe(true);
  });

  it('should allow null agent in capability check (system)', () => {
    const result = services.permissionService.checkAgentCapability(null, 'anything');
    expect(result.allowed).toBe(true);
  });

  it('should allow user-level agent in capability check', async () => {
    const agent = await services.agentService.registerAgent({
      name: 'User',
      permissionLevel: 'user',
    });

    expect(services.permissionService.checkAgentCapability(agent, 'anything').allowed).toBe(true);
  });

  it('should handle agent with null capabilities', async () => {
    const agent = await services.agentService.registerAgent({
      name: 'No Caps',
      capabilities: [],
    });

    expect(services.permissionService.checkAgentCapability(agent, 'task_crud').allowed).toBe(false);
  });
});
