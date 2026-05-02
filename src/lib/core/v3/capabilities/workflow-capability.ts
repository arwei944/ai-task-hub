// ============================================================
// Workflow Capability
// ============================================================
// Registers: WorkflowService
// Subscribes: github.issue.received, project.phase.changed
// HealthCheck: SOLO Bridge health (MCP/REST/Pull clients)
// ============================================================

import type { IDIContainer, IEventBus, HealthReport } from '@/lib/core/v3/types';
import { BaseCapability } from '../base-capability';
import { ServiceTokens, registerWorkflowServices } from '../service-factory';

export class WorkflowCapability extends BaseCapability {
  readonly id = 'workflow';

  protected async doRegister(container: IDIContainer): Promise<void> {
    await registerWorkflowServices(container);
  }

  protected async doSubscribe(bus: IEventBus): Promise<void> {
    // Workflow engine subscribes to trigger events
    // (handled internally by TriggerDispatcher)
  }

  protected doHealthCheck(): HealthReport {
    return this.healthy('Workflow services registered');
  }
}
