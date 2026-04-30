import type { ILogger } from '@/lib/core/types';
import type { StatisticsService } from '@/lib/modules/dashboard/statistics.service';

export function createDashboardToolHandlers(service: StatisticsService, logger: ILogger) {
  return {
    get_project_health: async () => {
      try {
        const health = await service.getProjectHealth();
        return { success: true, projects: health, count: health.length };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },

    get_task_stats: async () => {
      try {
        const stats = await service.getTaskStats();
        return { success: true, ...stats };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },

    get_daily_trends: async (args: Record<string, unknown>) => {
      const { days } = args as any;
      try {
        const trends = await service.getDailyTrends(days ?? 30);
        return { success: true, trends, count: trends.length };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },

    get_deployment_stats: async () => {
      try {
        const stats = await service.getDeploymentStats();
        return { success: true, ...stats };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },

    get_agent_efficiency: async () => {
      try {
        const stats = await service.getAgentEfficiency();
        return { success: true, ...stats };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },

    get_event_metrics: async () => {
      try {
        const metrics = await service.getEventMetrics();
        return { success: true, ...metrics };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },

    get_ai_stats: async () => {
      try {
        const stats = await service.getAIStats();
        return { success: true, ...stats };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },

    get_system_stats: async () => {
      try {
        const stats = await service.getSystemStats();
        return { success: true, ...stats };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },

    get_full_dashboard: async () => {
      try {
        const dashboard = await service.getProjectDashboard();
        return { success: true, ...dashboard };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  };
}
