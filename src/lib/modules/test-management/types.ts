// ============================================================
// Test Management Module - Type Definitions
// ============================================================

// --- Constants ---

export const TEST_TYPES = ['functional', 'unit', 'integration', 'e2e', 'performance'] as const;
export type TestType = (typeof TEST_TYPES)[number];

export const TEST_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
export type TestPriority = (typeof TEST_PRIORITIES)[number];

export const TEST_STATUSES = ['draft', 'ready', 'passed', 'failed', 'skipped', 'blocked'] as const;
export type TestStatus = (typeof TEST_STATUSES)[number];

export const EXECUTION_STATUSES = ['pending', 'running', 'passed', 'failed', 'skipped'] as const;
export type ExecutionStatus = (typeof EXECUTION_STATUSES)[number];

// --- DTOs ---

export interface CreateTestCaseInput {
  projectId: string;
  title: string;
  description?: string;
  type?: TestType;
  priority?: TestPriority;
  status?: TestStatus;
  taskId?: string;
  requirementId?: string;
  steps?: TestStep[];
  expectedResult?: string;
  createdBy?: string;
  aiGenerated?: boolean;
}

export interface UpdateTestCaseInput {
  title?: string;
  description?: string;
  type?: TestType;
  priority?: TestPriority;
  status?: TestStatus;
  taskId?: string | null;
  requirementId?: string | null;
  steps?: TestStep[];
  expectedResult?: string;
}

export interface TestFilter {
  projectId?: string;
  status?: TestStatus[];
  type?: TestType[];
  priority?: TestPriority[];
  taskId?: string;
  requirementId?: string;
  aiGenerated?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateTestExecutionInput {
  testCaseId: string;
  status?: ExecutionStatus;
  duration?: number;
  output?: string;
  errorMessage?: string;
  executedBy?: string;
  environment?: string;
}

export interface CreateTestSuiteInput {
  projectId: string;
  name: string;
  description?: string;
  testCaseIds?: string[];
  createdBy?: string;
}

// --- Test Step ---

export interface TestStep {
  order: number;
  action: string;
  expected: string;
}

// --- Stats ---

export interface TestStats {
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  passRate: number;
  recentExecutions: {
    total: number;
    passed: number;
    failed: number;
    avgDuration: number;
  };
}
