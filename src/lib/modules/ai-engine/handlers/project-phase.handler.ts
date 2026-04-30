import type { DomainEvent } from '@/lib/core/types';
import { BaseAIHandler } from './base.handler';

interface ProjectPhasePayload {
  id?: string;
  projectId?: string;
  phase?: string;
  previousPhase?: string;
  [key: string]: unknown;
}

const PHASE_RECOMMENDATIONS: Record<string, Record<string, string>> = {
  requirements: {
    planning: '建议创建项目规划文档',
  },
  planning: {
    architecture: '建议进行架构评审',
  },
  architecture: {
    implementation: '建议创建工作流模板',
  },
  implementation: {
    testing: '建议生成测试计划',
  },
  testing: {
    deployment: '建议准备发布说明',
  },
  deployment: {
    completed: '建议归档项目并记录经验',
  },
};

export class ProjectPhaseHandler extends BaseAIHandler {
  get eventType(): string {
    return 'project.phase.changed';
  }

  async handle(event: DomainEvent): Promise<void> {
    const payload = event.payload as ProjectPhasePayload;

    const previousPhase = payload.previousPhase ?? '';
    const newPhase = payload.phase ?? '';

    this.logger.info(
      `[AI] Project phase transition: "${previousPhase}" -> "${newPhase}"`,
    );

    const recommendation = this.getRecommendation(previousPhase, newPhase);

    if (recommendation) {
      this.logger.info(`[AI] Phase recommendation: ${recommendation}`);

      this.eventBus.emit({
        type: 'ai.suggestion',
        payload: {
          projectId: payload.projectId ?? payload.id,
          type: 'phase-recommendation',
          phase: newPhase,
          previousPhase,
          recommendation,
          createdAt: new Date(),
        },
        timestamp: new Date(),
        source: 'ai-engine',
      });
    }
  }

  private getRecommendation(
    previousPhase: string,
    newPhase: string,
  ): string | null {
    const phaseRecs = PHASE_RECOMMENDATIONS[previousPhase];
    if (!phaseRecs) {
      return null;
    }
    return phaseRecs[newPhase] ?? null;
  }
}
