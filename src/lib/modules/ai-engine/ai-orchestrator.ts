import type { IEventBus, ILogger } from '@/lib/core/types';
import { BaseAIHandler } from './handlers/base.handler';

export class AIOrchestrator {
  private handlers: BaseAIHandler[] = [];

  constructor(
    private eventBus: IEventBus,
    private logger: ILogger,
  ) {}

  registerHandler(handler: BaseAIHandler): void {
    this.handlers.push(handler);
    handler.register();
  }

  getRegisteredHandlers(): string[] {
    return this.handlers.map((h) => h.eventType);
  }

  unregisterAll(): void {
    this.handlers = [];
  }
}
