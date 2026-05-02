// ============================================================
// AI Task Hub v3.0 — Next.js Instrumentation (启动钩子)
// ============================================================
// 在 Next.js 启动时调用 AppKernel.boot()
// 标记为 Node.js runtime 以使用 Prisma、crypto 等 Node.js API
// ============================================================

export const runtime = 'nodejs';

export async function register() {
  console.log('[Instrumentation] v3.0 — Initializing...');

  try {
    const { initKernel, getKernel, getSelfHealingManager } = await import('@/lib/core/v3');
    const {
      TaskCapability,
      NotificationCapability,
      WorkflowCapability,
      AICapability,
      IntegrationCapability,
      AgentCapability,
      ObservabilityCapability,
    } = await import('@/lib/core/v3');

    const capabilities = [
      new TaskCapability(),
      new NotificationCapability(),
      new WorkflowCapability(),
      new AICapability(),
      new IntegrationCapability(),
      new AgentCapability(),
      new ObservabilityCapability(),
    ];

    await initKernel(capabilities);

    const kernel = getKernel();
    const status = kernel.getStatus();
    console.log(
      `[Instrumentation] v3.0 — AppKernel ready! ` +
      `${status.capabilities.length} capabilities, ` +
      `boot ${status.bootDuration}ms, ` +
      `health issues: ${status.healthIssues}`,
    );

    // Start self-healing system
    const selfHealing = getSelfHealingManager();
    selfHealing.registerCapabilities(capabilities);
    selfHealing.start();
    console.log('[Instrumentation] v3.0 — Self-healing system started (30s health check interval)');
  } catch (err: any) {
    console.error(`[Instrumentation] v3.0 — AppKernel boot failed: ${err.message}`);
    // Don't throw — allow the app to start in degraded mode
    // tRPC routes will initialize services on-demand via service-factory
  }
}

export async function shutdown() {
  try {
    const { getKernel, getSelfHealingManager } = await import('@/lib/core/v3');
    const selfHealing = getSelfHealingManager();
    selfHealing.stop();

    const kernel = getKernel();
    await kernel.shutdown();
    console.log('[Instrumentation] v3.0 — AppKernel shutdown complete.');
  } catch {
    console.log('[Instrumentation] Shutdown.');
  }
}
