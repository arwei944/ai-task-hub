import { z } from 'zod';
import { createTRPCRouter, publicProcedure, protectedProcedure, adminProcedure } from './server';
import { AgentService } from '@/lib/modules/agent-collab/agent.service';
import { AgentRepository } from '@/lib/modules/agent-collab/agent.repository';
import { AgentOperationRepository } from '@/lib/modules/agent-collab/agent-operation.repository';
import { PermissionService } from '@/lib/modules/agent-collab/permission.service';
import { AgentOperationLogger } from '@/lib/modules/agent-collab/operation-logger';
import { TaskRepository } from '@/lib/modules/task-core/task.repository';
import { EventBus } from '@/lib/core/event-bus';
import { Logger } from '@/lib/core/logger';
import { getPrisma } from '@/lib/db';

// Lazy-initialized services
let _agentService: AgentService | null = null;
let _permissionService: PermissionService | null = null;
let _operationLogger: AgentOperationLogger | null = null;

function getServices() {
  if (_agentService) return { agentService: _agentService, permissionService: _permissionService!, operationLogger: _operationLogger! };

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
      const { agentService } = getServices();
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
      const { agentService } = getServices();
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
      const { agentService } = getServices();
      return agentService.listAgents(input);
    }),

  // Get single agent
  get: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ input }) => {
    const { agentService } = getServices();
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
      const { agentService } = getServices();
      const { id, ...data } = input;
      const agent = await agentService.updateAgent(id, data);
      if (!agent) throw new Error('Agent not found');
      return agent;
    }),

  // Deactivate agent
  deactivate: adminProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    const { agentService } = getServices();
    await agentService.deactivateAgent(input.id);
    return { success: true };
  }),

  // Delete agent
  delete: adminProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    const { agentService } = getServices();
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
      const { agentService } = getServices();
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
      const { agentService } = getServices();
      return agentService.getRecentOperations(input?.limit ?? 50);
    }),

  // Get agent stats
  stats: protectedProcedure.input(z.object({ agentId: z.string() })).query(async ({ input }) => {
    const { agentService } = getServices();
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
      const { agentService, permissionService } = getServices();
      const agent = await agentService.authenticate(input.apiKey);
      return permissionService.checkPermission(agent, input.action, input.taskId);
    }),
});
