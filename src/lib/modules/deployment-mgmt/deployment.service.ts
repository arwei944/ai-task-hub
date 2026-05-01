// ============================================================
// AI Task Hub - Deployment Management Service
// ============================================================

import { getPrisma } from '@/lib/db';
import type { ILogger, IEventBus, DomainEvent } from '@/lib/core/types';
import type {
  CreateEnvironmentInput,
  UpdateEnvironmentInput,
  CreateDeploymentInput,
  UpdateDeploymentStatusInput,
  RollbackDeploymentInput,
  CreateHealthCheckInput,
  EnvironmentResult,
  DeploymentResult,
  DeploymentLogResult,
  HealthCheckResult,
  DeploymentSummary,
  EnvironmentHealthSummary,
  DeploymentValidation,
  RollbackValidation,
  DeploymentStatus,
  HealthStatus,
} from './types';

export class DeploymentService {
  constructor(
    private logger: ILogger,
    private eventBus?: IEventBus,
    private prismaFn: () => ReturnType<typeof getPrisma> = getPrisma,
  ) {}

  // ==================== Environment Management ====================

  async createEnvironment(input: CreateEnvironmentInput): Promise<EnvironmentResult> {
    const prisma = this.prismaFn();
    try {
      const env = await prisma.deploymentEnvironment.create({
        data: {
          name: input.name,
          displayName: input.displayName,
          description: input.description ?? null,
          baseUrl: input.baseUrl,
          config: JSON.stringify(input.config),
          order: input.order,
        },
      });

      this.emitEvent('deployment.environment.created', {
        environmentId: env.id,
        name: env.name,
      });

      this.logger.info(`Environment created: ${env.name} (${env.id})`);
      return this.mapEnvironment(env);
    } finally {
      await prisma.$disconnect();
    }
  }

  async listEnvironments(): Promise<EnvironmentResult[]> {
    const prisma = this.prismaFn();
    try {
      const environments = await prisma.deploymentEnvironment.findMany({
        orderBy: { order: 'asc' },
      });
      return environments.map((e) => this.mapEnvironment(e));
    } finally {
      await prisma.$disconnect();
    }
  }

  async getEnvironment(id: string): Promise<EnvironmentResult | null> {
    const prisma = this.prismaFn();
    try {
      const env = await prisma.deploymentEnvironment.findUnique({ where: { id } });
      return env ? this.mapEnvironment(env) : null;
    } finally {
      await prisma.$disconnect();
    }
  }

  async updateEnvironment(input: UpdateEnvironmentInput): Promise<EnvironmentResult | null> {
    const prisma = this.prismaFn();
    try {
      const data: Record<string, unknown> = {};
      if (input.displayName !== undefined) data.displayName = input.displayName;
      if (input.description !== undefined) data.description = input.description;
      if (input.baseUrl !== undefined) data.baseUrl = input.baseUrl;
      if (input.config !== undefined) data.config = JSON.stringify(input.config);
      if (input.isActive !== undefined) data.isActive = input.isActive;

      const env = await prisma.deploymentEnvironment.update({
        where: { id: input.id },
        data,
      });

      this.emitEvent('deployment.environment.updated', {
        environmentId: env.id,
        name: env.name,
      });

      return this.mapEnvironment(env);
    } catch (error: any) {
      if (error.code === 'P2025') return null;
      throw error;
    } finally {
      await prisma.$disconnect();
    }
  }

  async deleteEnvironment(id: string): Promise<boolean> {
    const prisma = this.prismaFn();
    try {
      // Delete associated deployments first (cascade)
      await prisma.deployment.deleteMany({ where: { environmentId: id } });
      // Delete associated health checks
      await prisma.healthCheck.deleteMany({ where: { environmentId: id } });
      // Delete the environment
      await prisma.deploymentEnvironment.delete({ where: { id } });
      this.emitEvent('deployment.environment.deleted', { environmentId: id });
      return true;
    } catch (error: any) {
      if (error.code === 'P2025') return false;
      throw error;
    } finally {
      await prisma.$disconnect();
    }
  }

  // ==================== Deployment Pipeline ====================

  async validateDeployment(input: CreateDeploymentInput): Promise<DeploymentValidation> {
    const prisma = this.prismaFn();
    try {
      const checks: DeploymentValidation['checks'] = [];

      // Check 1: Environment exists and is active
      const env = await prisma.deploymentEnvironment.findUnique({
        where: { id: input.environmentId },
      });
      const envExists = !!env;
      const envActive = env?.isActive ?? false;
      checks.push({
        name: 'environment_exists',
        passed: envExists,
        message: envExists ? `Environment "${env?.name}" found` : 'Environment not found',
      });
      checks.push({
        name: 'environment_active',
        passed: envActive,
        message: envActive ? 'Environment is active' : 'Environment is not active',
      });

      // Check 2: No active deployment in same environment
      if (envExists) {
        const activeDeployment = await prisma.deployment.findFirst({
          where: {
            environmentId: input.environmentId,
            status: { in: ['queued', 'building', 'deploying', 'verifying'] },
          },
        });
        const noConflict = !activeDeployment;
        checks.push({
          name: 'no_active_deployment',
          passed: noConflict,
          message: noConflict
            ? 'No active deployment in target environment'
            : `Active deployment exists: ${activeDeployment?.id}`,
        });
      }

      // Check 3: Version format
      const validVersion = /^\d+\.\d+\.\d+/.test(input.version);
      checks.push({
        name: 'valid_version',
        passed: validVersion,
        message: validVersion ? `Version "${input.version}" is valid` : 'Version must follow semver format',
      });

      // Check 4: Valid strategy
      const validStrategies = ['rolling', 'blue_green', 'canary', 'recreate'];
      const validStrategy = validStrategies.includes(input.strategy);
      checks.push({
        name: 'valid_strategy',
        passed: validStrategy,
        message: validStrategy ? `Strategy "${input.strategy}" is valid` : `Invalid strategy. Must be one of: ${validStrategies.join(', ')}`,
      });

      const allPassed = checks.every((c) => c.passed);
      return { canDeploy: allPassed, checks };
    } finally {
      await prisma.$disconnect();
    }
  }

  async createDeployment(input: CreateDeploymentInput): Promise<DeploymentResult> {
    const prisma = this.prismaFn();
    try {
      // Validate first
      const validation = await this.validateDeployment(input);
      if (!validation.canDeploy) {
        const failedChecks = validation.checks.filter((c) => !c.passed).map((c) => c.message);
        throw new Error(`Deployment validation failed: ${failedChecks.join('; ')}`);
      }

      const deployment = await prisma.deployment.create({
        data: {
          environmentId: input.environmentId,
          projectId: input.projectId ?? null,
          version: input.version,
          strategy: input.strategy,
          description: input.description ?? null,
          triggeredBy: input.triggeredBy ?? null,
          status: 'pending',
          config: input.config ? JSON.stringify(input.config) : null,
        },
      });

      // Add initial log
      await prisma.deploymentLog.create({
        data: {
          deploymentId: deployment.id,
          level: 'info',
          message: `Deployment created: v${input.version} to environment ${input.environmentId}`,
        },
      });

      this.emitEvent('deployment.created', {
        deploymentId: deployment.id,
        environmentId: input.environmentId,
        version: input.version,
        strategy: input.strategy,
      });

      this.logger.info(`Deployment created: ${deployment.id} (v${input.version})`);
      return await this.getDeployment(deployment.id) as DeploymentResult;
    } finally {
      await prisma.$disconnect();
    }
  }

  async updateDeploymentStatus(input: UpdateDeploymentStatusInput): Promise<DeploymentResult | null> {
    const prisma = this.prismaFn();
    try {
      const deployment = await prisma.deployment.findUnique({
        where: { id: input.deploymentId },
      });
      if (!deployment) return null;

      const previousStatus = deployment.status;
      const now = new Date();

      const data: Record<string, unknown> = { status: input.status };
      if (['building', 'deploying', 'verifying'].includes(input.status) && !deployment.startedAt) {
        data.startedAt = now;
      }
      if (['running', 'failed', 'rolled_back', 'cancelled'].includes(input.status)) {
        data.completedAt = now;
        if (deployment.startedAt) {
          data.duration = now.getTime() - deployment.startedAt.getTime();
        }
      }

      const updated = await prisma.deployment.update({
        where: { id: input.deploymentId },
        data,
      });

      // Add status change log
      await prisma.deploymentLog.create({
        data: {
          deploymentId: input.deploymentId,
          level: input.status === 'failed' ? 'error' : 'info',
          message: input.message || `Status changed: ${previousStatus} → ${input.status}`,
          metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        },
      });

      // Update environment's lastDeploymentAt when deployment succeeds
      if (input.status === 'running') {
        await prisma.deploymentEnvironment.update({
          where: { id: deployment.environmentId },
          data: { lastDeploymentAt: now },
        });
      }

      this.emitEvent('deployment.status.changed', {
        deploymentId: input.deploymentId,
        previousStatus,
        newStatus: input.status,
        version: deployment.version,
      });

      return await this.getDeployment(input.deploymentId);
    } finally {
      await prisma.$disconnect();
    }
  }

  async getDeployment(id: string): Promise<DeploymentResult | null> {
    const prisma = this.prismaFn();
    try {
      const deployment = await prisma.deployment.findUnique({
        where: { id },
        include: {
          environment: true,
          logs: { orderBy: { timestamp: 'asc' } },
        },
      });
      if (!deployment) return null;

      return {
        id: deployment.id,
        environmentId: deployment.environmentId,
        environmentName: deployment.environment.name,
        projectId: deployment.projectId,
        version: deployment.version,
        strategy: deployment.strategy as any,
        status: deployment.status as DeploymentStatus,
        description: deployment.description,
        triggeredBy: deployment.triggeredBy,
        startedAt: deployment.startedAt,
        completedAt: deployment.completedAt,
        duration: deployment.duration,
        rollbackFromId: deployment.rollbackFromId,
        logs: deployment.logs.map((l) => ({
          id: l.id,
          deploymentId: l.deploymentId,
          level: l.level as any,
          message: l.message,
          metadata: l.metadata ? JSON.parse(l.metadata) : null,
          timestamp: l.timestamp,
        })),
        createdAt: deployment.createdAt,
      };
    } finally {
      await prisma.$disconnect();
    }
  }

  async listDeployments(filters?: {
    environmentId?: string;
    projectId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ deployments: DeploymentResult[]; total: number }> {
    const prisma = this.prismaFn();
    try {
      const where: Record<string, unknown> = {};
      if (filters?.environmentId) where.environmentId = filters.environmentId;
      if (filters?.projectId) where.projectId = filters.projectId;
      if (filters?.status) where.status = filters.status;

      const total = await prisma.deployment.count({ where });
      const deployments = await prisma.deployment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters?.limit ?? 20,
        skip: filters?.offset ?? 0,
        include: { environment: true, logs: { orderBy: { timestamp: 'asc' } } },
      });

      return {
        total,
        deployments: deployments.map((d) => ({
          id: d.id,
          environmentId: d.environmentId,
          environmentName: d.environment.name,
          projectId: d.projectId,
          version: d.version,
          strategy: d.strategy as any,
          status: d.status as DeploymentStatus,
          description: d.description,
          triggeredBy: d.triggeredBy,
          startedAt: d.startedAt,
          completedAt: d.completedAt,
          duration: d.duration,
          rollbackFromId: d.rollbackFromId,
          logs: d.logs.map((l) => ({
            id: l.id,
            deploymentId: l.deploymentId,
            level: l.level as any,
            message: l.message,
            metadata: l.metadata ? JSON.parse(l.metadata) : null,
            timestamp: l.timestamp,
          })),
          createdAt: d.createdAt,
        })),
      };
    } finally {
      await prisma.$disconnect();
    }
  }

  async getDeploymentSummary(): Promise<DeploymentSummary> {
    const prisma = this.prismaFn();
    try {
      const deployments = await prisma.deployment.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { environment: true },
      });

      const allDeployments = await prisma.deployment.findMany();
      const byStatus: Record<string, number> = {};
      const byEnvironment: Record<string, number> = {};

      for (const d of allDeployments) {
        byStatus[d.status] = (byStatus[d.status] || 0) + 1;
        byEnvironment[d.environmentId] = (byEnvironment[d.environmentId] || 0) + 1;
      }

      return {
        total: allDeployments.length,
        byStatus,
        byEnvironment,
        recentDeployments: deployments.map((d) => ({
          id: d.id,
          environmentId: d.environmentId,
          environmentName: d.environment.name,
          projectId: d.projectId,
          version: d.version,
          strategy: d.strategy as any,
          status: d.status as DeploymentStatus,
          description: d.description,
          triggeredBy: d.triggeredBy,
          startedAt: d.startedAt,
          completedAt: d.completedAt,
          duration: d.duration,
          rollbackFromId: d.rollbackFromId,
          logs: [],
          createdAt: d.createdAt,
        })),
      };
    } finally {
      await prisma.$disconnect();
    }
  }

  // ==================== Rollback ====================

  async validateRollback(deploymentId: string): Promise<RollbackValidation> {
    const prisma = this.prismaFn();
    try {
      const current = await prisma.deployment.findUnique({
        where: { id: deploymentId },
        include: { environment: true },
      });

      if (!current) {
        return { canRollback: false, reason: 'Deployment not found', previousDeployment: null };
      }

      if (!['running', 'failed'].includes(current.status)) {
        return {
          canRollback: false,
          reason: `Cannot rollback from status "${current.status}". Only "running" or "failed" deployments can be rolled back.`,
          previousDeployment: null,
        };
      }

      // Find previous successful deployment in the same environment
      const previous = await prisma.deployment.findFirst({
        where: {
          environmentId: current.environmentId,
          status: 'running',
          createdAt: { lt: current.createdAt },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!previous) {
        return {
          canRollback: false,
          reason: 'No previous successful deployment found to rollback to',
          previousDeployment: null,
        };
      }

      return {
        canRollback: true,
        reason: `Can rollback to v${previous.version} (deployed at ${previous.createdAt?.toISOString()})`,
        previousDeployment: {
          id: previous.id,
          environmentId: previous.environmentId,
          environmentName: current.environment.name,
          projectId: previous.projectId,
          version: previous.version,
          strategy: previous.strategy as any,
          status: previous.status as DeploymentStatus,
          description: previous.description,
          triggeredBy: previous.triggeredBy,
          startedAt: previous.startedAt,
          completedAt: previous.completedAt,
          duration: previous.duration,
          rollbackFromId: previous.rollbackFromId,
          logs: [],
          createdAt: previous.createdAt,
        },
      };
    } finally {
      await prisma.$disconnect();
    }
  }

  async rollbackDeployment(input: RollbackDeploymentInput): Promise<DeploymentResult> {
    const prisma = this.prismaFn();
    try {
      const validation = await this.validateRollback(input.deploymentId);
      if (!validation.canRollback || !validation.previousDeployment) {
        throw new Error(`Rollback validation failed: ${validation.reason}`);
      }

      // Mark current deployment as rolled_back
      await prisma.deployment.update({
        where: { id: input.deploymentId },
        data: { status: 'rolled_back' },
      });

      await prisma.deploymentLog.create({
        data: {
          deploymentId: input.deploymentId,
          level: 'warn',
          message: `Deployment rolled back by ${input.triggeredBy || 'system'}. Reason: ${input.reason || 'Manual rollback'}`,
        },
      });

      // Create new deployment for rollback version
      const rollbackDeployment = await prisma.deployment.create({
        data: {
          environmentId: validation.previousDeployment.environmentId,
          projectId: validation.previousDeployment.projectId,
          version: validation.previousDeployment.version,
          strategy: 'recreate',
          description: `Rollback from v${(await prisma.deployment.findUnique({ where: { id: input.deploymentId } }))?.version} to v${validation.previousDeployment.version}. Reason: ${input.reason || 'Manual rollback'}`,
          triggeredBy: input.triggeredBy ?? null,
          status: 'pending',
          rollbackFromId: input.deploymentId,
        },
      });

      await prisma.deploymentLog.create({
        data: {
          deploymentId: rollbackDeployment.id,
          level: 'info',
          message: `Rollback deployment created: v${validation.previousDeployment.version}`,
        },
      });

      this.emitEvent('deployment.rolled_back', {
        originalDeploymentId: input.deploymentId,
        rollbackDeploymentId: rollbackDeployment.id,
        rollbackVersion: validation.previousDeployment.version,
        reason: input.reason,
      });

      this.logger.info(`Rollback created: ${rollbackDeployment.id}`);
      return await this.getDeployment(rollbackDeployment.id) as DeploymentResult;
    } finally {
      await prisma.$disconnect();
    }
  }

  // ==================== Health Checks ====================

  async createHealthCheck(input: CreateHealthCheckInput): Promise<HealthCheckResult> {
    const prisma = this.prismaFn();
    try {
      const check = await prisma.healthCheck.create({
        data: {
          environmentId: input.environmentId,
          name: input.name,
          type: input.type,
          config: JSON.stringify(input.config),
          isActive: input.isActive ?? true,
        },
      });

      this.emitEvent('deployment.health_check.created', {
        healthCheckId: check.id,
        environmentId: input.environmentId,
        name: input.name,
      });

      return this.mapHealthCheck(check);
    } finally {
      await prisma.$disconnect();
    }
  }

  async listHealthChecks(environmentId?: string): Promise<HealthCheckResult[]> {
    const prisma = this.prismaFn();
    try {
      const where: Record<string, unknown> = {};
      if (environmentId) where.environmentId = environmentId;

      const checks = await prisma.healthCheck.findMany({
        where,
        orderBy: { createdAt: 'asc' },
      });
      return checks.map((c) => this.mapHealthCheck(c));
    } finally {
      await prisma.$disconnect();
    }
  }

  async updateHealthCheckStatus(
    healthCheckId: string,
    status: HealthStatus,
    metadata?: Record<string, unknown>,
  ): Promise<HealthCheckResult | null> {
    const prisma = this.prismaFn();
    try {
      const check = await prisma.healthCheck.findUnique({ where: { id: healthCheckId } });
      if (!check) return null;

      const consecutiveFailures =
        status === 'unhealthy'
          ? (check.consecutiveFailures ?? 0) + 1
          : status === 'healthy'
            ? 0
            : check.consecutiveFailures ?? 0;

      const updated = await prisma.healthCheck.update({
        where: { id: healthCheckId },
        data: {
          lastStatus: status,
          lastCheckAt: new Date(),
          consecutiveFailures,
        },
      });

      // Update environment health status based on all checks
      const allChecks = await prisma.healthCheck.findMany({
        where: { environmentId: check.environmentId, isActive: true },
      });
      const hasUnhealthy = allChecks.some((c) => c.lastStatus === 'unhealthy');
      const allHealthy = allChecks.every((c) => c.lastStatus === 'healthy' || c.lastStatus === 'unknown');
      const envHealthStatus: HealthStatus = hasUnhealthy ? 'unhealthy' : allHealthy ? 'healthy' : 'degraded';

      await prisma.deploymentEnvironment.update({
        where: { id: check.environmentId },
        data: { healthStatus: envHealthStatus },
      });

      this.emitEvent('deployment.health_check.updated', {
        healthCheckId,
        environmentId: check.environmentId,
        status,
        consecutiveFailures,
      });

      return this.mapHealthCheck(updated);
    } finally {
      await prisma.$disconnect();
    }
  }

  async deleteHealthCheck(id: string): Promise<boolean> {
    const prisma = this.prismaFn();
    try {
      await prisma.healthCheck.delete({ where: { id } });
      return true;
    } catch (error: any) {
      if (error.code === 'P2025') return false;
      throw error;
    } finally {
      await prisma.$disconnect();
    }
  }

  async getEnvironmentHealthSummary(): Promise<EnvironmentHealthSummary[]> {
    const prisma = this.prismaFn();
    try {
      const environments = await prisma.deploymentEnvironment.findMany({
        orderBy: { order: 'asc' },
        include: {
          healthChecks: { where: { isActive: true } },
          deployments: {
            where: { status: 'running' },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      return environments.map((env) => {
        const lastDeploy = env.deployments[0];
        let uptime: number | null = null;
        if (lastDeploy?.completedAt) {
          uptime = Math.floor((Date.now() - lastDeploy.completedAt.getTime()) / 1000);
        }

        return {
          environmentId: env.id,
          environmentName: env.displayName || env.name,
          healthStatus: env.healthStatus as HealthStatus,
          checks: env.healthChecks.map((c) => ({
            name: c.name,
            status: c.lastStatus as HealthStatus,
            lastCheckAt: c.lastCheckAt,
          })),
          lastDeploymentAt: env.lastDeploymentAt,
          uptime,
        };
      });
    } finally {
      await prisma.$disconnect();
    }
  }

  // ==================== Deployment Logs ====================

  async addDeploymentLog(
    deploymentId: string,
    level: 'info' | 'warn' | 'error' | 'debug',
    message: string,
    metadata?: Record<string, unknown>,
  ): Promise<DeploymentLogResult | null> {
    const prisma = this.prismaFn();
    try {
      // Verify deployment exists
      const deployment = await prisma.deployment.findUnique({ where: { id: deploymentId } });
      if (!deployment) return null;

      const log = await prisma.deploymentLog.create({
        data: {
          deploymentId,
          level,
          message,
          metadata: metadata ? JSON.stringify(metadata) : null,
        },
      });

      return {
        id: log.id,
        deploymentId: log.deploymentId,
        level: log.level as any,
        message: log.message,
        metadata: log.metadata ? JSON.parse(log.metadata) : null,
        timestamp: log.timestamp,
      };
    } finally {
      await prisma.$disconnect();
    }
  }

  async getDeploymentLogs(deploymentId: string): Promise<DeploymentLogResult[]> {
    const prisma = this.prismaFn();
    try {
      const logs = await prisma.deploymentLog.findMany({
        where: { deploymentId },
        orderBy: { timestamp: 'asc' },
      });
      return logs.map((l) => ({
        id: l.id,
        deploymentId: l.deploymentId,
        level: l.level as any,
        message: l.message,
        metadata: l.metadata ? JSON.parse(l.metadata) : null,
        timestamp: l.timestamp,
      }));
    } finally {
      await prisma.$disconnect();
    }
  }

  // ==================== Helpers ====================

  private mapEnvironment(env: any): EnvironmentResult {
    return {
      id: env.id,
      name: env.name,
      displayName: env.displayName,
      description: env.description,
      baseUrl: env.baseUrl,
      config: typeof env.config === 'string' ? JSON.parse(env.config) : (env.config || {}),
      isActive: env.isActive,
      lastDeploymentAt: env.lastDeploymentAt,
      healthStatus: env.healthStatus as HealthStatus,
      order: env.order,
      createdAt: env.createdAt,
      updatedAt: env.updatedAt,
    };
  }

  private mapHealthCheck(check: any): HealthCheckResult {
    return {
      id: check.id,
      environmentId: check.environmentId,
      name: check.name,
      type: check.type,
      config: typeof check.config === 'string' ? JSON.parse(check.config) : (check.config || {}),
      isActive: check.isActive,
      lastCheckAt: check.lastCheckAt,
      lastStatus: check.lastStatus as HealthStatus,
      consecutiveFailures: check.consecutiveFailures,
      createdAt: check.createdAt,
    };
  }

  private emitEvent(type: string, payload: unknown): void {
    if (!this.eventBus) return;
    const event: DomainEvent = { type, payload, timestamp: new Date(), source: 'deployment-mgmt' };
    this.eventBus.emit(event);
  }
}
