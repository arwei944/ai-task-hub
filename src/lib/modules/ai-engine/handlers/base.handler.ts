import type { IEventBus, ILogger, DomainEvent } from '@/lib/core/types';

export abstract class BaseAIHandler {
  constructor(
    protected eventBus: IEventBus,
    protected logger: ILogger,
  ) {}

  abstract get eventType(): string;

  abstract handle(event: DomainEvent): Promise<void>;

  async safeHandle(event: DomainEvent): Promise<void> {
    try {
      await this.handle(event);
    } catch (error) {
      this.logger.error(`[AI:${this.eventType}] Handler error:`, error);
    }
  }

  register(): void {
    this.eventBus.on(this.eventType, (event) => this.safeHandle(event));
    this.logger.info(`[AI] Registered handler for "${this.eventType}"`);
  }
}
