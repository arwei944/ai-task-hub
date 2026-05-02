import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeploymentService } from '@/lib/modules/deployment-mgmt/deployment.service';
import type { ILogger, IEventBus, DomainEvent } from '@/lib/core/types';

// Mock Prisma
const mockPrisma = {
  deploymentEnvironment: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  deployment: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
  },
  deploymentLog: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  healthCheck: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  $disconnect: vi.fn(),
};

const mockLogger: ILogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(() => mockLogger),
} as any;

const mockEventBus: IEventBus = {
  emit: vi.fn(),
  emitAsync: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  once: vi.fn(),
  removeAllListeners: vi.fn(),
} as any;

function createService() {
  return new DeploymentService(mockLogger, mockEventBus, () => mockPrisma as any);
}

describe('DeploymentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createEnvironment', () => {
    it('should create an environment and emit event', async () => {
      const mockEnv = {
        id: 'env-1',
        name: 'dev',
        displayName: 'Development',
        description: null,
        baseUrl: 'http://localhost:3000',
        config: '{"NODE_ENV":"dev"}',
        isActive: true,
        healthStatus: 'unknown',
        lastDeploymentAt: null,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.deploymentEnvironment.create.mockResolvedValue(mockEnv);

      const service = createService();
      const result = await service.createEnvironment({
        name: 'dev',
        displayName: 'Development',
        baseUrl: 'http://localhost:3000',
        config: { NODE_ENV: 'dev' },
        order: 0,
      });

      expect(result.name).toBe('dev');
      expect(result.displayName).toBe('Development');
      expect(result.config).toEqual({ NODE_ENV: 'dev' });
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'deployment.environment.created' }),
      );
      expect(mockPrisma.$disconnect).toHaveBeenCalled();
    });
  });

  describe('listEnvironments', () => {
    it('should return environments ordered by order field', async () => {
      mockPrisma.deploymentEnvironment.findMany.mockResolvedValue([
        { id: 'env-1', name: 'dev', displayName: 'Dev', config: '{}', healthStatus: 'unknown', order: 0 },
        { id: 'env-2', name: 'prod', displayName: 'Prod', config: '{}', healthStatus: 'healthy', order: 1 },
      ]);

      const service = createService();
      const result = await service.listEnvironments();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('dev');
      expect(mockPrisma.deploymentEnvironment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { order: 'asc' } }),
      );
    });
  });

  describe('validateDeployment', () => {
    it('should pass all checks when environment is valid', async () => {
      mockPrisma.deploymentEnvironment.findUnique.mockResolvedValue({
        id: 'env-1',
        name: 'dev',
        isActive: true,
      });
      mockPrisma.deployment.findFirst.mockResolvedValue(null);

      const service = createService();
      const result = await service.validateDeployment({
        environmentId: 'env-1',
        version: '2.1.0',
        strategy: 'rolling',
      });

      expect(result.canDeploy).toBe(true);
      expect(result.checks).toHaveLength(5);
      expect(result.checks.every((c) => c.passed)).toBe(true);
    });

    it('should fail when environment does not exist', async () => {
      mockPrisma.deploymentEnvironment.findUnique.mockResolvedValue(null);

      const service = createService();
      const result = await service.validateDeployment({
        environmentId: 'nonexistent',
        version: '2.1.0',
        strategy: 'rolling',
      });

      expect(result.canDeploy).toBe(false);
      expect(result.checks.find((c) => c.name === 'environment_exists')?.passed).toBe(false);
    });

    it('should fail when environment is inactive', async () => {
      mockPrisma.deploymentEnvironment.findUnique.mockResolvedValue({
        id: 'env-1',
        name: 'dev',
        isActive: false,
      });

      const service = createService();
      const result = await service.validateDeployment({
        environmentId: 'env-1',
        version: '2.1.0',
        strategy: 'rolling',
      });

      expect(result.canDeploy).toBe(false);
      expect(result.checks.find((c) => c.name === 'environment_active')?.passed).toBe(false);
    });

    it('should fail when active deployment exists', async () => {
      mockPrisma.deploymentEnvironment.findUnique.mockResolvedValue({
        id: 'env-1',
        name: 'dev',
        isActive: true,
      });
      mockPrisma.deployment.findFirst.mockResolvedValue({ id: 'deploy-1', status: 'deploying' });

      const service = createService();
      const result = await service.validateDeployment({
        environmentId: 'env-1',
        version: '2.1.0',
        strategy: 'rolling',
      });

      expect(result.canDeploy).toBe(false);
      expect(result.checks.find((c) => c.name === 'no_active_deployment')?.passed).toBe(false);
    });

    it('should fail with invalid version format', async () => {
      mockPrisma.deploymentEnvironment.findUnique.mockResolvedValue({
        id: 'env-1',
        name: 'dev',
        isActive: true,
      });
      mockPrisma.deployment.findFirst.mockResolvedValue(null);

      const service = createService();
      const result = await service.validateDeployment({
        environmentId: 'env-1',
        version: 'not-a-version',
        strategy: 'rolling',
      });

      expect(result.canDeploy).toBe(false);
      expect(result.checks.find((c) => c.name === 'valid_version')?.passed).toBe(false);
    });

    it('should fail with invalid strategy', async () => {
      mockPrisma.deploymentEnvironment.findUnique.mockResolvedValue({
        id: 'env-1',
        name: 'dev',
        isActive: true,
      });
      mockPrisma.deployment.findFirst.mockResolvedValue(null);

      const service = createService();
      const result = await service.validateDeployment({
        environmentId: 'env-1',
        version: '2.1.0',
        strategy: 'invalid_strategy' as any,
      });

      expect(result.canDeploy).toBe(false);
      expect(result.checks.find((c) => c.name === 'valid_strategy')?.passed).toBe(false);
    });
  });

  describe('createDeployment', () => {
    it('should create deployment when validation passes', async () => {
      // Setup validation mocks
      mockPrisma.deploymentEnvironment.findUnique.mockResolvedValue({
        id: 'env-1',
        name: 'dev',
        isActive: true,
      });
      mockPrisma.deployment.findFirst.mockResolvedValue(null);

      // Setup creation mocks
      const mockDeployment = {
        id: 'deploy-1',
        environmentId: 'env-1',
        projectId: null,
        version: '2.1.0',
        strategy: 'rolling',
        status: 'pending',
        description: null,
        triggeredBy: null,
        config: null,
        startedAt: null,
        completedAt: null,
        duration: null,
        rollbackFromId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.deployment.create.mockResolvedValue(mockDeployment);
      mockPrisma.deploymentLog.create.mockResolvedValue({});

      // Setup getDeployment mock
      mockPrisma.deployment.findUnique.mockResolvedValue({
        ...mockDeployment,
        environment: { name: 'dev' },
        logs: [],
      });

      const service = createService();
      const result = await service.createDeployment({
        environmentId: 'env-1',
        version: '2.1.0',
        strategy: 'rolling',
      });

      expect(result).toBeDefined();
      expect(result!.version).toBe('2.1.0');
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'deployment.created' }),
      );
    });

    it('should throw when validation fails', async () => {
      mockPrisma.deploymentEnvironment.findUnique.mockResolvedValue(null);

      const service = createService();
      await expect(
        service.createDeployment({
          environmentId: 'nonexistent',
          version: '2.1.0',
          strategy: 'rolling',
        }),
      ).rejects.toThrow('Deployment validation failed');
    });
  });

  describe('updateDeploymentStatus', () => {
    it('should update status and add log', async () => {
      const now = new Date();
      mockPrisma.deployment.findUnique.mockResolvedValue({
        id: 'deploy-1',
        environmentId: 'env-1',
        status: 'pending',
        startedAt: null,
        version: '2.1.0',
      });
      mockPrisma.deployment.update.mockResolvedValue({
        id: 'deploy-1',
        status: 'building',
        startedAt: now,
      });
      mockPrisma.deploymentLog.create.mockResolvedValue({});
      mockPrisma.deploymentEnvironment.update.mockResolvedValue({});

      // For getDeployment
      mockPrisma.deployment.findUnique.mockResolvedValue({
        id: 'deploy-1',
        environmentId: 'env-1',
        environment: { name: 'dev' },
        version: '2.1.0',
        strategy: 'rolling',
        status: 'building',
        description: null,
        triggeredBy: null,
        startedAt: now,
        completedAt: null,
        duration: null,
        rollbackFromId: null,
        logs: [],
        createdAt: new Date(),
      });

      const service = createService();
      const result = await service.updateDeploymentStatus({
        deploymentId: 'deploy-1',
        status: 'building',
      });

      expect(result).toBeDefined();
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'deployment.status.changed' }),
      );
    });

    it('should return null when deployment not found', async () => {
      mockPrisma.deployment.findUnique.mockResolvedValue(null);

      const service = createService();
      const result = await service.updateDeploymentStatus({
        deploymentId: 'nonexistent',
        status: 'building',
      });

      expect(result).toBeNull();
    });
  });

  describe('validateRollback', () => {
    it('should validate rollback when conditions are met', async () => {
      const now = new Date();
      mockPrisma.deployment.findUnique.mockResolvedValue({
        id: 'deploy-1',
        environmentId: 'env-1',
        status: 'running',
        createdAt: now,
        environment: { name: 'prod' },
      });
      mockPrisma.deployment.findFirst.mockResolvedValue({
        id: 'deploy-0',
        environmentId: 'env-1',
        status: 'running',
        version: '2.0.0',
        createdAt: new Date(now.getTime() - 86400000),
      });

      const service = createService();
      const result = await service.validateRollback('deploy-1');

      expect(result.canRollback).toBe(true);
      expect(result.previousDeployment).toBeDefined();
      expect(result.previousDeployment!.version).toBe('2.0.0');
    });

    it('should fail when deployment not found', async () => {
      mockPrisma.deployment.findUnique.mockResolvedValue(null);

      const service = createService();
      const result = await service.validateRollback('nonexistent');

      expect(result.canRollback).toBe(false);
      expect(result.reason).toContain('not found');
    });

    it('should fail when status does not allow rollback', async () => {
      mockPrisma.deployment.findUnique.mockResolvedValue({
        id: 'deploy-1',
        environmentId: 'env-1',
        status: 'pending',
        environment: { name: 'prod' },
      });

      const service = createService();
      const result = await service.validateRollback('deploy-1');

      expect(result.canRollback).toBe(false);
    });

    it('should fail when no previous deployment exists', async () => {
      mockPrisma.deployment.findUnique.mockResolvedValue({
        id: 'deploy-1',
        environmentId: 'env-1',
        status: 'running',
        createdAt: new Date(),
        environment: { name: 'prod' },
      });
      mockPrisma.deployment.findFirst.mockResolvedValue(null);

      const service = createService();
      const result = await service.validateRollback('deploy-1');

      expect(result.canRollback).toBe(false);
      expect(result.reason).toContain('No previous');
    });
  });

  describe('health checks', () => {
    it('should create a health check', async () => {
      mockPrisma.healthCheck.create.mockResolvedValue({
        id: 'hc-1',
        environmentId: 'env-1',
        name: 'API Health',
        type: 'http',
        config: '{"url":"http://localhost:3000/api/health"}',
        isActive: true,
        lastStatus: 'unknown',
        lastCheckAt: null,
        consecutiveFailures: 0,
        createdAt: new Date(),
      });

      const service = createService();
      const result = await service.createHealthCheck({
        environmentId: 'env-1',
        name: 'API Health',
        type: 'http',
        config: { url: 'http://localhost:3000/api/health' },
      });

      expect(result.name).toBe('API Health');
      expect(result.type).toBe('http');
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'deployment.health_check.created' }),
      );
    });

    it('should update health check status and environment health', async () => {
      mockPrisma.healthCheck.findUnique.mockResolvedValue({
        id: 'hc-1',
        environmentId: 'env-1',
        consecutiveFailures: 0,
      });
      mockPrisma.healthCheck.update.mockResolvedValue({
        id: 'hc-1',
        environmentId: 'env-1',
        name: 'API Health',
        type: 'http',
        config: '{}',
        isActive: true,
        lastStatus: 'healthy',
        lastCheckAt: new Date(),
        consecutiveFailures: 0,
        createdAt: new Date(),
      });
      mockPrisma.healthCheck.findMany.mockResolvedValue([
        { id: 'hc-1', lastStatus: 'healthy', isActive: true },
      ]);
      mockPrisma.deploymentEnvironment.update.mockResolvedValue({});

      const service = createService();
      const result = await service.updateHealthCheckStatus('hc-1', 'healthy');

      expect(result).toBeDefined();
      expect(result!.lastStatus).toBe('healthy');
      expect(mockPrisma.deploymentEnvironment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'env-1' },
          data: expect.objectContaining({ healthStatus: 'healthy' }),
        }),
      );
    });

    it('should increment consecutive failures on unhealthy', async () => {
      mockPrisma.healthCheck.findUnique.mockResolvedValue({
        id: 'hc-1',
        environmentId: 'env-1',
        consecutiveFailures: 2,
      });
      mockPrisma.healthCheck.update.mockResolvedValue({
        id: 'hc-1',
        environmentId: 'env-1',
        consecutiveFailures: 3,
      });
      mockPrisma.healthCheck.findMany.mockResolvedValue([
        { id: 'hc-1', lastStatus: 'unhealthy', isActive: true },
      ]);
      mockPrisma.deploymentEnvironment.update.mockResolvedValue({});

      const service = createService();
      await service.updateHealthCheckStatus('hc-1', 'unhealthy');

      expect(mockPrisma.healthCheck.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ consecutiveFailures: 3 }),
        }),
      );
    });
  });

  describe('getEnvironmentHealthSummary', () => {
    it('should return health summary for all environments', async () => {
      const now = new Date();
      mockPrisma.deploymentEnvironment.findMany.mockResolvedValue([
        {
          id: 'env-1',
          displayName: 'Development',
          name: 'dev',
          healthStatus: 'healthy',
          lastDeploymentAt: now,
          order: 0,
          healthChecks: [
            { name: 'API', lastStatus: 'healthy', lastCheckAt: now },
          ],
          deployments: [{ completedAt: now }],
        },
        {
          id: 'env-2',
          displayName: 'Production',
          name: 'prod',
          healthStatus: 'degraded',
          lastDeploymentAt: null,
          order: 1,
          healthChecks: [
            { name: 'API', lastStatus: 'healthy', lastCheckAt: now },
            { name: 'DB', lastStatus: 'unhealthy', lastCheckAt: now },
          ],
          deployments: [],
        },
      ]);

      const service = createService();
      const result = await service.getEnvironmentHealthSummary();

      expect(result).toHaveLength(2);
      expect(result[0].healthStatus).toBe('healthy');
      expect(result[0].checks).toHaveLength(1);
      expect(result[1].healthStatus).toBe('degraded');
      expect(result[1].checks).toHaveLength(2);
    });
  });

  describe('addDeploymentLog', () => {
    it('should add a log entry', async () => {
      mockPrisma.deployment.findUnique.mockResolvedValue({ id: 'deploy-1' });
      mockPrisma.deploymentLog.create.mockResolvedValue({
        id: 'log-1',
        deploymentId: 'deploy-1',
        level: 'info',
        message: 'Build started',
        metadata: null,
        timestamp: new Date(),
      });

      const service = createService();
      const result = await service.addDeploymentLog('deploy-1', 'info', 'Build started');

      expect(result).toBeDefined();
      expect(result!.message).toBe('Build started');
    });

    it('should return null when deployment not found', async () => {
      mockPrisma.deployment.findUnique.mockResolvedValue(null);

      const service = createService();
      const result = await service.addDeploymentLog('nonexistent', 'info', 'Build started');

      expect(result).toBeNull();
    });
  });

  describe('getDeploymentSummary', () => {
    it('should return deployment statistics', async () => {
      mockPrisma.deployment.findMany.mockResolvedValueOnce([
        { id: 'd1', environmentId: 'env-1', environment: { name: 'dev' }, status: 'running', createdAt: new Date() },
      ]);
      mockPrisma.deployment.findMany.mockResolvedValueOnce([
        { id: 'd1', environmentId: 'env-1', status: 'running' },
        { id: 'd2', environmentId: 'env-2', status: 'failed' },
        { id: 'd3', environmentId: 'env-1', status: 'running' },
      ]);

      const service = createService();
      const result = await service.getDeploymentSummary();

      expect(result.total).toBe(3);
      expect(result.byStatus.running).toBe(2);
      expect(result.byStatus.failed).toBe(1);
      expect(result.recentDeployments).toHaveLength(1);
    });
  });
});
