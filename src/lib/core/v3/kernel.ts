// ============================================================
// AI Task Hub v3.0 — AppKernel (单一组合根)
// ============================================================
// 整个应用的唯一启动入口，所有服务从这里创建
// ============================================================

import { DIContainer } from './di';
import { EventBus } from './event-bus';
import { LinkageTracer } from './linkage-tracer';
import { HealthMonitor } from './health';
import { registerCoreServices } from './service-factory';
import type {
  Capability,
  AppKernelConfig,
  AppKernelStatus,
  HealthReport,
  IDIContainer,
  IEventBus,
  EventType,
  EventEnvelope,
} from './types';

export class AppKernel {
  private container: DIContainer;
  private bus: EventBus;
  private tracer: LinkageTracer;
  private healthMonitor: HealthMonitor;
  private capabilities: Capability[] = [];
  private booted = false;
  private bootDuration = 0;

  constructor(config?: AppKernelConfig) {
    // 1. 创建基础服务
    this.container = new DIContainer();
    this.bus = new EventBus({
      enableDLQ: config?.enableDLQ ?? true,
      maxDLQSize: config?.maxDLQSize,
    });
    this.tracer = new LinkageTracer();
    this.healthMonitor = new HealthMonitor({
      intervalMs: config?.healthCheckInterval,
      onDegraded: (module, report) => {
        console.warn(`[Kernel] Health degraded: ${module}`, report.details);
        this.bus.emit({
          type: 'system.health.degraded',
          payload: {
            module,
            severity: report.status === 'failed' ? 'critical' : 'warning',
            reason: report.details || 'Unknown',
          },
          timestamp: Date.now(),
          source: 'health-monitor',
        });
      },
      onRecovered: (module, report) => {
        console.info(`[Kernel] Health recovered: ${module}`);
      },
    });

    // 2. 注册基础服务到 DI
    this.container.register('kernel', () => this);
    this.container.register('bus', () => this.bus);
    this.container.register('tracer', () => this.tracer);
    this.container.register('healthMonitor', () => this.healthMonitor);
    this.container.register('container', () => this.container);
  }

  // ==================== 启动 ====================

  /**
   * 启动应用 — 唯一启动点
   * 在 Next.js instrumentation.ts 中调用
   */
  async boot(capabilities: Capability[]): Promise<void> {
    if (this.booted) {
      console.warn('[Kernel] Already booted, skipping');
      return;
    }

    const startTime = Date.now();
    console.info(`[Kernel] Booting with ${capabilities.length} capabilities...`);

    // 0. Register core services first (prisma, eventBus, logger)
    registerCoreServices(this.container);
    console.info('[Kernel] Core services registered (prisma, eventBus, logger)');

    // 1. 注册所有积木的服务
    for (const cap of capabilities) {
      try {
        await cap.register(this.container);
        console.info(`[Kernel] Capability registered: ${cap.id}`);
      } catch (err) {
        console.error(`[Kernel] Failed to register capability "${cap.id}":`, err);
      }
    }

    // 2. 订阅所有积木的事件
    for (const cap of capabilities) {
      try {
        await cap.subscribe(this.bus);
        console.info(`[Kernel] Capability subscribed: ${cap.id}`);
      } catch (err) {
        console.error(`[Kernel] Failed to subscribe capability "${cap.id}":`, err);
      }
    }

    // 3. 注册健康检查
    for (const cap of capabilities) {
      this.healthMonitor.register(cap.id, () => cap.healthCheck());
    }

    // 4. 注册 EventBus 自身的健康检查
    this.healthMonitor.register('eventBus', () => ({
      status: this.bus.getMetrics().dlqSize > 100 ? 'degraded' : 'healthy',
      metrics: this.bus.getMetrics() as unknown as Record<string, number | string | boolean>,
      checkedAt: Date.now(),
    }));

    // 5. 注册 LinkageTracer 自身的健康检查
    this.healthMonitor.register('linkageTracer', () => ({
      status: 'healthy',
      metrics: this.tracer.getStats() as unknown as Record<string, number | string | boolean>,
      checkedAt: Date.now(),
    }));

    // 6. 启动健康检查
    this.healthMonitor.start();

    // 7. 记录启动信息
    this.capabilities = capabilities;
    this.booted = true;
    this.bootDuration = Date.now() - startTime;

    console.info(
      `[Kernel] Boot complete in ${this.bootDuration}ms. ` +
      `${capabilities.length} capabilities, ` +
      `${this.bus.getListenerCount()} event listeners.`
    );
  }

  // ==================== 服务获取 ====================

  /** 从 DI 容器获取服务 */
  resolve<T>(token: string): T {
    return this.container.resolve<T>(token);
  }

  /** 获取 EventBus */
  getEventBus(): EventBus {
    return this.bus;
  }

  /** 获取 LinkageTracer */
  getTracer(): LinkageTracer {
    return this.tracer;
  }

  /** 获取 HealthMonitor */
  getHealthMonitor(): HealthMonitor {
    return this.healthMonitor;
  }

  /** 获取 DI 容器 */
  getContainer(): DIContainer {
    return this.container;
  }

  /** 获取所有已注册的积木 */
  getCapabilities(): Capability[] {
    return [...this.capabilities];
  }

  // ==================== 状态 ====================

  isBooted(): boolean {
    return this.booted;
  }

  getStatus(): AppKernelStatus {
    return {
      booted: this.booted,
      bootDuration: this.bootDuration,
      capabilities: this.capabilities.map(cap => {
        const report = cap.healthCheck();
        return {
          id: cap.id,
          status: report.status,
          latency: report.latency,
        };
      }),
      eventBus: this.bus.getMetrics(),
      linkage: this.tracer.getStats(),
      healthIssues: Object.values(this.healthMonitor.getAllReports())
        .filter(r => r.status !== 'healthy').length,
    };
  }

  // ==================== 关闭 ====================

  async shutdown(): Promise<void> {
    console.info('[Kernel] Shutting down...');
    this.healthMonitor.stop();
    this.booted = false;
    console.info('[Kernel] Shutdown complete.');
  }
}

// ==================== 全局单例 ====================

let _kernel: AppKernel | null = null;

/**
 * 获取全局 AppKernel 单例
 * 所有入口点（tRPC、MCP、API Routes）都应使用此函数
 */
export function getKernel(): AppKernel {
  if (!_kernel) {
    _kernel = new AppKernel();
  }
  return _kernel;
}

/**
 * 初始化全局 AppKernel（在 instrumentation.ts 中调用）
 */
export async function initKernel(capabilities: Capability[]): Promise<AppKernel> {
  const kernel = getKernel();
  await kernel.boot(capabilities);
  return kernel;
}
