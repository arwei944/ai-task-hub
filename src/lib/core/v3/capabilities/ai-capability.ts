// ============================================================
// AI Capability
// ============================================================
// Registers: AI model adapter, extractors, decomposers, analyzers
// Subscribes: 8 domain events via AI Orchestrator handlers
// HealthCheck: AI model availability (API key check)
// ============================================================

import type { IDIContainer, IEventBus, HealthReport } from '@/lib/core/v3/types';
import { BaseCapability } from '../base-capability';
import { ServiceTokens, registerAIServices } from '../service-factory';

export class AICapability extends BaseCapability {
  readonly id = 'ai';

  protected async doRegister(container: IDIContainer): Promise<void> {
    await registerAIServices(container);
  }

  protected async doSubscribe(bus: IEventBus): Promise<void> {
    // AI Orchestrator registers 8 event handlers
    // (handled internally by AIOrchestrator.registerHandler)
  }

  protected doHealthCheck(): HealthReport {
    const hasApiKey = !!process.env.OPENAI_API_KEY;
    if (hasApiKey) {
      return this.healthy('AI services ready', { model: process.env.AI_MODEL ?? 'gpt-4o' });
    }
    return this.degraded('No AI API key configured — AI features will be limited', {
      hasApiKey: false,
    });
  }
}
