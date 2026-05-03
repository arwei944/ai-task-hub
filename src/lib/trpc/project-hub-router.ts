import { createTRPCRouter, protectedProcedure } from './server';
import { z } from 'zod';

export const projectHubRouter = createTRPCRouter({
  // ========== Dashboard ==========
  dashboard: createTRPCRouter({
    overview: protectedProcedure.query(async ({ ctx }) => {
      return ctx.services.projectHubService.getDashboardOverview();
    }),
    healthMatrix: protectedProcedure.query(async ({ ctx }) => {
      return ctx.services.projectHubService.getHealthMatrix();
    }),
    crossProjectDeps: protectedProcedure.query(async ({ ctx }) => {
      return ctx.services.projectDependencyService.getGraph();
    }),
  }),

  // ========== Projects ==========
  projects: createTRPCRouter({
    list: protectedProcedure
      .input(z.object({
        status: z.string().optional(),
        phase: z.string().optional(),
        priority: z.string().optional(),
        sortBy: z.string().optional(),
        sortOrder: z.enum(['asc', 'desc']).optional(),
        page: z.number().optional(),
        pageSize: z.number().optional(),
        search: z.string().optional(),
      }))
      .query(async ({ ctx, input }) => {
        return ctx.services.projectHubService.listProjects(input);
      }),
    get: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ ctx, input }) => {
        return ctx.services.projectHubService.getProjectDetail(input.id);
      }),
    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        description: z.string().optional(),
        priority: z.enum(['urgent', 'high', 'medium', 'low']).optional(),
        techStack: z.array(z.string()).optional(),
        repository: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return ctx.services.projectHubService.createProject(input);
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        phase: z.string().optional(),
        status: z.string().optional(),
        priority: z.string().optional(),
        techStack: z.array(z.string()).optional(),
        repository: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        return ctx.services.projectHubService.updateProject(id, data);
      }),
    archive: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return ctx.services.projectHubService.archiveProject(input.id);
      }),
    createWithAgent: protectedProcedure
      .input(z.object({
        name: z.string(),
        description: z.string().optional(),
        priority: z.enum(['high', 'medium', 'low']).optional(),
        techStack: z.array(z.string()).optional(),
        agentName: z.string(),
        agentRole: z.string().optional(),
        agentClientType: z.string().optional(),
        agentCapabilities: z.array(z.string()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return ctx.services.projectHubService.createProjectWithAgent(input);
      }),
  }),

  // ========== Milestones ==========
  milestones: createTRPCRouter({
    list: protectedProcedure
      .input(z.object({
        projectId: z.string(),
        status: z.string().optional(),
      }))
      .query(async ({ ctx, input }) => {
        return ctx.services.milestoneService.list(input);
      }),
    create: protectedProcedure
      .input(z.object({
        projectId: z.string(),
        title: z.string(),
        description: z.string().optional(),
        dueDate: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return ctx.services.milestoneService.create(input);
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        status: z.string().optional(),
        dueDate: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        return ctx.services.milestoneService.update(id, data);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return ctx.services.milestoneService.delete(input.id);
      }),
    reorder: protectedProcedure
      .input(z.object({
        projectId: z.string(),
        orders: z.array(z.object({ id: z.string(), sortOrder: z.number() })),
      }))
      .mutation(async ({ ctx, input }) => {
        const { projectId, orders } = input;
        return ctx.services.milestoneService.reorder(projectId, orders);
      }),
  }),

  // ========== Dependencies ==========
  dependencies: createTRPCRouter({
    list: protectedProcedure
      .input(z.object({ projectId: z.string().optional() }))
      .query(async ({ ctx, input }) => {
        return ctx.services.projectDependencyService.list(input.projectId);
      }),
    create: protectedProcedure
      .input(z.object({
        sourceProjectId: z.string(),
        targetProjectId: z.string(),
        dependencyType: z.string().optional(),
        description: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return ctx.services.projectDependencyService.create(input);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return ctx.services.projectDependencyService.delete(input.id);
      }),
    graph: protectedProcedure.query(async ({ ctx }) => {
      return ctx.services.projectDependencyService.getGraph();
    }),
  }),

  // ========== Agents ==========
  agents: createTRPCRouter({
    list: protectedProcedure
      .input(z.object({ projectId: z.string() }))
      .query(async ({ ctx, input }) => {
        return ctx.services.projectAgentService.list(input.projectId);
      }),
    assign: protectedProcedure
      .input(z.object({
        projectId: z.string(),
        agentId: z.string(),
        role: z.enum(['lead', 'developer', 'reviewer', 'observer']).optional(),
        capabilities: z.any().optional(),
        assignedBy: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return ctx.services.projectAgentService.assign(input);
      }),
    createAndAssign: protectedProcedure
      .input(z.object({
        projectId: z.string(),
        name: z.string(),
        description: z.string().optional(),
        clientType: z.string().optional(),
        role: z.enum(['lead', 'developer', 'reviewer', 'observer']).optional(),
        capabilities: z.array(z.string()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return ctx.services.projectAgentService.createAndAssign(input);
      }),
    updateRole: protectedProcedure
      .input(z.object({ id: z.string(), role: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return ctx.services.projectAgentService.updateRole(input.id, input.role);
      }),
    remove: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return ctx.services.projectAgentService.remove(input.id);
      }),
    crossProjectView: protectedProcedure.query(async ({ ctx }) => {
      return ctx.services.projectAgentService.crossProjectView();
    }),
    availableAgents: protectedProcedure
      .input(z.object({ projectId: z.string() }))
      .query(async ({ ctx, input }) => {
        return ctx.services.projectAgentService.getAvailableAgents(input.projectId);
      }),
    getProjectAgent: protectedProcedure
      .input(z.object({ projectId: z.string() }))
      .query(async ({ ctx, input }) => {
        return ctx.services.projectAgentService.getProjectAgent(input.projectId);
      }),
  }),

  // ========== Work Logs ==========
  workLogs: createTRPCRouter({
    log: protectedProcedure
      .input(z.object({
        projectId: z.string(),
        projectAgentId: z.string(),
        taskId: z.string().optional(),
        date: z.string(),
        hours: z.number(),
        description: z.string().optional(),
        autoGenerated: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return ctx.services.workLogService.log(input);
      }),
    update: protectedProcedure
      .input(z.object({ id: z.string(), hours: z.number().optional(), description: z.string().optional(), date: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        return ctx.services.workLogService.update(id, data);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return ctx.services.workLogService.delete(input.id);
      }),
    list: protectedProcedure
      .input(z.object({ projectId: z.string(), projectAgentId: z.string().optional(), dateFrom: z.string().optional(), dateTo: z.string().optional(), page: z.number().optional(), pageSize: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        return ctx.services.workLogService.list(input);
      }),
    summary: protectedProcedure
      .input(z.object({ projectId: z.string(), groupBy: z.enum(['agent', 'date', 'task']).optional(), dateFrom: z.string().optional(), dateTo: z.string().optional() }))
      .query(async ({ ctx, input }) => {
        return ctx.services.workLogService.summary(input);
      }),
    workloadBoard: protectedProcedure
      .input(z.object({ projectId: z.string() }))
      .query(async ({ ctx, input }) => {
        return ctx.services.workLogService.workloadBoard(input);
      }),
  }),

  // ========== Documents ==========
  docs: createTRPCRouter({
    list: protectedProcedure
      .input(z.object({ projectId: z.string(), docType: z.string().optional(), status: z.string().optional(), parentDocId: z.string().optional().nullable() }))
      .query(async ({ ctx, input }) => {
        return ctx.services.docService.list(input);
      }),
    get: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ ctx, input }) => {
        return ctx.services.docService.get(input.id);
      }),
    create: protectedProcedure
      .input(z.object({ projectId: z.string(), title: z.string(), content: z.string(), docType: z.string().optional(), parentDocId: z.string().optional(), tags: z.array(z.string()).optional(), linkedTaskIds: z.array(z.string()).optional() }))
      .mutation(async ({ ctx, input }) => {
        return ctx.services.docService.create(input);
      }),
    update: protectedProcedure
      .input(z.object({ id: z.string(), title: z.string().optional(), content: z.string().optional(), docType: z.string().optional(), status: z.string().optional(), tags: z.array(z.string()).optional(), linkedTaskIds: z.array(z.string()).optional(), changeLog: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        return ctx.services.docService.update(id, data);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return ctx.services.docService.delete(input.id);
      }),
    move: protectedProcedure
      .input(z.object({ id: z.string(), parentDocId: z.string().optional().nullable(), sortOrder: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        return ctx.services.docService.move(id, data);
      }),
    search: protectedProcedure
      .input(z.object({ projectId: z.string().optional(), queryText: z.string(), docType: z.string().optional(), tags: z.array(z.string()).optional(), page: z.number().optional(), pageSize: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        return ctx.services.docService.search(input);
      }),
    versions: protectedProcedure
      .input(z.object({ docId: z.string() }))
      .query(async ({ ctx, input }) => {
        return ctx.services.docService.versions(input.docId);
      }),
    restoreVersion: protectedProcedure
      .input(z.object({ versionId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return ctx.services.docService.restoreVersion(input.versionId);
      }),
  }),

  // ========== Templates ==========
  templates: createTRPCRouter({
    list: protectedProcedure
      .input(z.object({ category: z.string().optional(), isBuiltIn: z.boolean().optional(), isPublic: z.boolean().optional() }).optional())
      .query(async ({ ctx, input }) => {
        return ctx.services.templateService.list(input);
      }),
    get: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ ctx, input }) => {
        return ctx.services.templateService.get(input.id);
      }),
    createFromTemplate: protectedProcedure
      .input(z.object({ templateId: z.string(), name: z.string(), description: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        return ctx.services.templateService.createFromTemplate(input);
      }),
    saveAsTemplate: protectedProcedure
      .input(z.object({ name: z.string(), description: z.string().optional(), category: z.string().optional(), icon: z.string().optional(), projectId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return ctx.services.templateService.saveAsTemplate(input);
      }),
    update: protectedProcedure
      .input(z.object({ id: z.string(), name: z.string().optional(), description: z.string().optional(), category: z.string().optional(), icon: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        return ctx.services.templateService.update(id, data);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return ctx.services.templateService.delete(input.id);
      }),
    rate: protectedProcedure
      .input(z.object({ id: z.string(), rating: z.number().min(1).max(5) }))
      .mutation(async ({ ctx, input }) => {
        return ctx.services.templateService.rate(input.id, input.rating);
      }),
    publish: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return ctx.services.templateService.publish(input.id);
      }),
    builtIn: protectedProcedure.query(async ({ ctx }) => {
      return ctx.services.templateService.getBuiltIn();
    }),
  }),
  // ========== Project Tasks ==========
  tasks: createTRPCRouter({
    list: protectedProcedure
      .input(z.object({
        projectId: z.string(),
        status: z.array(z.string()).optional(),
        sortBy: z.enum(['createdAt', 'updatedAt', 'priority', 'dueDate', 'progress']).optional(),
      }))
      .query(async ({ ctx, input }) => {
        const { projectId, ...query } = input;
        return ctx.services.taskService.listTasks({ ...query, projectId } as any);
      }),

    create: protectedProcedure
      .input(z.object({
        projectId: z.string(),
        title: z.string().min(1),
        description: z.string().optional(),
        priority: z.enum(['urgent', 'high', 'medium', 'low']).optional(),
        type: z.string().optional(),
        dueDate: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { projectId, ...data } = input;
        return ctx.services.taskService.createTask({
          ...data,
          projectId,
          dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        }, 'project-agent');
      }),

    updateStatus: protectedProcedure
      .input(z.object({
        id: z.string(),
        status: z.enum(['todo', 'in_progress', 'done', 'closed']),
      }))
      .mutation(async ({ ctx, input }) => {
        return ctx.services.taskService.updateStatus(input.id, input.status);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await ctx.services.taskService.deleteTask(input.id);
        return { success: true };
      }),

    stats: protectedProcedure
      .input(z.object({ projectId: z.string() }))
      .query(async ({ ctx, input }) => {
        return ctx.services.projectHubService.getProjectTaskStats(input.projectId);
      }),
  }),

  // ========== Reports ==========
  reports: createTRPCRouter({
    projectReport: protectedProcedure
      .input(z.object({ projectId: z.string() }))
      .query(async ({ ctx, input }) => {
        return ctx.services.reportService.generateProjectReport(input.projectId);
      }),
    dashboardReport: protectedProcedure.query(async ({ ctx }) => {
      return ctx.services.reportService.generateDashboardReport();
    }),
  }),
});
