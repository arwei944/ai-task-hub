import type { IEventBus, ILogger } from '@/lib/core/types';
import { AgentRepository, type AgentData } from './agent.repository';
import { AgentOperationRepository } from './agent-operation.repository';

export interface RegisterAgentDTO {
  name: string;
  description?: string;
  capabilities?: string[];
  permissionLevel?: 'user' | 'agent';
}

export class AgentService {
  constructor(
    private agentRepo: AgentRepository,
    private operationRepo: AgentOperationRepository,
    private eventBus: IEventBus,
    private logger: ILogger,
  ) {}

  /**
   * Register a new agent. Returns the agent with its API key.
   */
  async registerAgent(dto: RegisterAgentDTO): Promise<AgentData & { apiKey: string }> {
    this.logger.info(`Registering agent: ${dto.name}`);

    // Generate a secure API key
    const apiKey = `ath_${this.generateApiKey()}`;

    const agent = await this.agentRepo.create({
      name: dto.name,
      description: dto.description,
      apiKey,
      capabilities: dto.capabilities ?? ['task_crud'],
      permissionLevel: dto.permissionLevel ?? 'agent',
    });

    this.eventBus.emit({
      type: 'agent.registered',
      payload: { agent },
      timestamp: new Date(),
      source: 'agent-collab',
    });

    this.logger.info(`Agent registered: ${agent.id} (${agent.name})`);
    return { ...agent, apiKey };
  }

  /**
   * Authenticate an agent by API key. Updates lastSeenAt.
   */
  async authenticate(apiKey: string): Promise<AgentData | null> {
    const agent = await this.agentRepo.findByApiKey(apiKey);
    if (!agent) {
      return null;
    }

    if (!agent.isActive) {
      this.logger.warn(`Inactive agent attempted authentication: ${agent.id}`);
      return null;
    }

    await this.agentRepo.updateLastSeen(agent.id);
    return agent;
  }

  /**
   * Get agent by ID
   */
  async getAgent(id: string): Promise<AgentData | null> {
    return this.agentRepo.findById(id);
  }

  /**
   * List all agents
   */
  async listAgents(options?: { isActive?: boolean; page?: number; pageSize?: number }) {
    return this.agentRepo.findMany(options);
  }

  /**
   * Update agent
   */
  async updateAgent(id: string, data: {
    name?: string;
    description?: string;
    capabilities?: string[];
    permissionLevel?: 'user' | 'agent';
    isActive?: boolean;
  }): Promise<AgentData | null> {
    return this.agentRepo.update(id, data);
  }

  /**
   * Deactivate an agent
   */
  async deactivateAgent(id: string): Promise<void> {
    await this.agentRepo.deactivate(id);
    this.logger.info(`Agent deactivated: ${id}`);
  }

  /**
   * Delete an agent and its operations
   */
  async deleteAgent(id: string): Promise<void> {
    await this.operationRepo.deleteByAgent(id);
    await this.agentRepo.delete(id);
    this.logger.info(`Agent deleted: ${id}`);
  }

  /**
   * Get agent operation history
   */
  async getAgentOperations(agentId: string, options?: { action?: string; limit?: number; offset?: number }) {
    return this.operationRepo.findByAgent(agentId, options);
  }

  /**
   * Get recent operations across all agents
   */
  async getRecentOperations(limit = 50) {
    return this.operationRepo.findRecent(limit);
  }

  /**
   * Get agent statistics
   */
  async getAgentStats(agentId: string) {
    return this.operationRepo.getStatsByAgent(agentId);
  }

  private generateApiKey(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}
