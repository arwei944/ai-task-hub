import type { DomainEvent } from '@/lib/core/types';
import { BaseAIHandler } from './base.handler';

interface DeploymentStatusPayload {
  id?: string;
  deploymentId?: string;
  status?: string;
  previousStatus?: string;
  environment?: string;
  version?: string;
  projectId?: string;
  error?: string;
  [key: string]: unknown;
}

/**
 * AI handler for deployment.status.changed events.
 * Analyzes deployment health, detects patterns, and provides rollback advice.
 */
export class DeploymentStatusHandler extends BaseAIHandler {
  private consecutiveFailures = 0;
  private lastFailureEnv?: string;

  get eventType(): string {
    return 'deployment.status.changed';
  }

  async handle(event: DomainEvent): Promise<void> {
    const payload = event.payload as DeploymentStatusPayload;

    const status = payload.status ?? '';
    const previousStatus = payload.previousStatus ?? '';
    const environment = payload.environment ?? 'unknown';

    this.logger.info(
      `[AI] Deployment status changed: "${previousStatus}" -> "${status}" (env: ${environment})`,
    );

    // Track consecutive failures
    if (status === 'failure' || status === 'failed') {
      this.consecutiveFailures++;
      this.lastFailureEnv = environment;
      await this.analyzeFailure(payload);
    } else if (status === 'success' || status === 'completed') {
      this.consecutiveFailures = 0;
      this.logger.info(
        `[AI] Deployment succeeded for ${payload.deploymentId ?? payload.id} in ${environment}`,
      );
    } else if (status === 'rollback' || status === 'rolled_back') {
      this.consecutiveFailures = 0;
      await this.provideRollbackAdvice(payload);
    }

    // Check for anomaly pattern
    if (this.consecutiveFailures >= 3) {
      await this.emitAnomalyDetection(payload);
    }
  }

  /**
   * Analyze deployment failure and emit risk detection event.
   */
  private async analyzeFailure(payload: DeploymentStatusPayload): Promise<void> {
    const riskFactors: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    // Analyze error message
    const errorMsg = payload.error ?? '';
    if (errorMsg.includes('timeout') || errorMsg.includes('超时')) {
      riskFactors.push('部署超时');
      riskLevel = 'medium';
    }
    if (errorMsg.includes('OOM') || errorMsg.includes('memory')) {
      riskFactors.push('内存不足');
      riskLevel = 'high';
    }
    if (errorMsg.includes('connection') || errorMsg.includes('连接')) {
      riskFactors.push('连接失败');
      riskLevel = 'medium';
    }
    if (errorMsg.includes('permission') || errorMsg.includes('权限')) {
      riskFactors.push('权限问题');
      riskLevel = 'medium';
    }

    // Consecutive failures increase risk
    if (this.consecutiveFailures >= 2) {
      riskFactors.push(`连续失败 ${this.consecutiveFailures} 次`);
      riskLevel = 'high';
    }

    if (riskFactors.length === 0) {
      riskFactors.push('部署失败，原因未知');
    }

    this.logger.info(
      `[AI] Deployment risk detected: ${riskLevel} — ${riskFactors.join(', ')}`,
    );

    this.eventBus.emit({
      type: 'deployment.risk.detected',
      payload: {
        deploymentId: payload.deploymentId ?? payload.id,
        projectId: payload.projectId,
        environment: payload.environment,
        version: payload.version,
        riskLevel,
        riskFactors,
        consecutiveFailures: this.consecutiveFailures,
        error: payload.error,
        analyzedAt: new Date(),
      },
      timestamp: new Date(),
      source: 'ai-engine',
    });
  }

  /**
   * Provide advice after a deployment rollback.
   */
  private async provideRollbackAdvice(payload: DeploymentStatusPayload): Promise<void> {
    const suggestions: string[] = [
      '检查回滚前的变更日志，定位失败原因',
      '在测试环境中复现问题并验证修复',
      '考虑增加自动化测试覆盖失败场景',
    ];

    if (payload.environment === 'production') {
      suggestions.push('通知相关团队成员生产环境已回滚');
      suggestions.push('评估是否需要发布事故报告');
    }

    if (this.consecutiveFailures >= 2) {
      suggestions.push('连续多次失败，建议暂停部署并全面排查');
    }

    this.logger.info(
      `[AI] Rollback advice generated for deployment ${payload.deploymentId ?? payload.id}`,
    );

    this.eventBus.emit({
      type: 'deployment.rollback.advice',
      payload: {
        deploymentId: payload.deploymentId ?? payload.id,
        projectId: payload.projectId,
        environment: payload.environment,
        version: payload.version,
        suggestions,
        analyzedAt: new Date(),
      },
      timestamp: new Date(),
      source: 'ai-engine',
    });
  }

  /**
   * Emit anomaly detection when consecutive failures reach threshold.
   */
  private async emitAnomalyDetection(payload: DeploymentStatusPayload): Promise<void> {
    this.logger.warn(
      `[AI] Deployment pattern anomaly: ${this.consecutiveFailures} consecutive failures in ${this.lastFailureEnv}`,
    );

    this.eventBus.emit({
      type: 'deployment.pattern.anomaly',
      payload: {
        deploymentId: payload.deploymentId ?? payload.id,
        projectId: payload.projectId,
        environment: this.lastFailureEnv,
        consecutiveFailures: this.consecutiveFailures,
        severity: this.consecutiveFailures >= 5 ? 'critical' : 'warning',
        recommendation: this.consecutiveFailures >= 5
          ? '建议立即暂停部署，进行全面系统检查'
          : '建议排查环境配置和依赖变更',
        detectedAt: new Date(),
      },
      timestamp: new Date(),
      source: 'ai-engine',
    });

    // Reset counter after emitting anomaly to avoid repeated emissions
    this.consecutiveFailures = 0;
  }
}
