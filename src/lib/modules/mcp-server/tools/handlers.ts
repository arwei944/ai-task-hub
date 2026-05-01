// ============================================================
// MCP Tool Handlers for Task Core Module
// ============================================================

import type { TaskService } from '@/lib/modules/task-core/task.service';
import type { TaskExtractor } from '@/lib/modules/ai-engine/extractors/task-extractor';
import type { TaskDecomposer } from '@/lib/modules/ai-engine/decomposers/task-decomposer';
import type { TaskAnalyzer } from '@/lib/modules/ai-engine/analyzers/task-analyzer';
import type { StatusInferencer } from '@/lib/modules/ai-engine/inferencers/status-inferencer';
import type { ILogger } from '@/lib/core/types';

/**
 * Create tool handlers for task-core module
 */
export function createTaskCoreToolHandlers(
  taskService: TaskService,
  logger: ILogger,
) {
  return {
    create_task: async (args: Record<string, unknown>) => {
      logger.info('MCP: create_task called');
      const task = await taskService.createTask(
        {
          title: args.title as string,
          description: args.description as string | undefined,
          priority: args.priority as any,
          type: args.type as string | undefined,
          source: args.source as string | undefined,
          sourceRef: args.sourceRef as string | undefined,
          assignee: args.assignee as string | undefined,
          parentTaskId: args.parentTaskId as string | undefined,
          projectId: args.projectId as string | undefined,
          dueDate: args.dueDate ? new Date(args.dueDate as string) : undefined,
          tags: args.tags as string[] | undefined,
        },
        (args.creator as string) ?? 'mcp-agent',
      );
      return { success: true, task };
    },

    update_task: async (args: Record<string, unknown>) => {
      logger.info(`MCP: update_task called for ${args.id}`);
      const { id, ...data } = args;
      const updateData: any = { ...data };
      if (updateData.dueDate) {
        updateData.dueDate = new Date(updateData.dueDate as string);
      }
      const task = await taskService.updateTask(id as string, updateData);
      return { success: true, task };
    },

    get_task: async (args: Record<string, unknown>) => {
      logger.info(`MCP: get_task called for ${args.id}`);
      const task = await taskService.getTask(args.id as string);
      if (!task) {
        throw new Error(`Task not found: ${args.id}`);
      }
      return task;
    },

    list_tasks: async (args: Record<string, unknown>) => {
      logger.info('MCP: list_tasks called');
      const query: any = {
        status: args.status as string[] | undefined,
        priority: args.priority as string[] | undefined,
        type: args.type as string | undefined,
        creator: args.creator as string | undefined,
        search: args.search as string | undefined,
        page: args.page as number | undefined,
        pageSize: args.pageSize as number | undefined,
        sortBy: args.sortBy as any,
        sortOrder: args.sortOrder as any,
      };
      return taskService.listTasks(query);
    },

    delete_task: async (args: Record<string, unknown>) => {
      logger.info(`MCP: delete_task called for ${args.id}`);
      await taskService.deleteTask(args.id as string);
      return { success: true, message: `Task ${args.id} deleted` };
    },

    update_task_status: async (args: Record<string, unknown>) => {
      logger.info(`MCP: update_task_status called for ${args.id} -> ${args.status}`);
      const task = await taskService.updateStatus(
        args.id as string,
        args.status as 'todo' | 'in_progress' | 'done' | 'closed',
      );
      return { success: true, task };
    },

    get_task_history: async (args: Record<string, unknown>) => {
      logger.info(`MCP: get_task_history called for ${args.taskId}`);
      return taskService.getTaskHistory(args.taskId as string);
    },

    get_sub_tasks: async (args: Record<string, unknown>) => {
      logger.info(`MCP: get_sub_tasks called for ${args.parentTaskId}`);
      return taskService.getSubTasks(args.parentTaskId as string);
    },

    get_status_counts: async () => {
      logger.info('MCP: get_status_counts called');
      return taskService.getStatusCounts();
    },
  };
}

/**
 * Create tool handlers for ai-engine module
 */
export function createAIEngineToolHandlers(
  extractor: TaskExtractor,
  decomposer: TaskDecomposer,
  inferencer: StatusInferencer,
  analyzer: TaskAnalyzer,
  logger: ILogger,
) {
  return {
    extract_tasks: async (args: Record<string, unknown>) => {
      logger.info('MCP: extract_tasks called');
      const tasks = await extractor.extract(args.text as string, {
        source: args.source as string | undefined,
        creator: args.creator as string | undefined,
      });
      return { success: true, extractedCount: tasks.length, tasks };
    },

    decompose_task: async (args: Record<string, unknown>) => {
      logger.info(`MCP: decompose_task called for "${args.title}"`);
      const result = await decomposer.decompose(
        args.title as string,
        args.description as string | undefined,
      );
      return { success: true, ...result };
    },

    infer_task_status: async (args: Record<string, unknown>) => {
      logger.info(`MCP: infer_task_status called for "${args.taskTitle}"`);
      const result = await inferencer.infer(
        args.taskTitle as string,
        args.currentStatus as string,
        args.context as string,
      );
      return result;
    },

    generate_report: async (args: Record<string, unknown>) => {
      logger.info('MCP: generate_report called');
      const report = await analyzer.generateReport(args as any);
      return report;
    },
  };
}

