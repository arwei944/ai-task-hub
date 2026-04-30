// ============================================================
// Phase Transition Rules
// ============================================================

import type { PhaseTransitionRule } from './types';
import { PHASES } from './types';

/**
 * Define the valid phase transition rules.
 * Each rule specifies the from/to phases, conditions that must be met,
 * automatic actions to perform, and whether approval is required.
 */
export const PHASE_TRANSITION_RULES: PhaseTransitionRule[] = [
  {
    from: 'requirements',
    to: 'planning',
    conditions: ['至少1个已确认需求'],
    autoActions: ['创建规划任务', '通知项目成员'],
    requireApproval: true,
  },
  {
    from: 'planning',
    to: 'architecture',
    conditions: ['至少1个已批准规划'],
    autoActions: ['创建架构设计任务', '更新项目时间线'],
    requireApproval: true,
  },
  {
    from: 'architecture',
    to: 'implementation',
    conditions: ['架构设计已批准', '任务已拆解'],
    autoActions: ['激活开发任务', '分配任务给团队成员'],
    requireApproval: true,
  },
  {
    from: 'implementation',
    to: 'testing',
    conditions: ['所有任务已完成或跳过'],
    autoActions: ['创建测试计划', '触发CI/CD流水线'],
    requireApproval: false,
  },
  {
    from: 'testing',
    to: 'deployment',
    conditions: ['测试通过率>=80%'],
    autoActions: ['准备部署清单', '通知运维团队'],
    requireApproval: true,
  },
  {
    from: 'deployment',
    to: 'completed',
    conditions: ['部署成功'],
    autoActions: ['更新项目状态', '发送完成通知', '归档项目文档'],
    requireApproval: false,
  },
];

/**
 * Get the transition rule for a given from/to phase pair.
 */
export function getTransitionRule(fromPhase: string, toPhase: string): PhaseTransitionRule | undefined {
  return PHASE_TRANSITION_RULES.find(
    (rule) => rule.from === fromPhase && rule.to === toPhase,
  );
}

/**
 * Check if a transition from one phase to another is valid (i.e., a rule exists).
 */
export function isValidTransition(fromPhase: string, toPhase: string): boolean {
  return getTransitionRule(fromPhase, toPhase) !== undefined;
}

/**
 * Get all valid next phases for a given current phase.
 */
export function getValidNextPhases(currentPhase: string): string[] {
  return PHASE_TRANSITION_RULES
    .filter((rule) => rule.from === currentPhase)
    .map((rule) => rule.to);
}

/**
 * Check if a phase string is a valid phase name.
 */
export function isValidPhase(phase: string): boolean {
  return (PHASES as readonly string[]).includes(phase);
}

/**
 * Get the index of a phase in the lifecycle order.
 * Returns -1 if the phase is not valid.
 */
export function getPhaseIndex(phase: string): number {
  return (PHASES as readonly string[]).indexOf(phase);
}
