// ============================================================
// AI Requirement Analyzer - Rule-based analysis (NO API calls)
// ============================================================

export interface RequirementData {
  title: string;
  description: string;
  type: string;
  complexity?: string | null;
  priority?: number;
}

export interface AnalysisResult {
  complexity: 'low' | 'medium' | 'high' | 'critical';
  suggestedPriority: number;
  acceptanceCriteria: string[];
}

/**
 * Analyze requirement complexity based on description length, type, and keywords.
 * Pure rule-based logic - no AI API calls.
 */
export function analyzeComplexity(requirement: RequirementData): 'low' | 'medium' | 'high' | 'critical' {
  const { description, type } = requirement;
  const descLower = description.toLowerCase();

  // Bug with critical or security keywords -> critical
  if (type === 'bug') {
    if (descLower.includes('critical') || descLower.includes('security') || descLower.includes('vulnerability')) {
      return 'critical';
    }
  }

  // Epic -> high
  if (type === 'epic') {
    return 'high';
  }

  // Description > 1000 chars -> high
  if (description.length > 1000) {
    return 'high';
  }

  // Description > 500 chars -> medium
  if (description.length > 500) {
    return 'medium';
  }

  // Otherwise -> low
  return 'low';
}

/**
 * Suggest priority based on type and complexity.
 * Pure rule-based logic - no AI API calls.
 */
export function suggestPriority(requirement: RequirementData): number {
  const complexity = requirement.complexity || analyzeComplexity(requirement);
  const { type } = requirement;

  // Bug + critical complexity -> 5
  if (type === 'bug' && complexity === 'critical') {
    return 5;
  }

  // Feature + high complexity -> 4
  if (type === 'feature' && complexity === 'high') {
    return 4;
  }

  // Bug + high complexity -> 4
  if (type === 'bug' && complexity === 'high') {
    return 4;
  }

  // Epic -> 4
  if (type === 'epic') {
    return 4;
  }

  // Feature + medium complexity -> 3
  if (type === 'feature' && complexity === 'medium') {
    return 3;
  }

  // Improvement + high complexity -> 3
  if (type === 'improvement' && complexity === 'high') {
    return 3;
  }

  // Bug + medium complexity -> 3
  if (type === 'bug' && complexity === 'medium') {
    return 3;
  }

  // Feature + low complexity -> 2
  if (type === 'feature' && complexity === 'low') {
    return 2;
  }

  // Improvement + medium complexity -> 2
  if (type === 'improvement' && complexity === 'medium') {
    return 2;
  }

  // Bug + low complexity -> 2
  if (type === 'bug' && complexity === 'low') {
    return 2;
  }

  // Improvement + low complexity -> 1
  if (type === 'improvement' && complexity === 'low') {
    return 1;
  }

  // Default
  return 2;
}

/**
 * Generate template acceptance criteria based on requirement type.
 * Pure rule-based logic - no AI API calls.
 */
export function generateAcceptanceCriteria(requirement: RequirementData): string[] {
  const { type, title } = requirement;

  switch (type) {
    case 'feature':
      return [
        `用户能够完成"${title}"的核心功能操作`,
        `功能在正常使用场景下表现正确`,
        `功能在异常输入时有合理的错误处理`,
        `相关界面/交互符合设计规范`,
      ];

    case 'bug':
      return [
        `已确认的 bug 场景不再复现`,
        `修复未引入新的回归问题`,
        `相关边界条件已测试通过`,
      ];

    case 'improvement':
      return [
        `改进后的性能/体验有明显提升`,
        `现有功能行为未发生破坏性变更`,
        `改进方案经过验证和对比`,
      ];

    case 'epic':
      return [
        `所有子需求已定义并分配`,
        `整体架构设计已评审通过`,
        `关键里程碑和时间节点已确认`,
        `资源和技术方案已评估可行`,
      ];

    default:
      return [
        `需求已明确定义`,
        `实现方案已评审`,
        `测试用例已覆盖`,
      ];
  }
}

/**
 * Run a full analysis on a requirement.
 */
export function analyzeRequirement(requirement: RequirementData): AnalysisResult {
  return {
    complexity: analyzeComplexity(requirement),
    suggestedPriority: suggestPriority(requirement),
    acceptanceCriteria: generateAcceptanceCriteria(requirement),
  };
}
