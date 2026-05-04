// ============================================================
// Notification Capability
// ============================================================
// Registers: NotificationRepository, NotificationRuleEngine, WebPushService
// Subscribes: 34 domain events via rule-engine.start()
// HealthCheck: Rule engine active status
// ============================================================

import type { IDIContainer, IEventBus, HealthReport } from '@/lib/core/v3/types';
import { BaseCapability } from '../base-capability';
import { ServiceTokens, registerNotificationServices } from '../service-factory';

export class NotificationCapability extends BaseCapability {
  readonly id = 'notification';
  private _container: IDIContainer | null = null;

  protected async doRegister(container: IDIContainer): Promise<void> {
    this._container = container;
    await registerNotificationServices(container);
  }

  protected async doSubscribe(_bus: IEventBus): Promise<void> {
    // Rule engine subscribes to 34 domain events via start()
    // Already handled in mcp-modules.ts notification-rule init
    // For v3 kernel boot, ensure rule engine is active
    if (this._container) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ruleEngine = this._container.resolve<import('@/lib/modules/notifications/rule-engine').NotificationRuleEngine>(ServiceTokens.ruleEngine);
        if (ruleEngine && typeof ruleEngine.start === 'function') {
          ruleEngine.start();
        }
      } catch {
        // Rule engine may not be available in all environments
      }
    }
  }

  protected doHealthCheck(): HealthReport {
    return this.healthy('Notification services registered');
  }
}
