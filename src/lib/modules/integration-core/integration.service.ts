import type { IEventBus, ILogger } from '@/lib/core/types';
import { IntegrationRepository, WebhookRepository, type IntegrationData } from './integration.repository';
import type { IntegrationAdapter, SyncResult } from './types';
import { TaskService } from '@/lib/modules/task-core/task.service';

export class IntegrationService {
  private adapters: Map<string, IntegrationAdapter> = new Map();

  constructor(
    private integrationRepo: IntegrationRepository,
    private webhookRepo: WebhookRepository,
    private taskService: TaskService,
    private eventBus: IEventBus,
    private logger: ILogger,
  ) {}

  /**
   * Register an integration adapter
   */
  registerAdapter(adapter: IntegrationAdapter): void {
    this.adapters.set(adapter.type, adapter);
    this.logger.info(`Integration adapter registered: ${adapter.type} (${adapter.name})`);
  }

  /**
   * Get all registered adapter types
   */
  getAdapterTypes(): { type: string; name: string }[] {
    return Array.from(this.adapters.values()).map(a => ({ type: a.type, name: a.name }));
  }

  /**
   * Get adapter by type
   */
  getAdapter(type: string): IntegrationAdapter | undefined {
    return this.adapters.get(type);
  }

  /**
   * Create a new integration
   */
  async createIntegration(data: {
    type: string;
    name: string;
    description?: string;
    config: Record<string, unknown>;
  }): Promise<IntegrationData> {
    const adapter = this.adapters.get(data.type);
    if (!adapter) {
      throw new Error(`Unknown integration type: ${data.type}. Available: ${Array.from(this.adapters.keys()).join(', ')}`);
    }

    const integration = await this.integrationRepo.create(data);

    this.eventBus.emit({
      type: 'integration.created',
      payload: { integration },
      timestamp: new Date(),
      source: 'integration-core',
    });

    return integration;
  }

  /**
   * List integrations
   */
  async listIntegrations(options?: { type?: string; isActive?: boolean }): Promise<IntegrationData[]> {
    return this.integrationRepo.findMany(options);
  }

  /**
   * Get integration by ID
   */
  async getIntegration(id: string): Promise<IntegrationData | null> {
    return this.integrationRepo.findById(id);
  }

  /**
   * Update integration
   */
  async updateIntegration(id: string, data: {
    name?: string;
    description?: string;
    config?: Record<string, unknown>;
    isActive?: boolean;
  }): Promise<IntegrationData | null> {
    return this.integrationRepo.update(id, data);
  }

  /**
   * Delete integration
   */
  async deleteIntegration(id: string): Promise<void> {
    await this.integrationRepo.delete(id);
  }

  /**
   * Test connection for an integration
   */
  async testConnection(id: string): Promise<{ success: boolean; error?: string }> {
    const integration = await this.integrationRepo.findById(id);
    if (!integration) throw new Error('Integration not found');

    const adapter = this.adapters.get(integration.type);
    if (!adapter) throw new Error(`No adapter for type: ${integration.type}`);

    return adapter.testConnection(integration.config as unknown as Record<string, string>);
  }

  /**
   * Trigger sync for an integration
   */
  async syncIntegration(id: string): Promise<SyncResult> {
    const integration = await this.integrationRepo.findById(id);
    if (!integration) throw new Error('Integration not found');

    const adapter = this.adapters.get(integration.type);
    if (!adapter) throw new Error(`No adapter for type: ${integration.type}`);

    // Update status to syncing
    await this.integrationRepo.update(id, { syncStatus: 'syncing' });

    try {
      const result = await adapter.pullTasks(undefined, this.taskService);
      await this.integrationRepo.update(id, {
        syncStatus: result.success ? 'idle' : 'error',
        lastSyncAt: new Date(),
        lastError: result.errors.length > 0 ? result.errors.join('; ') : null,
      });

      this.eventBus.emit({
        type: 'integration.synced',
        payload: { integrationId: id, type: integration.type, result },
        timestamp: new Date(),
        source: 'integration-core',
      });

      return result;
    } catch (error: any) {
      await this.integrationRepo.update(id, { syncStatus: 'error', lastError: error.message });
      return { success: false, synced: 0, created: 0, updated: 0, errors: [error.message] };
    }
  }

  /**
   * Handle incoming webhook
   */
  async handleWebhook(integrationType: string, payload: unknown, headers?: Record<string, string>): Promise<void> {
    const adapter = this.adapters.get(integrationType);
    if (!adapter) {
      this.logger.warn(`No adapter for webhook type: ${integrationType}`);
      return;
    }

    try {
      await adapter.handleWebhook(payload, headers);
    } catch (error: any) {
      this.logger.error(`Webhook handling failed for ${integrationType}: ${error.message}`);
    }
  }
}
