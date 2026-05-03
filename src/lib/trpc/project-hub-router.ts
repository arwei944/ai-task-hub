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
  }),
});
