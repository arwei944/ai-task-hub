import type { ILogger } from '@/lib/core/types';
import type { IEventBus } from '@/lib/core/types';
import { AgentOperationRepository } from './agent-operation.repository';

/**
 * Agent Operation Logger
 *
 * Records every operation performed by an agent.
 * Emits domain events for each operation.
 */
export class AgentOperationLogger {
  constructor(
    private operationRepo: AgentOperationRepository,
    private eventBus: IEventBus,
    private logger: ILogger,
  ) {}

  /**
   * Log an agent operation
   */
  async log(data: {
    agentId: string;
    agentName?: string;
    action: string;
    target?: string;
    details?: Record<string, unknown>;
    success?: boolean;
    error?: string;
  }): Promise<void> {
    const operation = await this.operationRepo.create({
      agentId: data.agentId,
      action: data.action,
      target: data.target,
      details: data.details,
      success: data.success ?? true,
      error: data.error,
    });

    // Emit domain event
    this.eventBus.emit({
      type: 'agent.operation',
      payload: {
        agentId: data.agentId,
        agentName: data.agentName,
        operation: data.action,
        target: data.target,
        success: data.success ?? true,
      },
      timestamp: new Date(),
      source: 'agent-collab',
    });

    this.logger.debug(
      `Agent operation logged: ${data.agentName ?? data.agentId} -> ${data.action}${data.target ? ` on ${data.target}` : ''}`,
    );
  }

  /**
   * Log a successful operation
   */
  async logSuccess(agentId: string, agentName: string, action: string, target?: string, details?: Record<string, unknown>): Promise<void> {
    return this.log({
      agentId,
      agentName,
      action,
      target,
      details,
      success: true,
    });
  }

  /**
   * Log a failed operation
   */
  async logFailure(agentId: string, agentName: string, action: string, error: string, target?: string): Promise<void> {
    return this.log({
      agentId,
      agentName,
      action,
      target,
      success: false,
      error,
    });
  }
}
