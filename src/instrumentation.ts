// ============================================================
// AI Task Hub v3.0 — Next.js Instrumentation (启动钩子)
// ============================================================
// 在 Next.js 启动时调用 AppKernel.boot()
// 这是整个应用的唯一启动点
// ============================================================

import { initKernel, getKernel } from '@/lib/core/v3';
import {
  TaskCapability,
  NotificationCapability,
  WorkflowCapability,
  AICapability,
  IntegrationCapability,
  AgentCapability,
  ObservabilityCapability,
} from '@/lib/core/v3/capabilities';

export async function register() {
  console.log('[Instrumentation] v3.0 — Booting AppKernel with 7 capabilities...');

  try {
    await initKernel([
      new TaskCapability(),
      new NotificationCapability(),
      new WorkflowCapability(),
      new AICapability(),
      new IntegrationCapability(),
      new AgentCapability(),
      new ObservabilityCapability(),
    ]);

    const kernel = getKernel();
    const status = kernel.getStatus();
    console.log(
      `[Instrumentation] v3.0 — AppKernel ready! ` +
      `${status.capabilities.length} capabilities, ` +
      `boot ${status.bootDuration}ms, ` +
      `health: ${status.healthStatus}`,
    );
  } catch (err: any) {
    console.error(`[Instrumentation] v3.0 — AppKernel boot failed: ${err.message}`);
    // Don't throw — allow the app to start in degraded mode
    // tRPC routes will initialize services on-demand via service-factory
  }
}

export async function shutdown() {
  try {
    const kernel = getKernel();
    await kernel.shutdown();
    console.log('[Instrumentation] v3.0 — AppKernel shutdown complete.');
  } catch {
    console.log('[Instrumentation] Shutdown.');
  }
}
