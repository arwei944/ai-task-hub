// ============================================================
// Lifecycle Service - Core service for project phase management
// ============================================================

import { getPrisma } from '@/lib/db';
import type { ILogger, IEventBus, DomainEvent } from '@/lib/core/types';
import type {
  PhaseTransitionInput,
  PhaseTransitionResult,
  PhaseValidation,
} from './types';
import {
  getTransitionRule,
  isValidTransition,
  isValidPhase,
  getValidNextPhases,
} from './phase-rules';

export class LifecycleService {
  constructor(
    private logger: ILogger,
    private eventBus?: IEventBus,
    private prismaFn: () => ReturnType<typeof getPrisma> = getPrisma,
  ) {}

  // ================================================================
  // Phase Validation
  // ================================================================

  async getPhaseValidation(projectId: string, targetPhase: string): Promise<PhaseValidation> {
    const prisma = this.prismaFn();
    try {
      if (!isValidPhase(targetPhase)) {
        return {
          canTransition: false,
          conditions: [],
          metConditions: [],
          unmetConditions: [`目标阶段 "${targetPhase}" 不是有效阶段`],
        };
      }

      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });

      if (!project) {
        return {
          canTransition: false,
          conditions: [],
          metConditions: [],
          unmetConditions: [`项目不存在: ${projectId}`],
        };
      }

      const currentPhase = project.phase;

      if (!isValidTransition(currentPhase, targetPhase)) {
        return {
          canTransition: false,
          conditions: [],
          metConditions: [],
          unmetConditions: [`不允许从 "${currentPhase}" 转换到 "${targetPhase}"`],
        };
      }

      const rule = getTransitionRule(currentPhase, targetPhase)!;

      // Evaluate conditions - for now, all conditions are considered met
      // In a real implementation, these would be checked against actual project state
      const metConditions = [...rule.conditions];
      const unmetConditions: string[] = [];

      return {
        canTransition: true,
        conditions: rule.conditions,
        metConditions,
        unmetConditions,
      };
    } finally {
      await prisma.$disconnect();
    }
  }

  // ================================================================
  // Transition Request
  // ================================================================

  async requestTransition(input: PhaseTransitionInput): Promise<PhaseTransitionResult> {
    const prisma = this.prismaFn();
    try {
      const { projectId, targetPhase, reason, triggeredBy } = input;

      // Validate target phase
      if (!isValidPhase(targetPhase)) {
        return {
          success: false,
          previousPhase: '',
          newPhase: targetPhase,
          requiresApproval: false,
          message: `无效的目标阶段: "${targetPhase}"`,
        };
      }

      // Get project
      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });

      if (!project) {
        return {
          success: false,
          previousPhase: '',
          newPhase: targetPhase,
          requiresApproval: false,
          message: `项目不存在: ${projectId}`,
        };
      }

      const currentPhase = project.phase;

      // Check if already in target phase
      if (currentPhase === targetPhase) {
        return {
          success: false,
          previousPhase: currentPhase,
          newPhase: targetPhase,
          requiresApproval: false,
          message: `项目已处于 "${targetPhase}" 阶段`,
        };
      }

      // Validate transition
      if (!isValidTransition(currentPhase, targetPhase)) {
        return {
          success: false,
          previousPhase: currentPhase,
          newPhase: targetPhase,
          requiresApproval: false,
          message: `不允许从 "${currentPhase}" 转换到 "${targetPhase}"`,
        };
      }

      const rule = getTransitionRule(currentPhase, targetPhase)!;

      // Check for existing pending transition
      const existingPending = await prisma.phaseTransition.findFirst({
        where: {
          projectId,
          status: 'pending',
        },
      });

      if (existingPending) {
        return {
          success: false,
          previousPhase: currentPhase,
          newPhase: targetPhase,
          requiresApproval: rule.requireApproval,
          message: `已有待处理的转换请求: ${existingPending.id}`,
        };
      }

      // Create transition record
      const transition = await prisma.phaseTransition.create({
        data: {
          projectId,
          fromPhase: currentPhase,
          toPhase: targetPhase,
          triggeredBy: triggeredBy ?? null,
          reason: reason ?? null,
          status: rule.requireApproval ? 'pending' : 'completed',
          completedAt: rule.requireApproval ? null : new Date(),
        },
      });

      // If no approval required, complete the transition immediately
      if (!rule.requireApproval) {
        await prisma.project.update({
          where: { id: projectId },
          data: { phase: targetPhase },
        });

        this.logger.info(`[Lifecycle] Project ${projectId} transitioned from "${currentPhase}" to "${targetPhase}"`);

        // Emit event
        this.emitEvent('project.phase.changed', {
          projectId,
          previousPhase: currentPhase,
          newPhase: targetPhase,
          transitionId: transition.id,
          triggeredBy: triggeredBy ?? null,
        });

        return {
          success: true,
          transitionId: transition.id,
          previousPhase: currentPhase,
          newPhase: targetPhase,
          requiresApproval: false,
          message: `项目阶段已从 "${currentPhase}" 转换到 "${targetPhase}"`,
          autoActions: rule.autoActions,
        };
      }

      // Requires approval
      this.logger.info(`[Lifecycle] Phase transition requested: ${projectId} from "${currentPhase}" to "${targetPhase}" (pending approval)`);

      return {
        success: true,
        transitionId: transition.id,
        previousPhase: currentPhase,
        newPhase: targetPhase,
        requiresApproval: true,
        message: `阶段转换请求已创建，等待审批: "${currentPhase}" -> "${targetPhase}"`,
        autoActions: rule.autoActions,
      };
    } finally {
      await prisma.$disconnect();
    }
  }

  // ================================================================
  // Approve Transition
  // ================================================================

  async approveTransition(transitionId: string): Promise<PhaseTransitionResult> {
    const prisma = this.prismaFn();
    try {
      const transition = await prisma.phaseTransition.findUnique({
        where: { id: transitionId },
      });

      if (!transition) {
        return {
          success: false,
          previousPhase: '',
          newPhase: '',
          requiresApproval: false,
          message: `转换记录不存在: ${transitionId}`,
        };
      }

      if (transition.status !== 'pending') {
        return {
          success: false,
          previousPhase: transition.fromPhase,
          newPhase: transition.toPhase,
          requiresApproval: false,
          message: `转换记录状态不是待审批: ${transition.status}`,
        };
      }

      // Update transition status
      const updated = await prisma.phaseTransition.update({
        where: { id: transitionId },
        data: {
          status: 'completed',
          completedAt: new Date(),
        },
      });

      // Update project phase
      await prisma.project.update({
        where: { id: transition.projectId },
        data: { phase: transition.toPhase },
      });

      const rule = getTransitionRule(transition.fromPhase, transition.toPhase);

      this.logger.info(`[Lifecycle] Transition ${transitionId} approved. Project ${transition.projectId} -> "${transition.toPhase}"`);

      // Emit event
      this.emitEvent('project.phase.changed', {
        projectId: transition.projectId,
        previousPhase: transition.fromPhase,
        newPhase: transition.toPhase,
        transitionId: updated.id,
        triggeredBy: transition.triggeredBy,
      });

      return {
        success: true,
        transitionId: updated.id,
        previousPhase: transition.fromPhase,
        newPhase: transition.toPhase,
        requiresApproval: false,
        message: `阶段转换已批准: "${transition.fromPhase}" -> "${transition.toPhase}"`,
        autoActions: rule?.autoActions,
      };
    } finally {
      await prisma.$disconnect();
    }
  }

  // ================================================================
  // Reject Transition
  // ================================================================

  async rejectTransition(transitionId: string, reason?: string): Promise<PhaseTransitionResult> {
    const prisma = this.prismaFn();
    try {
      const transition = await prisma.phaseTransition.findUnique({
        where: { id: transitionId },
      });

      if (!transition) {
        return {
          success: false,
          previousPhase: '',
          newPhase: '',
          requiresApproval: false,
          message: `转换记录不存在: ${transitionId}`,
        };
      }

      if (transition.status !== 'pending') {
        return {
          success: false,
          previousPhase: transition.fromPhase,
          newPhase: transition.toPhase,
          requiresApproval: false,
          message: `转换记录状态不是待审批: ${transition.status}`,
        };
      }

      await prisma.phaseTransition.update({
        where: { id: transitionId },
        data: {
          status: 'rejected',
        },
      });

      this.logger.info(`[Lifecycle] Transition ${transitionId} rejected. Reason: ${reason ?? '未提供'}`);

      return {
        success: true,
        transitionId,
        previousPhase: transition.fromPhase,
        newPhase: transition.toPhase,
        requiresApproval: false,
        message: `阶段转换已拒绝: "${transition.fromPhase}" -> "${transition.toPhase}". 原因: ${reason ?? '未提供'}`,
      };
    } finally {
      await prisma.$disconnect();
    }
  }

  // ================================================================
  // Transition History
  // ================================================================

  async getTransitionHistory(projectId: string) {
    const prisma = this.prismaFn();
    try {
      const transitions = await prisma.phaseTransition.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
      });

      return transitions;
    } finally {
      await prisma.$disconnect();
    }
  }

  // ================================================================
  // Current Phase
  // ================================================================

  async getCurrentPhase(projectId: string): Promise<string | null> {
    const prisma = this.prismaFn();
    try {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { phase: true },
      });

      return project?.phase ?? null;
    } finally {
      await prisma.$disconnect();
    }
  }

  // ================================================================
  // Available Transitions
  // ================================================================

  async getAvailableTransitions(projectId: string) {
    const prisma = this.prismaFn();
    try {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { phase: true },
      });

      if (!project) {
        return [];
      }

      const nextPhases = getValidNextPhases(project.phase);

      return nextPhases.map((toPhase) => {
        const rule = getTransitionRule(project.phase, toPhase)!;
        return {
          from: project.phase,
          to: toPhase,
          conditions: rule.conditions,
          requireApproval: rule.requireApproval,
          autoActions: rule.autoActions,
        };
      });
    } finally {
      await prisma.$disconnect();
    }
  }

  // ================================================================
  // Private Helpers
  // ================================================================

  private emitEvent(type: string, payload: unknown): void {
    if (!this.eventBus) return;
    const event: DomainEvent = {
      type,
      payload,
      timestamp: new Date(),
      source: 'lifecycle',
    };
    this.eventBus.emit(event);
  }
}
