// ============================================================
// Test Management Service
// ============================================================

import type { PrismaClient } from '@/generated/prisma/client';
import type { ILogger, IEventBus } from '@/lib/core/types';
import type {
  CreateTestCaseInput,
  UpdateTestCaseInput,
  TestFilter,
  CreateTestExecutionInput,
  CreateTestSuiteInput,
  TestStats,
  TestStep,
} from './types';

type PrismaFn = () => PrismaClient;

export class TestManagementService {
  constructor(
    private logger: ILogger,
    private eventBus?: IEventBus,
    private prismaFn?: PrismaFn,
  ) {}

  private get prisma(): PrismaClient {
    if (this.prismaFn) return this.prismaFn();
    // Fallback: dynamic import
    const { getPrisma } = require('@/lib/db');
    return getPrisma();
  }

  // ==================== Test Case CRUD ====================

  async createTestCase(input: CreateTestCaseInput) {
    this.logger.info(`Creating test case: ${input.title}`);
    const stepsJson = input.steps ? JSON.stringify(input.steps) : undefined;

    const testCase = await this.prisma.testCase.create({
      data: {
        projectId: input.projectId,
        title: input.title,
        description: input.description,
        type: input.type ?? 'functional',
        priority: input.priority ?? 'medium',
        status: input.status ?? 'draft',
        taskId: input.taskId,
        requirementId: input.requirementId,
        steps: stepsJson,
        expectedResult: input.expectedResult,
        createdBy: input.createdBy,
        aiGenerated: input.aiGenerated ?? false,
      },
    });

    this.emitEvent('test_case.created', { testCaseId: testCase.id, projectId: input.projectId });
    return testCase;
  }

  async getTestCase(id: string) {
    return this.prisma.testCase.findUnique({
      where: { id },
      include: { executions: { orderBy: { createdAt: 'desc' } } },
    });
  }

  async updateTestCase(id: string, input: UpdateTestCaseInput) {
    this.logger.info(`Updating test case ${id}`);
    const existing = await this.prisma.testCase.findUnique({ where: { id } });
    if (!existing) throw new Error(`TestCase not found: ${id}`);

    const data: Record<string, unknown> = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) data.description = input.description;
    if (input.type !== undefined) data.type = input.type;
    if (input.priority !== undefined) data.priority = input.priority;
    if (input.status !== undefined) data.status = input.status;
    if (input.taskId !== undefined) data.taskId = input.taskId;
    if (input.requirementId !== undefined) data.requirementId = input.requirementId;
    if (input.steps !== undefined) data.steps = JSON.stringify(input.steps);
    if (input.expectedResult !== undefined) data.expectedResult = input.expectedResult;

    const updated = await this.prisma.testCase.update({
      where: { id },
      data,
    });

    this.emitEvent('test_case.updated', { testCaseId: id, projectId: existing.projectId });
    return updated;
  }

  async deleteTestCase(id: string) {
    this.logger.info(`Deleting test case ${id}`);
    const existing = await this.prisma.testCase.findUnique({ where: { id } });
    if (!existing) throw new Error(`TestCase not found: ${id}`);

    await this.prisma.testCase.delete({ where: { id } });
    this.emitEvent('test_case.deleted', { testCaseId: id, projectId: existing.projectId });
  }

  async listTestCases(filter: TestFilter) {
    const where: Record<string, unknown> = {};
    if (filter.projectId) where.projectId = filter.projectId;
    if (filter.status?.length) where.status = { in: filter.status };
    if (filter.type?.length) where.type = { in: filter.type };
    if (filter.priority?.length) where.priority = { in: filter.priority };
    if (filter.taskId) where.taskId = filter.taskId;
    if (filter.requirementId) where.requirementId = filter.requirementId;
    if (filter.aiGenerated !== undefined) where.aiGenerated = filter.aiGenerated;
    if (filter.search) {
      where.OR = [
        { title: { contains: filter.search } },
        { description: { contains: filter.search } },
      ];
    }

    const page = filter.page ?? 1;
    const pageSize = Math.min(filter.pageSize ?? 20, 100);

    const [items, total] = await Promise.all([
      this.prisma.testCase.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.testCase.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // ==================== Test Execution ====================

  async createExecution(input: CreateTestExecutionInput) {
    this.logger.info(`Creating test execution for ${input.testCaseId}`);
    const testCase = await this.prisma.testCase.findUnique({ where: { id: input.testCaseId } });
    if (!testCase) throw new Error(`TestCase not found: ${input.testCaseId}`);

    const execution = await this.prisma.testExecution.create({
      data: {
        testCaseId: input.testCaseId,
        status: input.status ?? 'pending',
        duration: input.duration,
        output: input.output,
        errorMessage: input.errorMessage,
        executedBy: input.executedBy,
        environment: input.environment,
      },
    });

    // Update test case status based on latest execution
    if (input.status === 'passed' || input.status === 'failed') {
      await this.prisma.testCase.update({
        where: { id: input.testCaseId },
        data: { status: input.status === 'passed' ? 'passed' : 'failed' },
      });
    }

    this.emitEvent('test_execution.created', {
      executionId: execution.id,
      testCaseId: input.testCaseId,
      status: execution.status,
    });
    return execution;
  }

  async getExecution(id: string) {
    return this.prisma.testExecution.findUnique({
      where: { id },
      include: { testCase: true },
    });
  }

  async listExecutions(testCaseId: string, options?: { page?: number; pageSize?: number }) {
    const page = options?.page ?? 1;
    const pageSize = Math.min(options?.pageSize ?? 20, 100);

    const [items, total] = await Promise.all([
      this.prisma.testExecution.findMany({
        where: { testCaseId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.testExecution.count({ where: { testCaseId } }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  // ==================== Test Suite ====================

  async createSuite(input: CreateTestSuiteInput) {
    this.logger.info(`Creating test suite: ${input.name}`);
    const testCaseIds = input.testCaseIds ?? [];

    const suite = await this.prisma.testSuite.create({
      data: {
        projectId: input.projectId,
        name: input.name,
        description: input.description,
        testCaseIds: JSON.stringify(testCaseIds),
        createdBy: input.createdBy,
      },
    });

    this.emitEvent('test_suite.created', { suiteId: suite.id, projectId: input.projectId });
    return suite;
  }

  async getSuite(id: string) {
    return this.prisma.testSuite.findUnique({ where: { id } });
  }

  async listSuites(projectId: string) {
    return this.prisma.testSuite.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addTestCaseToSuite(suiteId: string, testCaseId: string) {
    this.logger.info(`Adding test case ${testCaseId} to suite ${suiteId}`);
    const suite = await this.prisma.testSuite.findUnique({ where: { id: suiteId } });
    if (!suite) throw new Error(`TestSuite not found: ${suiteId}`);

    const ids: string[] = JSON.parse(suite.testCaseIds);
    if (!ids.includes(testCaseId)) {
      ids.push(testCaseId);
      await this.prisma.testSuite.update({
        where: { id: suiteId },
        data: { testCaseIds: JSON.stringify(ids) },
      });
    }

    return this.prisma.testSuite.findUnique({ where: { id: suiteId } });
  }

  async removeTestCaseFromSuite(suiteId: string, testCaseId: string) {
    this.logger.info(`Removing test case ${testCaseId} from suite ${suiteId}`);
    const suite = await this.prisma.testSuite.findUnique({ where: { id: suiteId } });
    if (!suite) throw new Error(`TestSuite not found: ${suiteId}`);

    const ids: string[] = JSON.parse(suite.testCaseIds);
    const filtered = ids.filter((id) => id !== testCaseId);

    await this.prisma.testSuite.update({
      where: { id: suiteId },
      data: { testCaseIds: JSON.stringify(filtered) },
    });

    return this.prisma.testSuite.findUnique({ where: { id: suiteId } });
  }

  // ==================== Stats ====================

  async getTestStats(projectId: string): Promise<TestStats> {
    const testCases = await this.prisma.testCase.findMany({
      where: { projectId },
    });

    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    let passedCount = 0;

    for (const tc of testCases) {
      byStatus[tc.status] = (byStatus[tc.status] ?? 0) + 1;
      byType[tc.type] = (byType[tc.type] ?? 0) + 1;
      if (tc.status === 'passed') passedCount++;
    }

    // Get execution stats
    const testCaseIds = testCases.map((tc) => tc.id);
    const executions =
      testCaseIds.length > 0
        ? await this.prisma.testExecution.findMany({
            where: { testCaseId: { in: testCaseIds } },
          })
        : [];

    const totalExecutions = executions.length;
    const passedExecutions = executions.filter((e: any) => e.status === 'passed').length;
    const failedExecutions = executions.filter((e: any) => e.status === 'failed').length;
    const durationsWithValues = executions.filter((e: any) => e.duration != null);
    const avgDuration =
      durationsWithValues.length > 0
        ? Math.round(durationsWithValues.reduce((sum: any, e: any) => sum + (e.duration ?? 0), 0) / durationsWithValues.length)
        : 0;

    return {
      total: testCases.length,
      byStatus,
      byType,
      passRate: testCases.length > 0 ? Math.round((passedCount / testCases.length) * 100) / 100 : 0,
      recentExecutions: {
        total: totalExecutions,
        passed: passedExecutions,
        failed: failedExecutions,
        avgDuration,
      },
    };
  }

  // ==================== Helpers ====================

  private emitEvent(type: string, payload: unknown) {
    if (!this.eventBus) return;
    this.eventBus.emit({
      type,
      payload,
      timestamp: new Date(),
      source: 'test-management',
    });
  }
}
