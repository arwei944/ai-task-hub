// ============================================================
// MCP Tool Handlers for Test Management Module
// ============================================================

import type { TestManagementService } from '@/lib/modules/test-management/test-management.service';
import type { ILogger } from '@/lib/core/types';

/**
 * Create tool handlers for test-management module
 */
export function createTestManagementToolHandlers(
  service: TestManagementService,
  logger: ILogger,
) {
  return {
    create_test_case: async (args: Record<string, unknown>) => {
      logger.info('MCP: create_test_case called');
      const testCase = await service.createTestCase({
        projectId: args.projectId as string,
        title: args.title as string,
        description: args.description as string | undefined,
        type: args.type as any,
        priority: args.priority as any,
        status: args.status as any,
        taskId: args.taskId as string | undefined,
        requirementId: args.requirementId as string | undefined,
        expectedResult: args.expectedResult as string | undefined,
        createdBy: args.createdBy as string | undefined,
        aiGenerated: args.aiGenerated as boolean | undefined,
      });
      return { success: true, testCase };
    },

    get_test_case: async (args: Record<string, unknown>) => {
      logger.info(`MCP: get_test_case called for ${args.id}`);
      const testCase = await service.getTestCase(args.id as string);
      if (!testCase) {
        throw new Error(`TestCase not found: ${args.id}`);
      }
      return testCase;
    },

    list_test_cases: async (args: Record<string, unknown>) => {
      logger.info('MCP: list_test_cases called');
      return service.listTestCases({
        projectId: args.projectId as string | undefined,
        status: args.status as any,
        type: args.type as any,
        priority: args.priority as any,
        taskId: args.taskId as string | undefined,
        search: args.search as string | undefined,
        page: args.page as number | undefined,
        pageSize: args.pageSize as number | undefined,
      });
    },

    create_test_execution: async (args: Record<string, unknown>) => {
      logger.info(`MCP: create_test_execution called for ${args.testCaseId}`);
      const execution = await service.createExecution({
        testCaseId: args.testCaseId as string,
        status: args.status as any,
        duration: args.duration as number | undefined,
        output: args.output as string | undefined,
        errorMessage: args.errorMessage as string | undefined,
        executedBy: args.executedBy as string | undefined,
        environment: args.environment as string | undefined,
      });
      return { success: true, execution };
    },

    create_test_suite: async (args: Record<string, unknown>) => {
      logger.info('MCP: create_test_suite called');
      const suite = await service.createSuite({
        projectId: args.projectId as string,
        name: args.name as string,
        description: args.description as string | undefined,
        testCaseIds: args.testCaseIds as string[] | undefined,
        createdBy: args.createdBy as string | undefined,
      });
      return { success: true, suite };
    },

    get_test_stats: async (args: Record<string, unknown>) => {
      logger.info(`MCP: get_test_stats called for project ${args.projectId}`);
      return service.getTestStats(args.projectId as string);
    },
  };
}
