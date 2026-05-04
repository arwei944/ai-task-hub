import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from './server';

export const tasksRouter = createTRPCRouter({
  // List tasks with filtering
  list: protectedProcedure
    .input(
      z.object({
        status: z.array(z.string()).optional(),
        priority: z.array(z.string()).optional(),
        type: z.string().optional(),
        creator: z.string().optional(),
        assignee: z.string().optional(),
        tags: z.array(z.string()).optional(),
        parentTaskId: z.string().nullable().optional(),
        search: z.string().optional(),
        dueBefore: z.string().optional(),
        dueAfter: z.string().optional(),
        sortBy: z.enum(['createdAt', 'updatedAt', 'priority', 'dueDate', 'progress']).optional(),
        sortOrder: z.enum(['asc', 'desc']).optional(),
        page: z.number().min(1).optional(),
        pageSize: z.number().min(1).max(100).optional(),
        projectId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const service = ctx.services.taskService;
      const query = {
        ...input,
        dueBefore: input.dueBefore ? new Date(input.dueBefore) : undefined,
        dueAfter: input.dueAfter ? new Date(input.dueAfter) : undefined,
      };
      return service.listTasks(query);
    }),

  // Get single task
  get: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const service = ctx.services.taskService;
    const task = await service.getTask(input.id);
    if (!task) throw new Error('Task not found');
    return task;
  }),

  // Create task
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        priority: z.enum(['urgent', 'high', 'medium', 'low']).optional(),
        type: z.string().optional(),
        source: z.string().optional(),
        sourceRef: z.string().optional(),
        assignee: z.string().optional(),
        creator: z.string().optional(),
        parentTaskId: z.string().optional(),
        dueDate: z.string().optional(),
        tags: z.array(z.string()).optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
        projectId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const service = ctx.services.taskService;
      return service.createTask({
        ...input,
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      }, input.creator ?? 'system');
    }),

  // Update task
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        status: z.enum(['todo', 'in_progress', 'done', 'closed', 'deleted']).optional(),
        priority: z.enum(['urgent', 'high', 'medium', 'low']).optional(),
        progress: z.number().min(0).max(100).optional(),
        type: z.string().optional(),
        assignee: z.string().optional(),
        dueDate: z.string().optional(),
        tags: z.array(z.string()).optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const service = ctx.services.taskService;
      const { id, ...data } = input;
      return service.updateTask(id, {
        ...data,
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      });
    }),

  // Update status (with transition validation)
  updateStatus: protectedProcedure
    .input(z.object({ id: z.string(), status: z.enum(['todo', 'in_progress', 'done', 'closed']) }))
    .mutation(async ({ ctx, input }) => {
      const service = ctx.services.taskService;
      return service.updateStatus(input.id, input.status);
    }),

  // Delete task (soft delete)
  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const service = ctx.services.taskService;
    await service.deleteTask(input.id);
    return { success: true };
  }),

  // Get task history
  history: protectedProcedure.input(z.object({ taskId: z.string() })).query(async ({ ctx, input }) => {
    const service = ctx.services.taskService;
    return service.getTaskHistory(input.taskId);
  }),

  // Get subtasks
  subTasks: protectedProcedure.input(z.object({ parentTaskId: z.string() })).query(async ({ ctx, input }) => {
    const service = ctx.services.taskService;
    return service.getSubTasks(input.parentTaskId);
  }),

  // Status counts
  statusCounts: protectedProcedure.query(async ({ ctx }) => {
    const service = ctx.services.taskService;
    return service.getStatusCounts();
  }),
});
