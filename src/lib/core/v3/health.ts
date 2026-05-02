// ============================================================
// AI Task Hub v3.0 — Health Monitor + Circuit Breaker
// ============================================================
// 健康检查框架 + 熔断器，自愈能力的核心
// ============================================================

import type { HealthStatus, HealthReport, IDIContainer } from './types';

// ==================== Circuit Breaker ====================

export interface CircuitBreakerConfig {
  /** 触发熔断的连续失败次数（默认 5） */
  failureThreshold?: number;
  /** 熔断后等待时间（毫秒，默认 30000） */
  resetTimeoutMs?: number;
  /** 半开状态下恢复所需的连续成功次数（默认 3） */
  successThreshold?: number;
}

export class CircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failureCount = 0;
  private halfOpenSuccessCount = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly successThreshold: number;

  constructor(config?: CircuitBreakerConfig) {
    this.failureThreshold = config?.failureThreshold ?? 5;
    this.resetTimeoutMs = config?.resetTimeoutMs ?? 30000;
    this.successThreshold = config?.successThreshold ?? 3;
  }

  /** 执行受保护的操作 */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
        this.state = 'half-open';
        this.halfOpenSuccessCount = 0;
      } else {
        throw new Error(`[CircuitBreaker] Circuit is OPEN (since ${new Date(this.lastFailureTime).toISOString()})`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === 'half-open') {
      this.halfOpenSuccessCount++;
      if (this.halfOpenSuccessCount >= this.successThreshold) {
        this.state = 'closed';
        this.failureCount = 0;
        this.halfOpenSuccessCount = 0;
      }
    } else {
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.state === 'half-open') {
      this.state = 'open';
    } else if (this.failureCount >= this.failureThreshold) {
      this.state = 'open';
    }
  }

  /** 手动重置 */
  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.halfOpenSuccessCount = 0;
  }

  /** 手动触发熔断 */
  trip(): void {
    this.state = 'open';
    this.lastFailureTime = Date.now();
  }

  getState(): 'closed' | 'open' | 'half-open' {
    return this.state;
  }

  getFailureCount(): number {
    return this.failureCount;
  }
}

// ==================== Health Monitor ====================

export interface HealthMonitorConfig {
  /** 检查间隔（毫秒，默认 30000） */
  intervalMs?: number;
  /** 降级回调 */
  onDegraded?: (module: string, report: HealthReport) => void;
  /** 恢复回调 */
  onRecovered?: (module: string, report: HealthReport) => void;
}

interface HealthCheckEntry {
  id: string;
  check: () => HealthReport;
  lastReport?: HealthReport;
  lastCheckedAt?: number;
  consecutiveFailures: number;
}

export class HealthMonitor {
  private checks = new Map<string, HealthCheckEntry>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly intervalMs: number;
  private readonly onDegraded?: (module: string, report: HealthReport) => void;
  private readonly onRecovered?: (module: string, report: HealthReport) => void;

  constructor(config?: HealthMonitorConfig) {
    this.intervalMs = config?.intervalMs ?? 30000;
    this.onDegraded = config?.onDegraded;
    this.onRecovered = config?.onRecovered;
  }

  /** 注册健康检查 */
  register(id: string, check: () => HealthReport): void {
    this.checks.set(id, {
      id,
      check,
      consecutiveFailures: 0,
    });
  }

  /** 注销健康检查 */
  unregister(id: string): void {
    this.checks.delete(id);
  }

  /** 启动定时检查 */
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.runChecks(), this.intervalMs);
    // 立即执行一次
    this.runChecks();
  }

  /** 停止定时检查 */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** 手动触发检查 */
  async runChecks(): Promise<void> {
    for (const entry of this.checks.values()) {
      try {
        const report = entry.check();
        entry.lastReport = report;
        entry.lastCheckedAt = Date.now();

        if (report.status === 'healthy') {
          if (entry.consecutiveFailures > 0) {
            entry.consecutiveFailures = 0;
            this.onRecovered?.(entry.id, report);
          }
        } else {
          entry.consecutiveFailures++;
          this.onDegraded?.(entry.id, report);
        }
      } catch (err) {
        entry.consecutiveFailures++;
        const errorReport: HealthReport = {
          status: 'failed',
          details: String(err),
          checkedAt: Date.now(),
        };
        entry.lastReport = errorReport;
        entry.lastCheckedAt = Date.now();
        this.onDegraded?.(entry.id, errorReport);
      }
    }
  }

  /** 获取所有健康报告 */
  getAllReports(): Record<string, HealthReport> {
    const reports: Record<string, HealthReport> = {};
    for (const [id, entry] of this.checks) {
      reports[id] = entry.lastReport ?? {
        status: 'unknown',
        checkedAt: 0,
      };
    }
    return reports;
  }

  /** 获取单个模块的健康报告 */
  getReport(id: string): HealthReport | undefined {
    return this.checks.get(id)?.lastReport;
  }

  /** 获取总体健康状态 */
  getOverallStatus(): HealthStatus {
    const reports = this.getAllReports();
    const statuses = Object.values(reports).map(r => r.status);

    if (statuses.includes('failed')) return 'failed';
    if (statuses.includes('degraded')) return 'degraded';
    if (statuses.every(s => s === 'healthy')) return 'healthy';
    return 'unknown';
  }

  /** 获取已注册的检查列表 */
  getRegisteredChecks(): string[] {
    return [...this.checks.keys()];
  }
}
