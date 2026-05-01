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
import { getPrisma } from '@/lib/db';

// Lazy-initialized service (for server-side only)
let _workflowService: WorkflowService | null = null;

function getWorkflowService(): WorkflowService {
  if (_workflowService) return _workflowService;
  const prisma = getPrisma();
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
  id: z.string(),
  name: z.string(),
  type: z.enum(['create-task', 'update-status', 'ai-analyze', 'send-notification', 'wait', 'parallel-group', 'condition', 'foreach', 'invoke-agent', 'http-request', 'transform', 'approval']),
  config: z.record(z.string(), z.unknown()),
  onError: z.enum(['continue', 'fail']).optional(),
  feedbackMode: z.enum(['auto', 'notify', 'block', 'smart']).optional(),
  soloSubAgent: z.enum(['explore', 'plan', 'general_purpose']).optional(),
  soloCallMode: z.enum(['mcp', 'rest', 'pull']).optional(),
  timeoutMs: z.number().optional(),
  condition: z.object({
    expression: z.string(),
    thenSteps: z.array(z.any()).optional(),
    elseSteps: z.array(z.any()).optional(),
  }).optional(),
  steps: z.array(z.any()).optional(),
});

export const workflowsRouter = createTRPCRouter({
  // Create workflow
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        trigger: z.string().optional(),
        triggerConfig: z.string().optional(),
        steps: z.array(stepSchema).min(1),
        variables: z.record(z.string(), z.unknown()).optional(),
        retryPolicy: z.object({
          max: z.number(),
          backoff: z.enum(['fixed', 'exponential', 'linear']),
          delayMs: z.number(),
        }).optional(),
        concurrencyLimit: z.number().min(1).max(20).optional(),
        timeoutMs: z.number().optional(),
        soloConfig: z.object({
          defaultMode: z.enum(['mcp', 'rest', 'pull']).optional(),
          defaultSubAgent: z.enum(['explore', 'plan', 'general_purpose']).optional(),
          defaultTimeoutMs: z.number().optional(),
        }).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const service = getWorkflowService();
      const dto = { ...input, createdBy: ctx.user.id };
      return service.createWorkflow(dto as any);
    }),

  // Update workflow
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        trigger: z.string().optional(),
        triggerConfig: z.string().optional(),
        steps: z.array(stepSchema).optional(),
        variables: z.record(z.string(), z.unknown()).optional(),
        isActive: z.boolean().optional(),
        retryPolicy: z.object({
          max: z.number(),
          backoff: z.enum(['fixed', 'exponential', 'linear']),
          delayMs: z.number(),
        }).optional(),
        concurrencyLimit: z.number().min(1).max(20).optional(),
        timeoutMs: z.number().optional(),
        soloConfig: z.object({
          defaultMode: z.enum(['mcp', 'rest', 'pull']).optional(),
          defaultSubAgent: z.enum(['explore', 'plan', 'general_purpose']).optional(),
          defaultTimeoutMs: z.number().optional(),
        }).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const service = getWorkflowService();
      const { id, ...dto } = input;
      return service.updateWorkflow(id, dto as any);
    }),

  // Delete workflow (admin only)
  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const service = getWorkflowService();
      return service.deleteWorkflow(input.id);
    }),

  // Get single workflow
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const service = getWorkflowService();
      return service.getWorkflow(input.id);
    }),

  // List workflows
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).optional(),
        pageSize: z.number().min(1).max(100).optional(),
        isActive: z.boolean().optional(),
        createdBy: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const service = getWorkflowService();
      return service.listWorkflows(input);
    }),

  // Trigger workflow execution
  run: protectedProcedure
    .input(z.object({ workflowId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const service = getWorkflowService();
      return service.runWorkflow(input.workflowId, ctx.user.id);
    }),

  // Cancel execution
  cancel: protectedProcedure
    .input(z.object({ executionId: z.string() }))
    .mutation(async ({ input }) => {
      const service = getWorkflowService();
      return service.cancelExecution(input.executionId);
    }),

  // Get execution details
  getExecution: protectedProcedure
    .input(z.object({ executionId: z.string() }))
    .query(async ({ input }) => {
      const service = getWorkflowService();
      return service.getExecution(input.executionId);
    }),

  // List executions for a workflow
  listExecutions: protectedProcedure
    .input(
      z.object({
        workflowId: z.string(),
        page: z.number().min(1).optional(),
        pageSize: z.number().min(1).max(100).optional(),
        status: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const service = getWorkflowService();
      const { workflowId, ...options } = input;
      return service.listExecutions(workflowId, options);
    }),

  trigger: protectedProcedure.input(z.object({
    workflowId: z.string(),
  })).mutation(async ({ input, ctx }) => {
    const service = getWorkflowService();
    return service.runWorkflow(input.workflowId, ctx.user.id);
  }),

  // --- Observability procedures (mock data) ---

  getObservabilityStats: protectedProcedure.query(async () => {
    return {
      totalExecutions: 128,
      totalSteps: 576,
      successRate: 0.9219,
      avgDurationMs: 3420,
      totalSOLOCalls: 89,
      soloSuccessRate: 0.9551,
    };
  }),

  getRecentExecutions: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).optional() }))
    .query(async ({ input }) => {
      const limit = input.limit ?? 10;
      const now = Date.now();
      const items = [
        { id: 'exec-001', workflowName: '每日任务分析', status: 'completed', durationMs: 2850, stepsCompleted: 5, totalSteps: 5, startedAt: new Date(now - 1000 * 60 * 2) },
        { id: 'exec-002', workflowName: 'PR 审查自动化', status: 'completed', durationMs: 5230, stepsCompleted: 8, totalSteps: 8, startedAt: new Date(now - 1000 * 60 * 15) },
        { id: 'exec-003', workflowName: '部署流水线', status: 'failed', durationMs: 8100, stepsCompleted: 3, totalSteps: 6, startedAt: new Date(now - 1000 * 60 * 32) },
        { id: 'exec-004', workflowName: '每日任务分析', status: 'completed', durationMs: 3100, stepsCompleted: 5, totalSteps: 5, startedAt: new Date(now - 1000 * 60 * 60) },
        { id: 'exec-005', workflowName: '客户反馈处理', status: 'completed', durationMs: 4200, stepsCompleted: 7, totalSteps: 7, startedAt: new Date(now - 1000 * 60 * 90) },
        { id: 'exec-006', workflowName: 'PR 审查自动化', status: 'running', durationMs: 1200, stepsCompleted: 2, totalSteps: 8, startedAt: new Date(now - 1000 * 60 * 5) },
        { id: 'exec-007', workflowName: '文档生成', status: 'completed', durationMs: 6800, stepsCompleted: 4, totalSteps: 4, startedAt: new Date(now - 1000 * 60 * 120) },
        { id: 'exec-008', workflowName: '部署流水线', status: 'completed', durationMs: 7500, stepsCompleted: 6, totalSteps: 6, startedAt: new Date(now - 1000 * 60 * 180) },
        { id: 'exec-009', workflowName: '每日任务分析', status: 'failed', durationMs: 1500, stepsCompleted: 1, totalSteps: 5, startedAt: new Date(now - 1000 * 60 * 240) },
        { id: 'exec-010', workflowName: '客户反馈处理', status: 'completed', durationMs: 3900, stepsCompleted: 7, totalSteps: 7, startedAt: new Date(now - 1000 * 60 * 300) },
      ];
      return { items: items.slice(0, limit) };
    }),

  getStepPerformance: protectedProcedure.query(async () => {
    return {
      items: [
        { stepType: 'create-task', label: '创建任务', totalCalls: 156, avgDurationMs: 320, failureRate: 0.019, successCount: 153, failCount: 3 },
        { stepType: 'update-status', label: '更新状态', totalCalls: 203, avgDurationMs: 180, failureRate: 0.010, successCount: 201, failCount: 2 },
        { stepType: 'ai-analyze', label: 'AI 分析', totalCalls: 89, avgDurationMs: 4200, failureRate: 0.045, successCount: 85, failCount: 4 },
        { stepType: 'send-notification', label: '发送通知', totalCalls: 67, avgDurationMs: 450, failureRate: 0.030, successCount: 65, failCount: 2 },
        { stepType: 'condition', label: '条件判断', totalCalls: 134, avgDurationMs: 15, failureRate: 0.000, successCount: 134, failCount: 0 },
        { stepType: 'wait', label: '等待', totalCalls: 45, avgDurationMs: 5000, failureRate: 0.000, successCount: 45, failCount: 0 },
        { stepType: 'http-request', label: 'HTTP 请求', totalCalls: 38, avgDurationMs: 1200, failureRate: 0.079, successCount: 35, failCount: 3 },
        { stepType: 'transform', label: '数据转换', totalCalls: 52, avgDurationMs: 90, failureRate: 0.019, successCount: 51, failCount: 1 },
      ],
    };
  }),

  getSOLOCallHistory: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).optional() }))
    .query(async ({ input }) => {
      const limit = input.limit ?? 10;
      const now = Date.now();
      const items = [
        { id: 'solo-001', mode: 'mcp', subAgent: 'explore', prompt: '分析最近7天的任务完成趋势', durationMs: 3200, success: true, tokensUsed: 1520, startedAt: new Date(now - 1000 * 60 * 2) },
        { id: 'solo-002', mode: 'mcp', subAgent: 'plan', prompt: '制定 PR 审查策略', durationMs: 5100, success: true, tokensUsed: 2340, startedAt: new Date(now - 1000 * 60 * 15) },
        { id: 'solo-003', mode: 'rest', subAgent: 'general_purpose', prompt: '生成部署报告', durationMs: 4500, success: false, tokensUsed: 890, startedAt: new Date(now - 1000 * 60 * 32) },
        { id: 'solo-004', mode: 'mcp', subAgent: 'explore', prompt: '检查代码质量问题', durationMs: 2800, success: true, tokensUsed: 1100, startedAt: new Date(now - 1000 * 60 * 60) },
        { id: 'solo-005', mode: 'pull', subAgent: 'plan', prompt: '优化工作流步骤顺序', durationMs: 6200, success: true, tokensUsed: 3100, startedAt: new Date(now - 1000 * 60 * 90) },
        { id: 'solo-006', mode: 'mcp', subAgent: 'general_purpose', prompt: '分析客户反馈情感', durationMs: 3800, success: true, tokensUsed: 1780, startedAt: new Date(now - 1000 * 60 * 120) },
        { id: 'solo-007', mode: 'rest', subAgent: 'explore', prompt: '搜索相关文档', durationMs: 2100, success: true, tokensUsed: 650, startedAt: new Date(now - 1000 * 60 * 180) },
        { id: 'solo-008', mode: 'mcp', subAgent: 'plan', prompt: '制定改进计划', durationMs: 5500, success: true, tokensUsed: 2800, startedAt: new Date(now - 1000 * 60 * 240) },
      ];
      return { items: items.slice(0, limit) };
    }),
});
