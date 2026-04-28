import { z } from 'zod';
import { createTRPCRouter, publicProcedure, protectedProcedure } from './server';
import { TaskExtractor } from '@/lib/modules/ai-engine/extractors/task-extractor';
import { TaskDecomposer } from '@/lib/modules/ai-engine/decomposers/task-decomposer';
import { AutoTaskDecomposer } from '@/lib/modules/ai-engine/decomposers/auto-task-decomposer';
import { StatusInferencer } from '@/lib/modules/ai-engine/inferencers/status-inferencer';
import { TaskAnalyzer } from '@/lib/modules/ai-engine/analyzers/task-analyzer';
import { NLTaskQuery } from '@/lib/modules/ai-engine/queries/nl-task-query';
import { ScheduleAdvisor, type TaskSummary } from '@/lib/modules/ai-engine/advisors/schedule-advisor';
import { OpenAICompatibleAdapter } from '@/lib/modules/ai-engine/ai-model-adapter';
import { Logger } from '@/lib/core/logger';

function getAI() {
  const logger = new Logger('ai-engine');
  return new OpenAICompatibleAdapter(
    {
      model: process.env.AI_MODEL ?? 'gpt-4o',
      baseURL: process.env.OPENAI_BASE_URL,
      apiKey: process.env.OPENAI_API_KEY,
    },
    logger,
  );
}

function getLogger() {
  return new Logger('ai-engine');
}

export const aiRouter = createTRPCRouter({
  // ====== Existing AI capabilities ======

  // Extract tasks from text
  extractTasks: publicProcedure
    .input(z.object({ text: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const ai = getAI();
      const logger = getLogger();
      const extractor = new TaskExtractor(ai, logger);
      return extractor.extract(input.text);
    }),

  // Decompose a task into subtasks (preview only)
  decomposeTask: publicProcedure
    .input(z.object({ title: z.string().min(1), description: z.string().optional() }))
    .mutation(async ({ input }) => {
      const ai = getAI();
      const logger = getLogger();
      const decomposer = new TaskDecomposer(ai, logger);
      return decomposer.decompose(input.title, input.description);
    }),

  // Infer task status from context
  inferStatus: publicProcedure
    .input(z.object({
      taskTitle: z.string(),
      currentStatus: z.string(),
      context: z.string(),
    }))
    .mutation(async ({ input }) => {
      const ai = getAI();
      const logger = getLogger();
      const inferencer = new StatusInferencer(ai, logger);
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
    .mutation(async ({ input }) => {
      const ai = getAI();
      const logger = getLogger();
      const analyzer = new TaskAnalyzer(ai, logger);
      return analyzer.generateReport(input);
    }),

  // ====== New M12 capabilities ======

  // Natural language task query
  nlQuery: protectedProcedure
    .input(z.object({ query: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const ai = getAI();
      const logger = getLogger();
      const nlQuery = new NLTaskQuery(ai, logger);
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
    .mutation(async ({ input }) => {
      const ai = getAI();
      const logger = getLogger();
      const advisor = new ScheduleAdvisor(ai, logger);
      return advisor.analyze(input.tasks as TaskSummary[]);
    }),

  // Auto-decompose task and create sub-tasks
  autoDecompose: protectedProcedure
    .input(z.object({
      taskId: z.string(),
      title: z.string().min(1),
      description: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const ai = getAI();
      const logger = getLogger();
      const decomposer = new AutoTaskDecomposer(ai, logger);

      // Preview mode (no auto-creation without task service)
      return decomposer.preview(input.title, input.description);
    }),
});
