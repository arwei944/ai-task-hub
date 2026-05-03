import type { ILogger } from '@/lib/core/types';

export function createProjectHubToolHandlers(
  projectHubService: any,
  milestoneService: any,
  projectAgentService: any,
  projectDependencyService: any,
  workLogService: any,
  docService: any,
  templateService: any,
  reportService: any,
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
    ph_manage_docs: async (args: Record<string, unknown>) => {
      const { projectId, action, ...data } = args as any;
      switch (action) {
        case 'list': return docService.list({ projectId, docType: data.docType, status: data.status });
        case 'get': return docService.get(data.docId);
        case 'create': return docService.create({ projectId, ...data });
        case 'update': return docService.update(data.docId, data);
        case 'delete': return docService.delete(data.docId);
        case 'search': return docService.search({ projectId, queryText: data.queryText, docType: data.docType, tags: data.tags });
        case 'versions': return docService.versions(data.docId);
        case 'restore_version': return docService.restoreVersion(data.versionId);
        default: throw new Error(`Unknown doc action: ${action}`);
      }
    },
    ph_manage_templates: async (args: Record<string, unknown>) => {
      const { action, ...data } = args as any;
      switch (action) {
        case 'list': return templateService.list(data);
        case 'get': return templateService.get(data.templateId);
        case 'create_from_template': return templateService.createFromTemplate(data);
        case 'save_as_template': return templateService.saveAsTemplate(data);
        case 'update': { const { templateId, ...rest } = data; return templateService.update(templateId, rest); }
        case 'delete': return templateService.delete(data.templateId);
        case 'rate': return templateService.rate(data.templateId, data.rating);
        case 'publish': return templateService.publish(data.templateId);
        case 'built_in': return templateService.getBuiltIn();
        default: throw new Error(`Unknown template action: ${action}`);
      }
    },
    ph_log_agent_work: async (args: Record<string, unknown>) => {
      return workLogService.log(args as any);
    },
    ph_get_agent_workload: async (args: Record<string, unknown>) => {
      return workLogService.workloadBoard(args as any);
    },
    ph_generate_report: async (args: Record<string, unknown>) => {
      if (args.projectId) {
        return reportService.generateProjectReport(args.projectId as string);
      }
      return reportService.generateDashboardReport();
    },
    ph_register_identity: async (args: Record<string, unknown>) => {
      return projectAgentService.createAndAssign({
        projectId: args.projectId as string,
        name: args.agentName as string,
        clientType: (args.clientType as string) || 'api',
        role: (args.role as string) || '全栈开发',
        capabilities: args.capabilities as string[] | undefined,
      });
    },
    ph_create_project: async (args: Record<string, unknown>) => {
      return projectHubService.createProjectWithAgent({
        name: args.name as string,
        description: args.description as string | undefined,
        priority: args.priority as string | undefined,
        techStack: args.techStack as string[] | undefined,
        agentName: args.agentName as string,
        agentClientType: args.clientType as string | undefined,
        agentRole: args.role as string | undefined,
        agentCapabilities: args.capabilities as string[] | undefined,
      });
    },
  };
}
