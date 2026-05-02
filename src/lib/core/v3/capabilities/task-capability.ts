// ============================================================
// Task Capability
// ============================================================
// Registers: TaskService, TaskRepository, TaskHistoryRepository,
//            TaskDependencyRepository, TaskProgressService
// Subscribes: (pure emitter, no subscriptions needed)
// HealthCheck: DB connectivity via task count query
// ============================================================

import type { IDIContainer, IEventBus, HealthReport } from '@/lib/core/v3/types';
import { BaseCapability } from '../base-capability';
import { ServiceTokens, registerTaskServices } from '../service-factory';

export class TaskCapability extends BaseCapability {
  readonly id = 'task';

  protected async doRegister(container: IDIContainer): Promise<void> {
    await registerTaskServices(container);
  }

  protected async doSubscribe(_bus: IEventBus): Promise<void> {
    // Task module is a pure event emitter, no subscriptions needed
  }

  protected doHealthCheck(): HealthReport {
    return this.healthy('Task services registered');
  }
}
