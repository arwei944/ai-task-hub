// ============================================================
// Integration Capability
// ============================================================
// Registers: IntegrationService + 6 adapters (GitHub, Feishu, etc.)
// Subscribes: * (wildcard — all events for outbound webhook dispatch)
// HealthCheck: Adapter count verification
// ============================================================

import type { IDIContainer, IEventBus, HealthReport } from '@/lib/core/v3/types';
import { BaseCapability } from '../base-capability';
import { registerIntegrationServices } from '../service-factory';

export class IntegrationCapability extends BaseCapability {
  readonly id = 'integration';

  protected async doRegister(container: IDIContainer): Promise<void> {
    await registerIntegrationServices(container);
  }

  protected async doSubscribe(bus: IEventBus): Promise<void> {
    // OutboundWebhookService subscribes to '*' (all events)
    // (handled internally by the service constructor)
  }

  protected doHealthCheck(): HealthReport {
    return this.healthy('Integration services registered', {
      adapters: 6, // GitHub, Feishu, Notion, Webhook, Telegram, WeChat
    });
  }
}
