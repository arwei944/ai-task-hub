import type { ILogger } from '@/lib/core/types';

export function createProjectHubToolHandlers(
  projectHubService: any,
  milestoneService: any,
  projectAgentService: any,
  projectDependencyService: any,
  logger: ILogger,
) {
  return {
    ph_get_dashboard: async () => {
      return projectHubService.getDashboardOverview();
    },
    ph_get_project_health: async () => {
      return projectHubService.getHealthMatrix();
    },
    ph_list_projects: async (args: Record<string, unknown>) => {
      return projectHubService.listProjects(args);
    },
    ph_manage_milestones: async (args: Record<string, unknown>) => {
      const { projectId, action, ...data } = args as any;
      switch (action) {
        case 'list': return milestoneService.list({ projectId, status: data.status });
        case 'create': return milestoneService.create({ projectId, ...data });
        case 'update': return milestoneService.update(data.milestoneId, data);
        case 'delete': return milestoneService.delete(data.milestoneId);
        case 'reorder': return milestoneService.reorder(projectId, data.orders);
        default: throw new Error(`Unknown milestone action: ${action}`);
      }
    },
    ph_manage_agents: async (args: Record<string, unknown>) => {
      const { projectId, action, ...data } = args as any;
      switch (action) {
        case 'list': return projectAgentService.list(projectId);
        case 'assign': return projectAgentService.assign({ projectId, ...data });
        case 'update_role': return projectAgentService.updateRole(data.id, data.role);
        case 'remove': return projectAgentService.remove(data.id);
        case 'cross_project_view': return projectAgentService.crossProjectView();
        case 'available': return projectAgentService.getAvailableAgents(projectId);
        default: throw new Error(`Unknown agent action: ${action}`);
      }
    },
    ph_get_cross_project_deps: async () => {
      return projectDependencyService.getGraph();
    },
    ph_create_project_dependency: async (args: Record<string, unknown>) => {
      return projectDependencyService.create(args);
    },
  };
}
