// ============================================================
// Agent Capability
// ============================================================
// Registers: AgentService, PermissionService, AgentOperationLogger
// Subscribes: (pure emitter, no subscriptions)
// HealthCheck: Agent service availability
// ============================================================

import type { IDIContainer, IEventBus, HealthReport } from '@/lib/core/v3/types';
import { BaseCapability } from '../base-capability';
import { registerAgentServices } from '../service-factory';

export class AgentCapability extends BaseCapability {
  readonly id = 'agent';

  protected async doRegister(container: IDIContainer): Promise<void> {
    await registerAgentServices(container);
  }

  protected async doSubscribe(_bus: IEventBus): Promise<void> {
    // Agent module is a pure event emitter
  }

  protected doHealthCheck(): HealthReport {
    return this.healthy('Agent services registered');
  }
}
