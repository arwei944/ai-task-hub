import { z } from 'zod';
import { createTRPCRouter, publicProcedure, protectedProcedure, adminProcedure } from './server';

// Lazy-initialized services
let _agentService: any = null;
let _permissionService: any = null;
let _operationLogger: any = null;

async function getServices() {
  if (_agentService) return { agentService: _agentService, permissionService: _permissionService!, operationLogger: _operationLogger! };

  const { getPrisma } = await import('@/lib/db');
  const { AgentService } = await import('@/lib/modules/agent-collab/agent.service');
  const { AgentRepository } = await import('@/lib/modules/agent-collab/agent.repository');
  const { AgentOperationRepository } = await import('@/lib/modules/agent-collab/agent-operation.repository');
  const { PermissionService } = await import('@/lib/modules/agent-collab/permission.service');
  const { AgentOperationLogger } = await import('@/lib/modules/agent-collab/operation-logger');
  const { TaskRepository } = await import('@/lib/modules/task-core/task.repository');
  const { EventBus } = await import('@/lib/core/event-bus');
  const { Logger } = await import('@/lib/core/logger');

  const prisma = getPrisma();
  const eventBus = new EventBus();
  const logger = new Logger('agent-collab');

  const agentRepo = new AgentRepository(prisma);
  const operationRepo = new AgentOperationRepository(prisma);
  const taskRepo = new TaskRepository(prisma);

  _agentService = new AgentService(agentRepo, operationRepo, eventBus, logger);
  _permissionService = new PermissionService(taskRepo, logger);
  _operationLogger = new AgentOperationLogger(operationRepo, eventBus, logger);

  return { agentService: _agentService, permissionService: _permissionService, operationLogger: _operationLogger };
}

export const agentsRouter = createTRPCRouter({
  // Register a new agent
  register: publicProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      capabilities: z.array(z.string()).optional(),
      permissionLevel: z.enum(['user', 'agent']).optional(),
    }))
    .mutation(async ({ input }) => {
      const { agentService } = await getServices();
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
    .query(async ({ input }) => {
      const { agentService } = await getServices();
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
    .query(async ({ input }) => {
      const { agentService } = await getServices();
      return agentService.listAgents(input);
    }),

  // Get single agent
  get: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ input }) => {
    const { agentService } = await getServices();
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
    .mutation(async ({ input }) => {
      const { agentService } = await getServices();
      const { id, ...data } = input;
      const agent = await agentService.updateAgent(id, data);
      if (!agent) throw new Error('Agent not found');
      return agent;
    }),

  // Deactivate agent
  deactivate: adminProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    const { agentService } = await getServices();
    await agentService.deactivateAgent(input.id);
    return { success: true };
  }),

  // Delete agent
  delete: adminProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    const { agentService } = await getServices();
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
    .query(async ({ input }) => {
      const { agentService } = await getServices();
      return agentService.getAgentOperations(input.agentId, {
        action: input.action,
        limit: input.limit,
        offset: input.offset,
      });
    }),

  // Get recent operations across all agents
  recentOperations: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(200).optional() }).optional())
    .query(async ({ input }) => {
      const { agentService } = await getServices();
      return agentService.getRecentOperations(input?.limit ?? 50);
    }),

  // Get agent stats
  stats: protectedProcedure.input(z.object({ agentId: z.string() })).query(async ({ input }) => {
    const { agentService } = await getServices();
    return agentService.getAgentStats(input.agentId);
  }),

  // Check permission
  checkPermission: publicProcedure
    .input(z.object({
      apiKey: z.string(),
      action: z.enum(['read', 'create', 'update', 'delete', 'status_change']),
      taskId: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const { agentService, permissionService } = await getServices();
      const agent = await agentService.authenticate(input.apiKey);
      return permissionService.checkPermission(agent, input.action, input.taskId);
    }),
});
