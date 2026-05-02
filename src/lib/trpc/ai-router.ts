import { z } from 'zod';
import { createTRPCRouter, publicProcedure, protectedProcedure } from './server';
import type { TaskSummary } from '@/lib/modules/ai-engine/advisors/schedule-advisor';

export const aiRouter = createTRPCRouter({
  // ====== Existing AI capabilities ======

  // Extract tasks from text
  extractTasks: publicProcedure
    .input(z.object({ text: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const ai = ctx.services.aiModel;
      const logger = ctx.services.logger;
      const extractor = ctx.services.taskExtractor;
      return extractor.extract(input.text);
    }),

  // Decompose a task into subtasks (preview only)
  decomposeTask: publicProcedure
    .input(z.object({ title: z.string().min(1), description: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const decomposer = ctx.services.taskDecomposer;
      return decomposer.decompose(input.title, input.description);
    }),

  // Infer task status from context
  inferStatus: publicProcedure
    .input(z.object({
      taskTitle: z.string(),
      currentStatus: z.string(),
      context: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const inferencer = ctx.services.statusInferencer;
      return inferencer.infer(input.taskTitle, input.currentStatus, input.context);
    }),

  // Generate analysis report
  generateReport: publicProcedure
    .input(z.object({
      totalTasks: z.number(),
      statusCounts: z.record(z.string(), z.number()),
      recentTasks: z.array(z.object({
        title: z.string(),
        status: z.string(),
        priority: z.string(),
        dueDate: z.string().nullable(),
        createdAt: z.string(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      const analyzer = ctx.services.taskAnalyzer;
      return analyzer.generateReport(input);
    }),

  // ====== New M12 capabilities ======

  // Natural language task query
  nlQuery: protectedProcedure
    .input(z.object({ query: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const nlQuery = ctx.services.nlTaskQuery;
      return nlQuery.query(input.query);
    }),

  // Smart scheduling advice
  scheduleAdvice: protectedProcedure
    .input(z.object({
      tasks: z.array(z.object({
        id: z.string(),
        title: z.string(),
        status: z.string(),
        priority: z.string(),
        progress: z.number(),
        dueDate: z.string().nullable().optional(),
        assignee: z.string().nullable().optional(),
        createdAt: z.string(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      const advisor = ctx.services.scheduleAdvisor;
      return advisor.analyze(input.tasks as TaskSummary[]);
    }),

  // Auto-decompose task and create sub-tasks
  autoDecompose: protectedProcedure
    .input(z.object({
      taskId: z.string(),
      title: z.string().min(1),
      description: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const decomposer = ctx.services.autoTaskDecomposer;

      // Preview mode (no auto-creation without task service)
      return decomposer.preview(input.title, input.description);
    }),
});
