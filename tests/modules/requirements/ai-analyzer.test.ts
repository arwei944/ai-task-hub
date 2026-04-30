import { describe, it, expect } from 'vitest';
import {
  analyzeComplexity,
  suggestPriority,
  generateAcceptanceCriteria,
  analyzeRequirement,
} from '@/lib/modules/requirements/ai-analyzer';
import type { RequirementData } from '@/lib/modules/requirements/ai-analyzer';

// ================================================================
// Complexity Analysis
// ================================================================

describe('analyzeComplexity', () => {
  it('should return critical for bug with "critical" keyword', () => {
    const req: RequirementData = {
      title: 'Auth Bug',
      description: 'Critical authentication failure',
      type: 'bug',
    };
    expect(analyzeComplexity(req)).toBe('critical');
  });

  it('should return critical for bug with "security" keyword', () => {
    const req: RequirementData = {
      title: 'Security Bug',
      description: 'Security vulnerability in login',
      type: 'bug',
    };
    expect(analyzeComplexity(req)).toBe('critical');
  });

  it('should return critical for bug with "vulnerability" keyword', () => {
    const req: RequirementData = {
      title: 'Vuln Bug',
      description: 'Vulnerability found in API',
      type: 'bug',
    };
    expect(analyzeComplexity(req)).toBe('critical');
  });

  it('should return high for epic type', () => {
    const req: RequirementData = {
      title: 'User System Epic',
      description: 'Short desc',
      type: 'epic',
    };
    expect(analyzeComplexity(req)).toBe('high');
  });

  it('should return high for description > 1000 chars', () => {
    const req: RequirementData = {
      title: 'Long Feature',
      description: 'A'.repeat(1001),
      type: 'feature',
    };
    expect(analyzeComplexity(req)).toBe('high');
  });

  it('should return medium for description > 500 chars', () => {
    const req: RequirementData = {
      title: 'Medium Feature',
      description: 'A'.repeat(501),
      type: 'feature',
    };
    expect(analyzeComplexity(req)).toBe('medium');
  });

  it('should return low for short description', () => {
    const req: RequirementData = {
      title: 'Simple Feature',
      description: 'A simple feature',
      type: 'feature',
    };
    expect(analyzeComplexity(req)).toBe('low');
  });

  it('should return low for bug without critical keywords', () => {
    const req: RequirementData = {
      title: 'Minor Bug',
      description: 'Small UI bug',
      type: 'bug',
    };
    expect(analyzeComplexity(req)).toBe('low');
  });

  it('should return low for improvement with short description', () => {
    const req: RequirementData = {
      title: 'Small Improvement',
      description: 'Minor tweak',
      type: 'improvement',
    };
    expect(analyzeComplexity(req)).toBe('low');
  });
});

// ================================================================
// Priority Suggestion
// ================================================================

describe('suggestPriority', () => {
  it('should return 5 for bug + critical complexity', () => {
    const req: RequirementData = {
      title: 'Critical Bug',
      description: 'Critical security issue',
      type: 'bug',
      complexity: 'critical',
    };
    expect(suggestPriority(req)).toBe(5);
  });

  it('should return 4 for feature + high complexity', () => {
    const req: RequirementData = {
      title: 'Big Feature',
      description: 'Complex feature',
      type: 'feature',
      complexity: 'high',
    };
    expect(suggestPriority(req)).toBe(4);
  });

  it('should return 4 for bug + high complexity', () => {
    const req: RequirementData = {
      title: 'Major Bug',
      description: 'Major bug',
      type: 'bug',
      complexity: 'high',
    };
    expect(suggestPriority(req)).toBe(4);
  });

  it('should return 4 for epic type', () => {
    const req: RequirementData = {
      title: 'Epic',
      description: 'Epic desc',
      type: 'epic',
    };
    expect(suggestPriority(req)).toBe(4);
  });

  it('should return 3 for feature + medium complexity', () => {
    const req: RequirementData = {
      title: 'Medium Feature',
      description: 'Medium desc',
      type: 'feature',
      complexity: 'medium',
    };
    expect(suggestPriority(req)).toBe(3);
  });

  it('should return 3 for improvement + high complexity', () => {
    const req: RequirementData = {
      title: 'Big Improvement',
      description: 'Big improvement',
      type: 'improvement',
      complexity: 'high',
    };
    expect(suggestPriority(req)).toBe(3);
  });

  it('should return 2 for feature + low complexity', () => {
    const req: RequirementData = {
      title: 'Simple Feature',
      description: 'Simple desc',
      type: 'feature',
      complexity: 'low',
    };
    expect(suggestPriority(req)).toBe(2);
  });

  it('should return 1 for improvement + low complexity', () => {
    const req: RequirementData = {
      title: 'Small Improvement',
      description: 'Small improvement',
      type: 'improvement',
      complexity: 'low',
    };
    expect(suggestPriority(req)).toBe(1);
  });

  it('should auto-detect complexity when not provided', () => {
    const req: RequirementData = {
      title: 'Auto Detect',
      description: 'A'.repeat(1001),
      type: 'feature',
    };
    // Auto-detected complexity should be 'high' (desc > 1000)
    // feature + high = 4
    expect(suggestPriority(req)).toBe(4);
  });

  it('should return 2 as default', () => {
    const req: RequirementData = {
      title: 'Default',
      description: 'Default desc',
      type: 'unknown-type',
    };
    expect(suggestPriority(req)).toBe(2);
  });
});

// ================================================================
// Acceptance Criteria Generation
// ================================================================

describe('generateAcceptanceCriteria', () => {
  it('should generate feature acceptance criteria', () => {
    const req: RequirementData = {
      title: 'User Login',
      description: 'Login feature',
      type: 'feature',
    };

    const criteria = generateAcceptanceCriteria(req);
    expect(criteria).toHaveLength(4);
    expect(criteria[0]).toContain('User Login');
    expect(criteria[0]).toContain('核心功能操作');
  });

  it('should generate bug acceptance criteria', () => {
    const req: RequirementData = {
      title: 'Login Bug',
      description: 'Login bug',
      type: 'bug',
    };

    const criteria = generateAcceptanceCriteria(req);
    expect(criteria).toHaveLength(3);
    expect(criteria[0]).toContain('不再复现');
    expect(criteria[1]).toContain('回归问题');
  });

  it('should generate improvement acceptance criteria', () => {
    const req: RequirementData = {
      title: 'Performance Improvement',
      description: 'Speed up API',
      type: 'improvement',
    };

    const criteria = generateAcceptanceCriteria(req);
    expect(criteria).toHaveLength(3);
    expect(criteria[0]).toContain('性能');
    expect(criteria[0]).toContain('提升');
  });

  it('should generate epic acceptance criteria', () => {
    const req: RequirementData = {
      title: 'User System Epic',
      description: 'User system',
      type: 'epic',
    };

    const criteria = generateAcceptanceCriteria(req);
    expect(criteria).toHaveLength(4);
    expect(criteria[0]).toContain('子需求');
    expect(criteria[1]).toContain('架构设计');
  });

  it('should generate default acceptance criteria for unknown type', () => {
    const req: RequirementData = {
      title: 'Unknown Type',
      description: 'Unknown',
      type: 'unknown',
    };

    const criteria = generateAcceptanceCriteria(req);
    expect(criteria).toHaveLength(3);
    expect(criteria[0]).toContain('明确定义');
  });
});

// ================================================================
// Full Analysis
// ================================================================

describe('analyzeRequirement', () => {
  it('should return complete analysis result', () => {
    const req: RequirementData = {
      title: 'Critical Security Bug',
      description: 'Critical security vulnerability in authentication',
      type: 'bug',
    };

    const result = analyzeRequirement(req);
    expect(result).toHaveProperty('complexity');
    expect(result).toHaveProperty('suggestedPriority');
    expect(result).toHaveProperty('acceptanceCriteria');
    expect(result.complexity).toBe('critical');
    expect(result.suggestedPriority).toBe(5);
    expect(result.acceptanceCriteria).toHaveLength(3);
  });

  it('should analyze feature with long description', () => {
    const req: RequirementData = {
      title: 'Complex Feature',
      description: 'A'.repeat(1001),
      type: 'feature',
    };

    const result = analyzeRequirement(req);
    expect(result.complexity).toBe('high');
    expect(result.suggestedPriority).toBe(4);
  });
});
