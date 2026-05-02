// ============================================================
// AI Task Hub v3.0 — Next.js Instrumentation (启动钩子)
// ============================================================
// 在 Next.js 启动时调用 AppKernel.boot()
// 这是整个应用的唯一启动点
// ============================================================

export async function register() {
  // v3.0 基座层延迟初始化
  // 当前阶段（Phase 1）：基座层已就绪，但积木尚未迁移
  // 积木将在 Phase 4 逐个迁移后注册到这里
  //
  // Phase 4 完成后的代码：
  // import { initKernel } from '@/lib/core/v3';
  // import { TaskCapability } from '@/lib/capabilities/task';
  // import { ProjectCapability } from '@/lib/capabilities/project';
  // import { NotificationCapability } from '@/lib/capabilities/notification';
  // import { WorkflowCapability } from '@/lib/capabilities/workflow';
  // import { AICapability } from '@/lib/capabilities/ai';
  // import { IntegrationCapability } from '@/lib/capabilities/integration';
  // import { ObservabilityCapability } from '@/lib/capabilities/observability';
  //
  // await initKernel([
  //   new TaskCapability(),
  //   new ProjectCapability(),
  //   new NotificationCapability(),
  //   new WorkflowCapability(),
  //   new AICapability(),
  //   new IntegrationCapability(),
  //   new ObservabilityCapability(),
  // ]);

  console.log('[Instrumentation] v3.0 Phase 1: Foundation layer ready. Awaiting Phase 4 for capability registration.');
}

export async function shutdown() {
  // v3.0 关闭
  // Phase 4 完成后：
  // import { getKernel } from '@/lib/core/v3';
  // await getKernel().shutdown();

  console.log('[Instrumentation] Shutdown.');
}
