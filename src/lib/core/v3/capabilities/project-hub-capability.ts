import type { IDIContainer, IEventBus, HealthReport } from '@/lib/core/v3/types';
import { BaseCapability } from '../base-capability';
import { registerProjectHubServices } from '../service-factory';

export class ProjectHubCapability extends BaseCapability {
  readonly id = 'project-hub';

  protected async doRegister(container: IDIContainer): Promise<void> {
    await registerProjectHubServices(container);

    // Seed built-in templates on first registration
    try {
      const templateService = container.resolve<any>('templateService');
      await templateService.seedBuiltInTemplates();
    } catch (err) {
      // Non-fatal: templates can be seeded later
      console.warn('[ProjectHubCapability] Failed to seed built-in templates:', err);
    }
  }

  protected async doSubscribe(_bus: IEventBus): Promise<void> {
    // Project Hub subscriptions can be added later
    // e.g., listen for task events to update project stats
  }

  protected doHealthCheck(): HealthReport {
    return this.healthy('Project Hub services registered');
  }
}
