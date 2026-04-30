// ============================================================
// Test Management Service Tests
// ============================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { join } from 'path';
import { existsSync, unlinkSync, mkdirSync } from 'fs';
import { Logger } from '@/lib/core/logger';
import { EventBus } from '@/lib/core/event-bus';
import { TestManagementService } from '@/lib/modules/test-management/test-management.service';

const TEST_DB_PATH = join(process.cwd(), 'test-db', 'test-test-mgmt.db');

function createTestPrisma(): PrismaClient {
  if (existsSync(TEST_DB_PATH)) {
    unlinkSync(TEST_DB_PATH);
  }
  const adapter = new PrismaBetterSqlite3({ url: TEST_DB_PATH });
  return new PrismaClient({ adapter });
}

let prisma: PrismaClient;
let service: TestManagementService;
let logger: Logger;
let eventBus: EventBus;
let projectId: string;

beforeEach(async () => {
  mkdirSync(join(process.cwd(), 'test-db'), { recursive: true });
  prisma = createTestPrisma();

  // Push schema
  const { execSync } = require('child_process');
  execSync(`npx prisma db push --url "file:${TEST_DB_PATH}" --accept-data-loss 2>&1`, {
    stdio: 'pipe',
    cwd: process.cwd(),
  });

  logger = new Logger('test');
  eventBus = new EventBus();
  service = new TestManagementService(logger, eventBus, () => prisma);

  // Create a project for testing
  const project = await prisma.project.create({
    data: {
      name: 'Test Project',
      description: 'For testing',
    },
  });
  projectId = project.id;
});

afterEach(async () => {
  await prisma.$disconnect();
  if (existsSync(TEST_DB_PATH)) {
    unlinkSync(TEST_DB_PATH);
  }
});

// ==================== Test Case CRUD ====================

describe('TestManagementService - TestCase CRUD', () => {
  it('should create a test case', async () => {
    const tc = await service.createTestCase({
      projectId,
      title: 'Login test',
      description: 'Test login functionality',
      type: 'functional',
      priority: 'high',
    });

    expect(tc.id).toBeDefined();
    expect(tc.title).toBe('Login test');
    expect(tc.type).toBe('functional');
    expect(tc.priority).toBe('high');
    expect(tc.status).toBe('draft');
    expect(tc.projectId).toBe(projectId);
  });

  it('should get a test case by id', async () => {
    const created = await service.createTestCase({
      projectId,
      title: 'Get test',
    });

    const fetched = await service.getTestCase(created.id);
    expect(fetched).toBeDefined();
    expect(fetched!.id).toBe(created.id);
    expect(fetched!.title).toBe('Get test');
  });

  it('should return null for non-existent test case', async () => {
    const fetched = await service.getTestCase('non-existent-id');
    expect(fetched).toBeNull();
  });

  it('should update a test case', async () => {
    const created = await service.createTestCase({
      projectId,
      title: 'Update test',
      status: 'draft',
    });

    const updated = await service.updateTestCase(created.id, {
      title: 'Updated title',
      status: 'ready',
      priority: 'critical',
    });

    expect(updated.title).toBe('Updated title');
    expect(updated.status).toBe('ready');
    expect(updated.priority).toBe('critical');
  });

  it('should throw when updating non-existent test case', async () => {
    await expect(
      service.updateTestCase('non-existent', { title: 'fail' }),
    ).rejects.toThrow('TestCase not found');
  });

  it('should delete a test case', async () => {
    const created = await service.createTestCase({
      projectId,
      title: 'Delete me',
    });

    await service.deleteTestCase(created.id);
    const fetched = await service.getTestCase(created.id);
    expect(fetched).toBeNull();
  });

  it('should throw when deleting non-existent test case', async () => {
    await expect(service.deleteTestCase('non-existent')).rejects.toThrow('TestCase not found');
  });

  it('should list test cases with filter', async () => {
    await service.createTestCase({ projectId, title: 'TC1', type: 'functional', status: 'draft' });
    await service.createTestCase({ projectId, title: 'TC2', type: 'unit', status: 'ready' });
    await service.createTestCase({ projectId, title: 'TC3', type: 'functional', status: 'passed' });

    // Filter by type
    const functional = await service.listTestCases({ projectId, type: ['functional'] });
    expect(functional.items).toHaveLength(2);

    // Filter by status
    const draft = await service.listTestCases({ projectId, status: ['draft'] });
    expect(draft.items).toHaveLength(1);

    // No filter
    const all = await service.listTestCases({ projectId });
    expect(all.items).toHaveLength(3);
    expect(all.total).toBe(3);
  });

  it('should search test cases', async () => {
    await service.createTestCase({ projectId, title: 'Login functionality test' });
    await service.createTestCase({ projectId, title: 'Logout test' });

    const results = await service.listTestCases({ projectId, search: 'Login' });
    expect(results.items).toHaveLength(1);
    expect(results.items[0].title).toContain('Login');
  });
});

// ==================== Test Execution ====================

describe('TestManagementService - Test Execution', () => {
  it('should create a test execution', async () => {
    const tc = await service.createTestCase({ projectId, title: 'Exec test' });

    const execution = await service.createExecution({
      testCaseId: tc.id,
      status: 'passed',
      duration: 1500,
      executedBy: 'tester-1',
      environment: 'local',
    });

    expect(execution.id).toBeDefined();
    expect(execution.testCaseId).toBe(tc.id);
    expect(execution.status).toBe('passed');
    expect(execution.duration).toBe(1500);
  });

  it('should throw when creating execution for non-existent test case', async () => {
    await expect(
      service.createExecution({ testCaseId: 'non-existent' }),
    ).rejects.toThrow('TestCase not found');
  });

  it('should update test case status on passed execution', async () => {
    const tc = await service.createTestCase({ projectId, title: 'Status update test' });
    expect(tc.status).toBe('draft');

    await service.createExecution({
      testCaseId: tc.id,
      status: 'passed',
    });

    const updated = await service.getTestCase(tc.id);
    expect(updated!.status).toBe('passed');
  });

  it('should update test case status on failed execution', async () => {
    const tc = await service.createTestCase({ projectId, title: 'Fail test' });

    await service.createExecution({
      testCaseId: tc.id,
      status: 'failed',
      errorMessage: 'Assertion failed',
    });

    const updated = await service.getTestCase(tc.id);
    expect(updated!.status).toBe('failed');
  });

  it('should list executions for a test case', async () => {
    const tc = await service.createTestCase({ projectId, title: 'List exec test' });

    await service.createExecution({ testCaseId: tc.id, status: 'passed' });
    await service.createExecution({ testCaseId: tc.id, status: 'failed' });
    await service.createExecution({ testCaseId: tc.id, status: 'passed' });

    const result = await service.listExecutions(tc.id);
    expect(result.items).toHaveLength(3);
    expect(result.total).toBe(3);
  });

  it('should get execution by id', async () => {
    const tc = await service.createTestCase({ projectId, title: 'Get exec test' });
    const exec = await service.createExecution({ testCaseId: tc.id, status: 'passed' });

    const fetched = await service.getExecution(exec.id);
    expect(fetched).toBeDefined();
    expect(fetched!.id).toBe(exec.id);
    expect(fetched!.testCase.id).toBe(tc.id);
  });
});

// ==================== Test Suite ====================

describe('TestManagementService - Test Suite', () => {
  it('should create a test suite', async () => {
    const suite = await service.createSuite({
      projectId,
      name: 'Smoke Tests',
      description: 'Basic smoke test suite',
      testCaseIds: ['tc-1', 'tc-2'],
    });

    expect(suite.id).toBeDefined();
    expect(suite.name).toBe('Smoke Tests');
    expect(suite.projectId).toBe(projectId);
    const ids = JSON.parse(suite.testCaseIds);
    expect(ids).toEqual(['tc-1', 'tc-2']);
  });

  it('should get a suite by id', async () => {
    const created = await service.createSuite({ projectId, name: 'Get Suite' });
    const fetched = await service.getSuite(created.id);
    expect(fetched).toBeDefined();
    expect(fetched!.name).toBe('Get Suite');
  });

  it('should list suites by project', async () => {
    await service.createSuite({ projectId, name: 'Suite 1' });
    await service.createSuite({ projectId, name: 'Suite 2' });

    const suites = await service.listSuites(projectId);
    expect(suites).toHaveLength(2);
  });

  it('should add test case to suite', async () => {
    const suite = await service.createSuite({ projectId, name: 'Add Test Suite', testCaseIds: ['tc-1'] });

    const updated = await service.addTestCaseToSuite(suite.id, 'tc-2');
    const ids = JSON.parse(updated!.testCaseIds);
    expect(ids).toContain('tc-1');
    expect(ids).toContain('tc-2');
  });

  it('should not duplicate test case in suite', async () => {
    const suite = await service.createSuite({ projectId, name: 'Dup Suite', testCaseIds: ['tc-1'] });

    const updated = await service.addTestCaseToSuite(suite.id, 'tc-1');
    const ids = JSON.parse(updated!.testCaseIds);
    expect(ids).toEqual(['tc-1']);
  });

  it('should remove test case from suite', async () => {
    const suite = await service.createSuite({ projectId, name: 'Remove Suite', testCaseIds: ['tc-1', 'tc-2'] });

    const updated = await service.removeTestCaseFromSuite(suite.id, 'tc-1');
    const ids = JSON.parse(updated!.testCaseIds);
    expect(ids).toEqual(['tc-2']);
  });

  it('should throw when adding to non-existent suite', async () => {
    await expect(
      service.addTestCaseToSuite('non-existent', 'tc-1'),
    ).rejects.toThrow('TestSuite not found');
  });
});

// ==================== Stats ====================

describe('TestManagementService - Stats', () => {
  it('should return empty stats for project with no test cases', async () => {
    const stats = await service.getTestStats(projectId);
    expect(stats.total).toBe(0);
    expect(stats.byStatus).toEqual({});
    expect(stats.byType).toEqual({});
    expect(stats.passRate).toBe(0);
    expect(stats.recentExecutions.total).toBe(0);
  });

  it('should return correct stats', async () => {
    const tc1 = await service.createTestCase({ projectId, title: 'TC1', type: 'functional', status: 'passed' });
    const tc2 = await service.createTestCase({ projectId, title: 'TC2', type: 'unit', status: 'failed' });
    const tc3 = await service.createTestCase({ projectId, title: 'TC3', type: 'functional', status: 'draft' });

    await service.createExecution({ testCaseId: tc1.id, status: 'passed', duration: 100 });
    await service.createExecution({ testCaseId: tc2.id, status: 'failed', duration: 200 });

    const stats = await service.getTestStats(projectId);

    expect(stats.total).toBe(3);
    expect(stats.byStatus.passed).toBe(1);
    expect(stats.byStatus.failed).toBe(1);
    expect(stats.byStatus.draft).toBe(1);
    expect(stats.byType.functional).toBe(2);
    expect(stats.byType.unit).toBe(1);
    expect(stats.passRate).toBeCloseTo(1 / 3);
    expect(stats.recentExecutions.total).toBe(2);
    expect(stats.recentExecutions.passed).toBe(1);
    expect(stats.recentExecutions.failed).toBe(1);
    expect(stats.recentExecutions.avgDuration).toBe(150);
  });
});
