import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventBus } from '@/lib/core/event-bus';
import { Logger } from '@/lib/core/logger';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { IntegrationRepository, WebhookRepository } from '@/lib/modules/integration-core/integration.repository';
import { IntegrationService } from '@/lib/modules/integration-core/integration.service';
import { TaskRepository } from '@/lib/modules/task-core/task.repository';
import { TaskHistoryRepository } from '@/lib/modules/task-core/task-history.repository';
import { TaskDependencyRepository } from '@/lib/modules/task-core/task-dependency.repository';
import { TaskProgressService } from '@/lib/modules/task-core/task-progress.service';
import { TaskService } from '@/lib/modules/task-core/task.service';
import type { IntegrationAdapter, SyncResult } from '@/lib/modules/integration-core/types';
import { join } from 'node:path';

const TEST_DB_PATH = join(process.cwd(), 'test-db', 'test-task-core.db');

function createTestServices() {
  const adapter = new PrismaBetterSqlite3({ url: TEST_DB_PATH });
  const prisma = new PrismaClient({ adapter });
  const eventBus = new EventBus();
  const logger = new Logger('test');

  const integrationRepo = new IntegrationRepository(prisma);
  const webhookRepo = new WebhookRepository(prisma);
  const taskRepo = new TaskRepository(prisma);
  const historyRepo = new TaskHistoryRepository(prisma);
  const depRepo = new TaskDependencyRepository(prisma);
  const progressService = new TaskProgressService(taskRepo, logger);
  const taskService = new TaskService(taskRepo, historyRepo, depRepo, progressService, eventBus, logger);

  const integrationService = new IntegrationService(integrationRepo, webhookRepo, taskService, eventBus, logger);

  return { prisma, eventBus, logger, integrationRepo, webhookRepo, integrationService };
}

describe('IntegrationService', () => {
  let services: ReturnType<typeof createTestServices>;

  beforeEach(async () => {
    services = createTestServices();
    await services.prisma.webhook.deleteMany();
    await services.prisma.integration.deleteMany();
    await services.prisma.taskHistory.deleteMany();
    await services.prisma.taskDependency.deleteMany();
    await services.prisma.taskTag.deleteMany();
    await services.prisma.tag.deleteMany();
    await services.prisma.task.deleteMany();
  });

  afterEach(async () => {
    await services.prisma.$disconnect();
  });

  // --- 适配器注册 ---

  it('should register an adapter', () => {
    const mockAdapter: IntegrationAdapter = {
      type: 'mock',
      name: 'Mock Integration',
      pullTasks: vi.fn(),
      pushTask: vi.fn(),
      handleWebhook: vi.fn(),
      testConnection: vi.fn(),
    };

    services.integrationService.registerAdapter(mockAdapter);

    const types = services.integrationService.getAdapterTypes();
    expect(types).toHaveLength(1);
    expect(types[0].type).toBe('mock');
    expect(types[0].name).toBe('Mock Integration');
  });

  it('should register multiple adapters', () => {
    const a1: IntegrationAdapter = { type: 'a', name: 'A', pullTasks: vi.fn(), pushTask: vi.fn(), handleWebhook: vi.fn(), testConnection: vi.fn() };
    const a2: IntegrationAdapter = { type: 'b', name: 'B', pullTasks: vi.fn(), pushTask: vi.fn(), handleWebhook: vi.fn(), testConnection: vi.fn() };
    const a3: IntegrationAdapter = { type: 'c', name: 'C', pullTasks: vi.fn(), pushTask: vi.fn(), handleWebhook: vi.fn(), testConnection: vi.fn() };

    services.integrationService.registerAdapter(a1);
    services.integrationService.registerAdapter(a2);
    services.integrationService.registerAdapter(a3);

    expect(services.integrationService.getAdapterTypes()).toHaveLength(3);
  });

  it('should get adapter by type', () => {
    const mockAdapter: IntegrationAdapter = {
      type: 'mock',
      name: 'Mock',
      pullTasks: vi.fn(),
      pushTask: vi.fn(),
      handleWebhook: vi.fn(),
      testConnection: vi.fn(),
    };
    services.integrationService.registerAdapter(mockAdapter);

    const found = services.integrationService.getAdapter('mock');
    expect(found).toBe(mockAdapter);
  });

  it('should return undefined for non-existent adapter', () => {
    const found = services.integrationService.getAdapter('non-existent');
    expect(found).toBeUndefined();
  });

  // --- CRUD ---

  it('should create an integration', async () => {
    const mockAdapter: IntegrationAdapter = {
      type: 'mock',
      name: 'Mock',
      pullTasks: vi.fn(),
      pushTask: vi.fn(),
      handleWebhook: vi.fn(),
      testConnection: vi.fn(),
    };
    services.integrationService.registerAdapter(mockAdapter);

    const integration = await services.integrationService.createIntegration({
      type: 'mock',
      name: 'My Integration',
      description: 'Test integration',
      config: { key: 'value' },
    });

    expect(integration.id).toBeDefined();
    expect(integration.type).toBe('mock');
    expect(integration.name).toBe('My Integration');
    expect(integration.description).toBe('Test integration');
    expect(integration.config).toEqual({ key: 'value' });
    expect(integration.isActive).toBe(true);
  });

  it('should reject unknown integration type', async () => {
    await expect(
      services.integrationService.createIntegration({
        type: 'unknown',
        name: 'Test',
        config: {},
      }),
    ).rejects.toThrow('Unknown integration type');
  });

  it('should list integrations', async () => {
    const mockAdapter: IntegrationAdapter = {
      type: 'mock',
      name: 'Mock',
      pullTasks: vi.fn(),
      pushTask: vi.fn(),
      handleWebhook: vi.fn(),
      testConnection: vi.fn(),
    };
    services.integrationService.registerAdapter(mockAdapter);

    await services.integrationService.createIntegration({ type: 'mock', name: 'I1', config: {} });
    await services.integrationService.createIntegration({ type: 'mock', name: 'I2', config: {} });

    const all = await services.integrationService.listIntegrations();
    expect(all.length).toBe(2);
  });

  it('should list integrations with type filter', async () => {
    const a1: IntegrationAdapter = { type: 'a', name: 'A', pullTasks: vi.fn(), pushTask: vi.fn(), handleWebhook: vi.fn(), testConnection: vi.fn() };
    const a2: IntegrationAdapter = { type: 'b', name: 'B', pullTasks: vi.fn(), pushTask: vi.fn(), handleWebhook: vi.fn(), testConnection: vi.fn() };
    services.integrationService.registerAdapter(a1);
    services.integrationService.registerAdapter(a2);

    await services.integrationService.createIntegration({ type: 'a', name: 'I1', config: {} });
    await services.integrationService.createIntegration({ type: 'b', name: 'I2', config: {} });

    const filtered = await services.integrationService.listIntegrations({ type: 'a' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].type).toBe('a');
  });

  it('should get integration by ID', async () => {
    const mockAdapter: IntegrationAdapter = {
      type: 'mock',
      name: 'Mock',
      pullTasks: vi.fn(),
      pushTask: vi.fn(),
      handleWebhook: vi.fn(),
      testConnection: vi.fn(),
    };
    services.integrationService.registerAdapter(mockAdapter);

    const created = await services.integrationService.createIntegration({ type: 'mock', name: 'Test', config: {} });
    const found = await services.integrationService.getIntegration(created.id);

    expect(found).not.toBeNull();
    expect(found!.name).toBe('Test');
  });

  it('should return null for non-existent integration', async () => {
    const found = await services.integrationService.getIntegration('non-existent');
    expect(found).toBeNull();
  });

  it('should update an integration', async () => {
    const mockAdapter: IntegrationAdapter = {
      type: 'mock',
      name: 'Mock',
      pullTasks: vi.fn(),
      pushTask: vi.fn(),
      handleWebhook: vi.fn(),
      testConnection: vi.fn(),
    };
    services.integrationService.registerAdapter(mockAdapter);

    const created = await services.integrationService.createIntegration({ type: 'mock', name: 'Old', config: {} });
    const updated = await services.integrationService.updateIntegration(created.id, {
      name: 'New',
      description: 'Updated',
      isActive: false,
    });

    expect(updated).not.toBeNull();
    expect(updated!.name).toBe('New');
    expect(updated!.description).toBe('Updated');
    expect(updated!.isActive).toBe(false);
  });

  it('should delete an integration', async () => {
    const mockAdapter: IntegrationAdapter = {
      type: 'mock',
      name: 'Mock',
      pullTasks: vi.fn(),
      pushTask: vi.fn(),
      handleWebhook: vi.fn(),
      testConnection: vi.fn(),
    };
    services.integrationService.registerAdapter(mockAdapter);

    const created = await services.integrationService.createIntegration({ type: 'mock', name: 'To Delete', config: {} });
    await services.integrationService.deleteIntegration(created.id);

    const all = await services.integrationService.listIntegrations();
    expect(all).toHaveLength(0);
  });

  // --- 连接测试 ---

  it('should test connection', async () => {
    const mockAdapter: IntegrationAdapter = {
      type: 'mock',
      name: 'Mock',
      pullTasks: vi.fn(),
      pushTask: vi.fn(),
      handleWebhook: vi.fn(),
      testConnection: vi.fn().mockResolvedValue({ success: true }),
    };
    services.integrationService.registerAdapter(mockAdapter);

    const created = await services.integrationService.createIntegration({ type: 'mock', name: 'Test', config: { key: 'val' } });
    const result = await services.integrationService.testConnection(created.id);

    expect(result.success).toBe(true);
    expect(mockAdapter.testConnection).toHaveBeenCalledWith({ key: 'val' });
  });

  it('should throw when testing connection for non-existent integration', async () => {
    await expect(services.integrationService.testConnection('non-existent')).rejects.toThrow('not found');
  });

  // --- Webhook ---

  it('should handle webhook for known type', async () => {
    const mockAdapter: IntegrationAdapter = {
      type: 'mock',
      name: 'Mock',
      pullTasks: vi.fn(),
      pushTask: vi.fn(),
      handleWebhook: vi.fn(),
      testConnection: vi.fn(),
    };
    services.integrationService.registerAdapter(mockAdapter);

    await services.integrationService.handleWebhook('mock', { data: 'test' }, { 'x-header': 'value' });

    expect(mockAdapter.handleWebhook).toHaveBeenCalledWith({ data: 'test' }, { 'x-header': 'value' });
  });

  it('should not throw when handling webhook for unknown type', async () => {
    await expect(
      services.integrationService.handleWebhook('unknown', {}),
    ).resolves.not.toThrow();
  });

  // --- 事件 ---

  it('should emit integration.created event', async () => {
    const mockAdapter: IntegrationAdapter = {
      type: 'mock',
      name: 'Mock',
      pullTasks: vi.fn(),
      pushTask: vi.fn(),
      handleWebhook: vi.fn(),
      testConnection: vi.fn(),
    };
    services.integrationService.registerAdapter(mockAdapter);

    const eventSpy = vi.fn();
    services.eventBus.on('integration.created', eventSpy);

    await services.integrationService.createIntegration({ type: 'mock', name: 'Test', config: {} });

    expect(eventSpy).toHaveBeenCalled();
    expect(eventSpy.mock.calls[0][0].type).toBe('integration.created');
  });
});
