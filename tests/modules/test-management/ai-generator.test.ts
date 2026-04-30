// ============================================================
// AI Generator Tests
// ============================================================

import { describe, it, expect } from 'vitest';
import { generateFromRequirement, generateTestSteps } from '@/lib/modules/test-management/ai-generator';

describe('AI Generator - generateFromRequirement', () => {
  const baseReq = {
    projectId: 'proj-1',
    title: 'User Login',
    description: 'Users should be able to log in with email and password',
  };

  it('should generate test cases for feature type', () => {
    const results = generateFromRequirement({ ...baseReq, type: 'feature' });

    expect(results).toHaveLength(3);
    expect(results[0].title).toContain('[正向]');
    expect(results[0].type).toBe('functional');
    expect(results[0].aiGenerated).toBe(true);
    expect(results[0].projectId).toBe('proj-1');

    expect(results[1].title).toContain('[反向]');
    expect(results[1].type).toBe('functional');

    expect(results[2].title).toContain('[边界]');
    expect(results[2].type).toBe('unit');
  });

  it('should generate test cases for bug type', () => {
    const results = generateFromRequirement({
      ...baseReq,
      type: 'bug',
      description: 'Login page crashes when password contains special characters',
    });

    expect(results).toHaveLength(2);
    expect(results[0].title).toContain('[回归]');
    expect(results[0].type).toBe('functional');

    expect(results[1].title).toContain('[关联]');
    expect(results[1].type).toBe('integration');
  });

  it('should generate test cases for improvement type', () => {
    const results = generateFromRequirement({
      ...baseReq,
      type: 'improvement',
      description: 'Optimize login page loading speed',
    });

    expect(results).toHaveLength(2);
    expect(results[0].title).toContain('[性能]');
    expect(results[0].type).toBe('performance');

    expect(results[1].title).toContain('[对比]');
    expect(results[1].type).toBe('functional');
  });

  it('should default to feature type when type is not specified', () => {
    const results = generateFromRequirement(baseReq);
    expect(results).toHaveLength(3);
    expect(results[0].title).toContain('[正向]');
  });

  it('should map requirement id to test cases', () => {
    const results = generateFromRequirement({ ...baseReq, id: 'req-123', type: 'feature' });
    for (const tc of results) {
      expect(tc.requirementId).toBe('req-123');
    }
  });

  it('should map priority correctly', () => {
    const highResults = generateFromRequirement({ ...baseReq, type: 'feature', priority: 'high' });
    expect(highResults[0].priority).toBe('high');

    const urgentResults = generateFromRequirement({ ...baseReq, type: 'feature', priority: 'urgent' });
    expect(urgentResults[0].priority).toBe('critical');

    const lowResults = generateFromRequirement({ ...baseReq, type: 'feature', priority: 'low' });
    expect(lowResults[0].priority).toBe('low');

    const defaultResults = generateFromRequirement({ ...baseReq, type: 'feature' });
    expect(defaultResults[0].priority).toBe('medium');
  });

  it('should include description in generated test cases', () => {
    const results = generateFromRequirement({
      ...baseReq,
      type: 'feature',
      description: 'Detailed requirement description',
    });

    expect(results[0].description).toContain('Detailed requirement description');
  });

  it('should handle missing description gracefully', () => {
    const results = generateFromRequirement({
      projectId: 'proj-1',
      title: 'No desc test',
      type: 'feature',
    });

    expect(results).toHaveLength(3);
    expect(results[0].description).toBeDefined();
  });
});

describe('AI Generator - generateTestSteps', () => {
  it('should generate steps for a functional test case', () => {
    const steps = generateTestSteps({
      title: 'Login functionality test',
      description: 'Test the login flow',
      type: 'functional',
    });

    expect(steps.length).toBeGreaterThanOrEqual(3);
    expect(steps[0].action).toContain('准备测试环境');
    expect(steps[steps.length - 1].action).toContain('清理测试数据');
  });

  it('should generate performance-specific steps', () => {
    const steps = generateTestSteps({
      title: '[性能] Login - 性能基准测试',
      type: 'performance',
    });

    expect(steps.length).toBeGreaterThanOrEqual(3);
    const hasPerfStep = steps.some((s) => s.action.includes('性能测试场景'));
    expect(hasPerfStep).toBe(true);
  });

  it('should generate regression-specific steps', () => {
    const steps = generateTestSteps({
      title: '[回归] Login bug - 回归测试',
      description: 'Bug fix regression',
    });

    expect(steps.length).toBeGreaterThanOrEqual(3);
    const hasReproStep = steps.some((s) => s.action.includes('复现'));
    expect(hasReproStep).toBe(true);
  });

  it('should generate negative test steps', () => {
    const steps = generateTestSteps({
      title: '[反向] Login - 异常输入处理',
      type: 'functional',
    });

    expect(steps.length).toBeGreaterThanOrEqual(3);
    const hasExceptionStep = steps.some((s) => s.action.includes('异常'));
    expect(hasExceptionStep).toBe(true);
  });

  it('should generate steps with correct order', () => {
    const steps = generateTestSteps({
      title: 'Some test',
    });

    for (let i = 0; i < steps.length; i++) {
      expect(steps[i].order).toBe(i + 1);
    }
  });

  it('should handle missing description', () => {
    const steps = generateTestSteps({
      title: 'Test without description',
    });

    expect(steps.length).toBeGreaterThanOrEqual(3);
  });
});
