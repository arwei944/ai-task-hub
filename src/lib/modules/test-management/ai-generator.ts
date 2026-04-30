// ============================================================
// AI Test Case Generator (Rule-based, no API calls)
// ============================================================

import type { CreateTestCaseInput, TestStep } from './types';

interface Requirement {
  id?: string;
  title: string;
  description?: string;
  type?: string; // feature, bug, improvement
  projectId: string;
  priority?: string;
}

/**
 * Generate test cases from a requirement using rule-based logic.
 * No AI API calls - purely deterministic generation.
 */
export function generateFromRequirement(requirement: Requirement): CreateTestCaseInput[] {
  const reqType = requirement.type ?? 'feature';
  const title = requirement.title;
  const description = requirement.description ?? '';

  switch (reqType) {
    case 'feature':
      return generateFeatureTestCases(requirement);
    case 'bug':
      return generateBugTestCases(requirement);
    case 'improvement':
      return generateImprovementTestCases(requirement);
    default:
      return generateFeatureTestCases(requirement);
  }
}

/**
 * Generate positive and negative test cases for a feature requirement.
 */
function generateFeatureTestCases(requirement: Requirement): CreateTestCaseInput[] {
  const testCases: CreateTestCaseInput[] = [];

  // Positive test case
  testCases.push({
    projectId: requirement.projectId,
    title: `[正向] ${requirement.title} - 正常流程验证`,
    description: `验证 ${requirement.title} 功能的正常使用流程。${requirement.description ? '\n需求描述: ' + requirement.description : ''}`,
    type: 'functional',
    priority: mapPriority(requirement.priority),
    status: 'draft',
    requirementId: requirement.id,
    expectedResult: `功能按预期正常工作，${requirement.title} 相关操作成功完成。`,
    aiGenerated: true,
  });

  // Negative test case
  testCases.push({
    projectId: requirement.projectId,
    title: `[反向] ${requirement.title} - 异常输入处理`,
    description: `验证 ${requirement.title} 在异常输入情况下的容错处理。`,
    type: 'functional',
    priority: mapPriority(requirement.priority),
    status: 'draft',
    requirementId: requirement.id,
    expectedResult: `系统应给出友好的错误提示，不应崩溃或产生数据异常。`,
    aiGenerated: true,
  });

  // Edge case test
  testCases.push({
    projectId: requirement.projectId,
    title: `[边界] ${requirement.title} - 边界条件测试`,
    description: `验证 ${requirement.title} 在边界条件下的行为（空值、最大值、最小值等）。`,
    type: 'unit',
    priority: 'medium',
    status: 'draft',
    requirementId: requirement.id,
    expectedResult: `边界条件下系统行为符合预期，无异常。`,
    aiGenerated: true,
  });

  return testCases;
}

/**
 * Generate regression test case for a bug requirement.
 */
function generateBugTestCases(requirement: Requirement): CreateTestCaseInput[] {
  const testCases: CreateTestCaseInput[] = [];

  // Regression test
  testCases.push({
    projectId: requirement.projectId,
    title: `[回归] ${requirement.title} - 回归测试`,
    description: `验证 ${requirement.title} bug 已修复，且修复未引入新的问题。\nBug 描述: ${requirement.description ?? '无详细描述'}`,
    type: 'functional',
    priority: mapPriority(requirement.priority) === 'low' ? 'medium' : mapPriority(requirement.priority),
    status: 'draft',
    requirementId: requirement.id,
    expectedResult: `Bug 已修复，相关功能正常运行，无回归问题。`,
    aiGenerated: true,
  });

  // Related scenario test
  testCases.push({
    projectId: requirement.projectId,
    title: `[关联] ${requirement.title} - 关联场景验证`,
    description: `验证与 ${requirement.title} bug 相关的其他场景是否受影响。`,
    type: 'integration',
    priority: 'medium',
    status: 'draft',
    requirementId: requirement.id,
    expectedResult: `关联场景功能正常，未受 bug 修复影响。`,
    aiGenerated: true,
  });

  return testCases;
}

/**
 * Generate performance test case for an improvement requirement.
 */
function generateImprovementTestCases(requirement: Requirement): CreateTestCaseInput[] {
  const testCases: CreateTestCaseInput[] = [];

  // Performance test
  testCases.push({
    projectId: requirement.projectId,
    title: `[性能] ${requirement.title} - 性能基准测试`,
    description: `验证 ${requirement.title} 改进后的性能指标是否达标。\n改进描述: ${requirement.description ?? '无详细描述'}`,
    type: 'performance',
    priority: mapPriority(requirement.priority),
    status: 'draft',
    requirementId: requirement.id,
    expectedResult: `性能指标达到预期标准，响应时间在可接受范围内。`,
    aiGenerated: true,
  });

  // Comparison test
  testCases.push({
    projectId: requirement.projectId,
    title: `[对比] ${requirement.title} - 改进前后对比测试`,
    description: `对比 ${requirement.title} 改进前后的功能表现，确保改进未降低原有功能质量。`,
    type: 'functional',
    priority: 'medium',
    status: 'draft',
    requirementId: requirement.id,
    expectedResult: `改进后功能表现优于或等于改进前，无功能退化。`,
    aiGenerated: true,
  });

  return testCases;
}

/**
 * Generate test steps based on test case description.
 * Rule-based generation from the description keywords.
 */
export function generateTestSteps(testCase: {
  title: string;
  description?: string;
  type?: string;
}): TestStep[] {
  const steps: TestStep[] = [];
  const desc = testCase.description ?? '';
  const title = testCase.title;

  // Common setup step
  steps.push({
    order: 1,
    action: '准备测试环境和测试数据',
    expected: '测试环境就绪，测试数据已初始化',
  });

  // Generate type-specific steps
  if (testCase.type === 'performance') {
    steps.push({
      order: 2,
      action: `执行 ${title} 的性能测试场景`,
      expected: '测试执行完成，收集到性能指标数据',
    });
    steps.push({
      order: 3,
      action: '分析性能指标（响应时间、吞吐量等）',
      expected: '性能指标在可接受范围内',
    });
  } else if (testCase.title.includes('回归') || testCase.title.includes('bug') || testCase.title.includes('Bug')) {
    steps.push({
      order: 2,
      action: `复现 ${title} 描述的 bug 场景`,
      expected: 'Bug 不再出现，功能正常',
    });
    steps.push({
      order: 3,
      action: '验证相关功能是否受影响',
      expected: '相关功能正常，无回归问题',
    });
  } else if (testCase.title.includes('反向') || testCase.title.includes('异常')) {
    steps.push({
      order: 2,
      action: `输入异常数据或执行异常操作`,
      expected: '系统给出正确的错误提示',
    });
    steps.push({
      order: 3,
      action: '验证系统状态未受异常影响',
      expected: '系统状态正常，数据完整',
    });
  } else {
    // Default functional test steps
    steps.push({
      order: 2,
      action: `执行 ${title} 的主要操作流程`,
      expected: '操作成功完成，结果符合预期',
    });
    steps.push({
      order: 3,
      action: '验证操作结果和系统状态',
      expected: '结果正确，系统状态一致',
    });
  }

  // Common cleanup step
  steps.push({
    order: steps.length + 1,
    action: '清理测试数据和恢复环境',
    expected: '测试数据已清理，环境已恢复',
  });

  return steps;
}

// ==================== Helpers ====================

function mapPriority(priority?: string): 'low' | 'medium' | 'high' | 'critical' {
  switch (priority) {
    case 'urgent':
    case 'critical':
      return 'critical';
    case 'high':
      return 'high';
    case 'low':
      return 'low';
    default:
      return 'medium';
  }
}
