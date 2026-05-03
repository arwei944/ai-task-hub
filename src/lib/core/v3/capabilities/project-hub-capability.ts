import type { IDIContainer, IEventBus, HealthReport } from '@/lib/core/v3/types';
import { BaseCapability } from '../base-capability';
import { registerProjectHubServices } from '../service-factory';

export class ProjectHubCapability extends BaseCapability {
  readonly id = 'project-hub';

  protected async doRegister(container: IDIContainer): Promise<void> {
    await registerProjectHubServices(container);
  }

  protected async doSubscribe(_bus: IEventBus): Promise<void> {
    // Project Hub subscriptions can be added later
    // e.g., listen for task events to update project stats
  }

  protected doHealthCheck(): HealthReport {
    return this.healthy('Project Hub services registered');
  }
}
