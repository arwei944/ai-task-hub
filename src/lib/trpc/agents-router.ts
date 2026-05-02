import { z } from 'zod';
import { createTRPCRouter, publicProcedure, protectedProcedure, adminProcedure } from './server';

export const agentsRouter = createTRPCRouter({
  // Register a new agent
  register: publicProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      capabilities: z.array(z.string()).optional(),
      permissionLevel: z.enum(['user', 'agent']).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const agentService = ctx.services.agentService;
      const agent = await agentService.registerAgent(input);
      // Mask the API key in response (show only prefix)
      return {
        ...agent,
        apiKey: agent.apiKey,
        apiKeyPreview: `${agent.apiKey.substring(0, 10)}...`,
      };
    }),

  // Authenticate with API key
  authenticate: publicProcedure
    .input(z.object({ apiKey: z.string() }))
    .query(async ({ input, ctx }) => {
      const agentService = ctx.services.agentService;
      const agent = await agentService.authenticate(input.apiKey);
      if (!agent) {
        return { authenticated: false, agent: null };
      }
      return { authenticated: true, agent };
    }),

  // List all agents
  list: protectedProcedure
    .input(z.object({
      isActive: z.boolean().optional(),
      page: z.number().min(1).optional(),
      pageSize: z.number().min(1).max(100).optional(),
    }).optional())
    .query(async ({ input, ctx }) => {
      const agentService = ctx.services.agentService;
      return agentService.listAgents(input);
    }),

  // Get single agent
  get: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ input, ctx }) => {
    const agentService = ctx.services.agentService;
    const agent = await agentService.getAgent(input.id);
    if (!agent) throw new Error('Agent not found');
    return agent;
  }),

  // Update agent
  update: adminProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      capabilities: z.array(z.string()).optional(),
      permissionLevel: z.enum(['user', 'agent']).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const agentService = ctx.services.agentService;
      const { id, ...data } = input;
      const agent = await agentService.updateAgent(id, data);
      if (!agent) throw new Error('Agent not found');
      return agent;
    }),

  // Deactivate agent
  deactivate: adminProcedure.input(z.object({ id: z.string() })).mutation(async ({ input, ctx }) => {
    const agentService = ctx.services.agentService;
    await agentService.deactivateAgent(input.id);
    return { success: true };
  }),

  // Delete agent
  delete: adminProcedure.input(z.object({ id: z.string() })).mutation(async ({ input, ctx }) => {
    const agentService = ctx.services.agentService;
    await agentService.deleteAgent(input.id);
    return { success: true };
  }),

  // Get agent operations
  operations: protectedProcedure
    .input(z.object({
      agentId: z.string(),
      action: z.string().optional(),
      limit: z.number().min(1).max(200).optional(),
      offset: z.number().min(0).optional(),
    }))
    .query(async ({ input, ctx }) => {
      const agentService = ctx.services.agentService;
      return agentService.getAgentOperations(input.agentId, {
        action: input.action,
        limit: input.limit,
        offset: input.offset,
      });
    }),

  // Get recent operations across all agents
  recentOperations: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(200).optional() }).optional())
    .query(async ({ input, ctx }) => {
      const agentService = ctx.services.agentService;
      return agentService.getRecentOperations(input?.limit ?? 50);
    }),

  // Get agent stats
  stats: protectedProcedure.input(z.object({ agentId: z.string() })).query(async ({ input, ctx }) => {
    const agentService = ctx.services.agentService;
    return agentService.getAgentStats(input.agentId);
  }),

  // Check permission
  checkPermission: publicProcedure
    .input(z.object({
      apiKey: z.string(),
      action: z.enum(['read', 'create', 'update', 'delete', 'status_change']),
      taskId: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const agentService = ctx.services.agentService;
      const permissionService = ctx.services.permissionService;
      const agent = await agentService.authenticate(input.apiKey);
      return permissionService.checkPermission(agent, input.action, input.taskId);
    }),
});
