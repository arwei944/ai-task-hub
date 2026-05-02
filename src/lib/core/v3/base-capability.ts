// ============================================================
// Base Capability — Abstract base class for all capabilities
// ============================================================
//
// Provides template method pattern for the 3 Capability methods:
// - register(): delegates to service-factory register functions
// - subscribe(): sets up event listeners
// - healthCheck(): returns service health status
//
// Each concrete capability implements:
// - doRegister(): actual service registration
// - doSubscribe(): actual event subscription
// - doHealthCheck(): actual health check logic
// ============================================================

import type { IDIContainer, IEventBus, Capability, HealthReport } from '@/lib/core/v3/types';

export abstract class BaseCapability implements Capability {
  abstract readonly id: string;

  // ---- Capability Interface ----

  async register(container: IDIContainer): Promise<void> {
    const start = Date.now();
    try {
      await this.doRegister(container);
      this.log(`register() completed in ${Date.now() - start}ms`);
    } catch (err: any) {
      this.log(`register() failed: ${err.message}`, 'error');
      throw err;
    }
  }

  async subscribe(bus: IEventBus): Promise<void> {
    const start = Date.now();
    try {
      await this.doSubscribe(bus);
      this.log(`subscribe() completed in ${Date.now() - start}ms`);
    } catch (err: any) {
      this.log(`subscribe() failed: ${err.message}`, 'error');
      throw err;
    }
  }

  healthCheck(): HealthReport {
    const start = Date.now();
    try {
      const report = this.doHealthCheck();
      report.latency = Date.now() - start;
      report.checkedAt = Date.now();
      return report;
    } catch (err: any) {
      return {
        status: 'failed',
        details: `Health check error: ${err.message}`,
        checkedAt: Date.now(),
        latency: Date.now() - start,
      };
    }
  }

  // ---- Abstract methods for subclasses ----

  protected abstract doRegister(container: IDIContainer): Promise<void>;
  protected abstract doSubscribe(bus: IEventBus): Promise<void>;
  protected abstract doHealthCheck(): HealthReport;

  // ---- Utility ----

  protected log(msg: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    console.log(`[${this.id}] ${level.toUpperCase()}: ${msg}`);
  }

  protected healthy(details?: string, metrics?: Record<string, number | string | boolean>): HealthReport {
    return { status: 'healthy', details, metrics, checkedAt: 0 };
  }

  protected degraded(details?: string, metrics?: Record<string, number | string | boolean>): HealthReport {
    return { status: 'degraded', details, metrics, checkedAt: 0 };
  }

  protected unhealthy(details?: string, metrics?: Record<string, number | string | boolean>): HealthReport {
    return { status: 'failed', details, metrics, checkedAt: 0 };
  }
}
