import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventBus } from '@/lib/core/event-bus';
import { Logger } from '@/lib/core/logger';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { AgentRepository } from '@/lib/modules/agent-collab/agent.repository';
import { AgentOperationRepository } from '@/lib/modules/agent-collab/agent-operation.repository';
import { AgentService } from '@/lib/modules/agent-collab/agent.service';
import { PermissionService } from '@/lib/modules/agent-collab/permission.service';
import { AgentOperationLogger } from '@/lib/modules/agent-collab/operation-logger';
import { TaskRepository } from '@/lib/modules/task-core/task.repository';
import { TaskHistoryRepository } from '@/lib/modules/task-core/task-history.repository';
import { TaskDependencyRepository } from '@/lib/modules/task-core/task-dependency.repository';
import { TaskProgressService } from '@/lib/modules/task-core/task-progress.service';
import { TaskService } from '@/lib/modules/task-core/task.service';
import { join } from 'node:path';

const TEST_DB_PATH = join(process.cwd(), 'test-db', 'test-task-core.db');

function createTestServices() {
  const adapter = new PrismaBetterSqlite3({ url: TEST_DB_PATH });
  const prisma = new PrismaClient({ adapter });
  const eventBus = new EventBus();
  const logger = new Logger('test');

  const agentRepo = new AgentRepository(prisma);
  const operationRepo = new AgentOperationRepository(prisma);
  const taskRepo = new TaskRepository(prisma);
  const historyRepo = new TaskHistoryRepository(prisma);
  const depRepo = new TaskDependencyRepository(prisma);
  const progressService = new TaskProgressService(taskRepo, logger);
  const taskService = new TaskService(taskRepo, historyRepo, depRepo, progressService, eventBus, logger);

  const agentService = new AgentService(agentRepo, operationRepo, eventBus, logger);
  const permissionService = new PermissionService(taskRepo, logger);
  const operationLogger = new AgentOperationLogger(operationRepo, eventBus, logger);

  return { prisma, eventBus, logger, agentRepo, operationRepo, taskRepo, taskService, agentService, permissionService, operationLogger };
}

describe('AgentCollabModule', () => {
  let services: ReturnType<typeof createTestServices>;

  beforeEach(async () => {
    services = createTestServices();
    // Clean up
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

  describe('AgentService', () => {
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

    it('should list agents', async () => {
      await services.agentService.registerAgent({ name: 'Agent 1' });
      await services.agentService.registerAgent({ name: 'Agent 2' });

      const { agents, total } = await services.agentService.listAgents();
      expect(total).toBeGreaterThanOrEqual(2);
      expect(agents.length).toBeGreaterThanOrEqual(2);
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
      await services.operationLogger.logSuccess(agent.id, agent.name, 'test_action');

      await services.agentService.deleteAgent(agent.id);

      const deleted = await services.agentService.getAgent(agent.id);
      expect(deleted).toBeNull();

      const ops = await services.agentService.getAgentOperations(agent.id);
      expect(ops.total).toBe(0);
    });
  });

  describe('PermissionService', () => {
    it('should allow system (no agent) full access', async () => {
      const result = await services.permissionService.checkPermission(null, 'update', 'any-id');
      expect(result.allowed).toBe(true);
    });

    it('should allow user-level agent full access', async () => {
      const agent = await services.agentService.registerAgent({
        name: 'User Agent',
        permissionLevel: 'user',
      });

      const result = await services.permissionService.checkPermission(agent, 'delete', 'any-id');
      expect(result.allowed).toBe(true);
    });

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
      const task = await services.taskService.createTask({
        title: 'My Task',
      }, agent.id);

      const result = await services.permissionService.checkPermission(agent, 'update', task.id);
      expect(result.allowed).toBe(true);
    });

    it('should deny agent modifying other agent tasks', async () => {
      const owner = await services.agentService.registerAgent({ name: 'Owner' });
      const other = await services.agentService.registerAgent({ name: 'Other' });

      const task = await services.taskService.createTask({
        title: 'Owner Task',
      }, owner.id);

      const result = await services.permissionService.checkPermission(other, 'update', task.id);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('can only modify tasks it created');
    });

    it('should deny agent status change on other agent tasks', async () => {
      const owner = await services.agentService.registerAgent({ name: 'Owner' });
      const other = await services.agentService.registerAgent({ name: 'Other' });

      const task = await services.taskService.createTask({
        title: 'Owner Task',
      }, owner.id);

      const result = await services.permissionService.checkPermission(other, 'status_change', task.id);
      expect(result.allowed).toBe(false);
    });

    it('should check agent capabilities', async () => {
      const agent = await services.agentService.registerAgent({
        name: 'Limited',
        capabilities: ['task_crud'],
      });

      expect(services.permissionService.checkAgentCapability(agent, 'task_crud').allowed).toBe(true);
      expect(services.permissionService.checkAgentCapability(agent, 'ai_extract').allowed).toBe(false);
    });

    it('should allow wildcard capabilities', async () => {
      const agent = await services.agentService.registerAgent({
        name: 'Super Agent',
        capabilities: ['*'],
      });

      expect(services.permissionService.checkAgentCapability(agent, 'anything').allowed).toBe(true);
    });
  });

  describe('AgentOperationLogger', () => {
    it('should log a successful operation', async () => {
      const agent = await services.agentService.registerAgent({ name: 'Logger' });
      await services.operationLogger.logSuccess(agent.id, agent.name, 'create_task', 'task-123');

      const ops = await services.agentService.getAgentOperations(agent.id);
      expect(ops.total).toBe(1);
      expect(ops.operations[0].action).toBe('create_task');
      expect(ops.operations[0].success).toBe(true);
      expect(ops.operations[0].target).toBe('task-123');
    });

    it('should log a failed operation', async () => {
      const agent = await services.agentService.registerAgent({ name: 'Failer' });
      await services.operationLogger.logFailure(agent.id, agent.name, 'update_task', 'Permission denied', 'task-456');

      const ops = await services.agentService.getAgentOperations(agent.id);
      expect(ops.total).toBe(1);
      expect(ops.operations[0].success).toBe(false);
      expect(ops.operations[0].error).toBe('Permission denied');
    });

    it('should get agent stats', async () => {
      const agent = await services.agentService.registerAgent({ name: 'Stats' });
      await services.operationLogger.logSuccess(agent.id, agent.name, 'create_task');
      await services.operationLogger.logSuccess(agent.id, agent.name, 'create_task');
      await services.operationLogger.logFailure(agent.id, agent.name, 'update_task', 'error');

      const stats = await services.agentService.getAgentStats(agent.id);
      expect(stats.total).toBe(3);
      expect(stats.success).toBe(2);
      expect(stats.failed).toBe(1);
      expect(stats.byAction.create_task).toBe(2);
      expect(stats.byAction.update_task).toBe(1);
    });

    it('should emit domain events on operation', async () => {
      const agent = await services.agentService.registerAgent({ name: 'Event Tester' });
      const eventSpy = vi.fn();
      services.eventBus.on('agent.operation', eventSpy);

      await services.operationLogger.logSuccess(agent.id, agent.name, 'test_action');

      expect(eventSpy).toHaveBeenCalled();
      const event = eventSpy.mock.calls[0][0];
      expect(event.type).toBe('agent.operation');
      expect(event.payload.operation).toBe('test_action');
    });
  });
});
