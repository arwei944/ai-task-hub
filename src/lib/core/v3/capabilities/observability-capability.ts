// ============================================================
// Observability Capability
// ============================================================
// Registers: Feedback/ImprovementLoop services
// Subscribes: workflow events for feedback tracking
// HealthCheck: Feedback loop availability
// ============================================================

import type { IDIContainer, IEventBus, HealthReport } from '@/lib/core/v3/types';
import { BaseCapability } from '../base-capability';
import { registerFeedbackServices } from '../service-factory';

export class ObservabilityCapability extends BaseCapability {
  readonly id = 'observability';

  protected async doRegister(container: IDIContainer): Promise<void> {
    await registerFeedbackServices(container);
  }

  protected async doSubscribe(_bus: IEventBus): Promise<void> {
    // Observability listens via internal instrumentation
    // (LinkageTracer is integrated in AppKernel)
  }

  protected doHealthCheck(): HealthReport {
    return this.healthy('Observability services registered');
  }
}
