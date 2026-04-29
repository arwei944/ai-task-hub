import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, adminProcedure } from './server';
import { WorkflowService } from '@/lib/modules/workflow-engine/workflow.service';
import { TaskService } from '@/lib/modules/task-core/task.service';
import { TaskRepository } from '@/lib/modules/task-core/task.repository';
import { TaskHistoryRepository } from '@/lib/modules/task-core/task-history.repository';
import { TaskDependencyRepository } from '@/lib/modules/task-core/task-dependency.repository';
import { TaskProgressService } from '@/lib/modules/task-core/task-progress.service';
import { EventBus } from '@/lib/core/event-bus';
import { Logger } from '@/lib/core/logger';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

let _workflowService: WorkflowService | null = null;
function getWorkflowService(): WorkflowService {
  if (_workflowService) return _workflowService;
  const dbPath = process.env.DATABASE_URL?.replace(/^file:/, '') ?? './prisma/dev.db';
  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  const prisma = new PrismaClient({ adapter });
  const logger = new Logger('workflow-engine');
  const eventBus = new EventBus();
  const taskRepo = new TaskRepository(prisma);
  const historyRepo = new TaskHistoryRepository(prisma);
  const depRepo = new TaskDependencyRepository(prisma);
  const progressService = new TaskProgressService(taskRepo, logger);
  const taskService = new TaskService(taskRepo, historyRepo, depRepo, progressService, eventBus, logger);
  _workflowService = new WorkflowService(prisma, taskService, logger);
  return _workflowService;
}

const stepSchema = z.object({
  id: z.string(), name: z.string(),
  type: z.enum(['create-task', 'update-status', 'ai-analyze', 'send-notification', 'wait', 'parallel-group', 'condition', 'foreach', 'invoke-agent', 'http-request', 'transform', 'approval']),
  config: z.record(z.string(), z.unknown()),
  onError: z.enum(['continue', 'fail']).optional(),
  feedbackMode: z.enum(['auto', 'notify', 'block', 'smart']).optional(),
  soloSubAgent: z.enum(['explore', 'plan', 'general_purpose']).optional(),
  soloCallMode: z.enum(['mcp', 'rest', 'pull']).optional(),
  timeoutMs: z.number().optional(),
  condition: z.object({ expression: z.string(), thenSteps: z.array(z.any()).optional(), elseSteps: z.array(z.any()).optional() }).optional(),
  steps: z.array(z.any()).optional(),
});

const workflowConfigSchema = z.object({
  retryPolicy: z.object({ max: z.number(), backoff: z.enum(['fixed', 'exponential', 'linear']), delayMs: z.number() }).optional(),
  concurrencyLimit: z.number().min(1).max(20).optional(),
  timeoutMs: z.number().optional(),
  soloConfig: z.object({ defaultMode: z.enum(['mcp', 'rest', 'pull']).optional(), defaultSubAgent: z.enum(['explore', 'plan', 'general_purpose']).optional(), defaultTimeoutMs: z.number().optional() }).optional(),
});

export const workflowsRouter = createTRPCRouter({
  create: protectedProcedure.input(z.object({ name: z.string().min(1), description: z.string().optional(), trigger: z.string().optional(), triggerConfig: z.string().optional(), steps: z.array(stepSchema).min(1), variables: z.record(z.string(), z.unknown()).optional() }).merge(workflowConfigSchema)).mutation(async ({ input, ctx }) => { const service = getWorkflowService(); return service.createWorkflow({ ...input, createdBy: ctx.user.id }); }),
  update: protectedProcedure.input(z.object({ id: z.string(), name: z.string().optional(), description: z.string().optional(), trigger: z.string().optional(), triggerConfig: z.string().optional(), steps: z.array(stepSchema).optional(), variables: z.record(z.string(), z.unknown()).optional(), isActive: z.boolean().optional() }).merge(workflowConfigSchema)).mutation(async ({ input }) => { const service = getWorkflowService(); const { id, ...dto } = input; return service.updateWorkflow(id, dto); }),
  delete: adminProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => { const service = getWorkflowService(); return service.deleteWorkflow(input.id); }),
  get: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ input }) => { const service = getWorkflowService(); return service.getWorkflow(input.id); }),
  list: protectedProcedure.input(z.object({ page: z.number().min(1).optional(), pageSize: z.number().min(1).max(100).optional(), isActive: z.boolean().optional(), createdBy: z.string().optional() })).query(async ({ input }) => { const service = getWorkflowService(); return service.listWorkflows(input); }),
  run: protectedProcedure.input(z.object({ workflowId: z.string() })).mutation(async ({ input, ctx }) => { const service = getWorkflowService(); return service.runWorkflow(input.workflowId, ctx.user.id); }),
  cancel: protectedProcedure.input(z.object({ executionId: z.string() })).mutation(async ({ input }) => { const service = getWorkflowService(); return service.cancelExecution(input.executionId); }),
  getExecution: protectedProcedure.input(z.object({ executionId: z.string() })).query(async ({ input }) => { const service = getWorkflowService(); return service.getExecution(input.executionId); }),
  listExecutions: protectedProcedure.input(z.object({ workflowId: z.string(), page: z.number().min(1).optional(), pageSize: z.number().min(1).max(100).optional(), status: z.string().optional() })).query(async ({ input }) => { const service = getWorkflowService(); const { workflowId, ...options } = input; return service.listExecutions(workflowId, options); }),
});