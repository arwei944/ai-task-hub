import type { ILogger } from '@/lib/core/types';
import type { DeploymentService } from '@/lib/modules/deployment-mgmt/deployment.service';

export function createDeploymentToolHandlers(service: DeploymentService, logger: ILogger) {
  return {
    // ---- Environment Management ----
    create_environment: async (args: Record<string, unknown>) => {
      const { name, displayName, description, baseUrl, config, order } = args as any;
      const result = await service.createEnvironment({
        name,
        displayName,
        description,
        baseUrl,
        config: config || {},
        order: order ?? 0,
      });
      return { success: true, environment: result };
    },

    list_environments: async () => {
      const environments = await service.listEnvironments();
      return { success: true, environments, count: environments.length };
    },

    get_environment: async (args: Record<string, unknown>) => {
      const { id } = args as any;
      const environment = await service.getEnvironment(id);
      if (!environment) {
        return { success: false, error: 'Environment not found' };
      }
      return { success: true, environment };
    },

    update_environment: async (args: Record<string, unknown>) => {
      const { id, displayName, description, baseUrl, config, isActive } = args as any;
      const result = await service.updateEnvironment({
        id,
        displayName,
        description,
        baseUrl,
        config,
        isActive,
      });
      if (!result) {
        return { success: false, error: 'Environment not found' };
      }
      return { success: true, environment: result };
    },

    delete_environment: async (args: Record<string, unknown>) => {
      const { id } = args as any;
      const deleted = await service.deleteEnvironment(id);
      if (!deleted) {
        return { success: false, error: 'Environment not found' };
      }
      return { success: true, message: 'Environment deleted' };
    },

    // ---- Deployment Pipeline ----
    create_deployment: async (args: Record<string, unknown>) => {
      const { environmentId, projectId, version, strategy, description, triggeredBy, config } = args as any;
      try {
        const result = await service.createDeployment({
          environmentId,
          projectId,
          version,
          strategy,
          description,
          triggeredBy,
          config,
        });
        return { success: true, deployment: result };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },

    update_deployment_status: async (args: Record<string, unknown>) => {
      const { deploymentId, status, message, metadata } = args as any;
      const result = await service.updateDeploymentStatus({
        deploymentId,
        status,
        message,
        metadata,
      });
      if (!result) {
        return { success: false, error: 'Deployment not found' };
      }
      return { success: true, deployment: result };
    },

    get_deployment: async (args: Record<string, unknown>) => {
      const { id } = args as any;
      const deployment = await service.getDeployment(id);
      if (!deployment) {
        return { success: false, error: 'Deployment not found' };
      }
      return { success: true, deployment };
    },

    list_deployments: async (args: Record<string, unknown>) => {
      const { environmentId, projectId, status, limit, offset } = args as any;
      const result = await service.listDeployments({
        environmentId,
        projectId,
        status,
        limit: limit ?? 20,
        offset: offset ?? 0,
      });
      return { success: true, ...result };
    },

    get_deployment_summary: async () => {
      const summary = await service.getDeploymentSummary();
      return { success: true, ...summary };
    },

    validate_deployment: async (args: Record<string, unknown>) => {
      const { environmentId, version, strategy } = args as any;
      const validation = await service.validateDeployment({
        environmentId,
        version,
        strategy,
      });
      return { success: true, ...validation };
    },

    // ---- Rollback ----
    validate_rollback: async (args: Record<string, unknown>) => {
      const { deploymentId } = args as any;
      const validation = await service.validateRollback(deploymentId);
      return { success: true, ...validation };
    },

    rollback_deployment: async (args: Record<string, unknown>) => {
      const { deploymentId, reason, triggeredBy } = args as any;
      try {
        const result = await service.rollbackDeployment({
          deploymentId,
          reason,
          triggeredBy,
        });
        return { success: true, deployment: result };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },

    // ---- Health Checks ----
    create_health_check: async (args: Record<string, unknown>) => {
      const { environmentId, name, type, config, isActive } = args as any;
      const result = await service.createHealthCheck({
        environmentId,
        name,
        type,
        config: config || {},
        isActive,
      });
      return { success: true, healthCheck: result };
    },

    list_health_checks: async (args: Record<string, unknown>) => {
      const { environmentId } = args as any;
      const checks = await service.listHealthChecks(environmentId);
      return { success: true, healthChecks: checks, count: checks.length };
    },

    update_health_check_status: async (args: Record<string, unknown>) => {
      const { healthCheckId, status, metadata } = args as any;
      const result = await service.updateHealthCheckStatus(healthCheckId, status, metadata);
      if (!result) {
        return { success: false, error: 'Health check not found' };
      }
      return { success: true, healthCheck: result };
    },

    delete_health_check: async (args: Record<string, unknown>) => {
      const { id } = args as any;
      const deleted = await service.deleteHealthCheck(id);
      if (!deleted) {
        return { success: false, error: 'Health check not found' };
      }
      return { success: true, message: 'Health check deleted' };
    },

    get_environment_health: async () => {
      const summary = await service.getEnvironmentHealthSummary();
      return { success: true, environments: summary };
    },

    // ---- Deployment Logs ----
    add_deployment_log: async (args: Record<string, unknown>) => {
      const { deploymentId, level, message, metadata } = args as any;
      const result = await service.addDeploymentLog(deploymentId, level, message, metadata);
      if (!result) {
        return { success: false, error: 'Deployment not found' };
      }
      return { success: true, log: result };
    },

    get_deployment_logs: async (args: Record<string, unknown>) => {
      const { deploymentId } = args as any;
      const logs = await service.getDeploymentLogs(deploymentId);
      return { success: true, logs, count: logs.length };
    },
  };
}
