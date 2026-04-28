import { PrismaClient } from '@/generated/prisma/client';

export interface IntegrationData {
  id: string;
  type: string;
  name: string;
  description: string | null;
  config: Record<string, unknown>;
  isActive: boolean;
  lastSyncAt: Date | null;
  syncStatus: string;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookData {
  id: string;
  integrationId: string | null;
  name: string;
  url: string;
  secret: string | null;
  events: string[];
  isActive: boolean;
  lastTriggered: Date | null;
  triggerCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export class IntegrationRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: {
    type: string;
    name: string;
    description?: string;
    config: Record<string, unknown>;
  }): Promise<IntegrationData> {
    const integration = await this.prisma.integration.create({
      data: {
        type: data.type,
        name: data.name,
        description: data.description,
        config: JSON.stringify(data.config),
      },
    });
    return this.toIntegrationData(integration);
  }

  async findById(id: string): Promise<IntegrationData | null> {
    const integration = await this.prisma.integration.findUnique({ where: { id } });
    return integration ? this.toIntegrationData(integration) : null;
  }

  async findByType(type: string): Promise<IntegrationData[]> {
    const integrations = await this.prisma.integration.findMany({
      where: { type },
      orderBy: { createdAt: 'desc' },
    });
    return integrations.map(this.toIntegrationData);
  }

  async findActive(): Promise<IntegrationData[]> {
    const integrations = await this.prisma.integration.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    return integrations.map(this.toIntegrationData);
  }

  async findMany(options?: { type?: string; isActive?: boolean }): Promise<IntegrationData[]> {
    const where: any = {};
    if (options?.type) where.type = options.type;
    if (options?.isActive !== undefined) where.isActive = options.isActive;

    const integrations = await this.prisma.integration.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return integrations.map(this.toIntegrationData);
  }

  async update(id: string, data: {
    name?: string;
    description?: string;
    config?: Record<string, unknown>;
    isActive?: boolean;
    syncStatus?: string;
    lastSyncAt?: Date;
    lastError?: string | null;
  }): Promise<IntegrationData | null> {
    const integration = await this.prisma.integration.update({
      where: { id },
      data: {
        ...data,
        config: data.config ? JSON.stringify(data.config) : undefined,
      },
    });
    return this.toIntegrationData(integration);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.integration.delete({ where: { id } });
  }

  private toIntegrationData(integration: any): IntegrationData {
    return {
      ...integration,
      config: integration.config ? JSON.parse(integration.config) : {},
    };
  }
}

export class WebhookRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: {
    integrationId?: string;
    name: string;
    url: string;
    secret?: string;
    events?: string[];
  }): Promise<WebhookData> {
    const webhook = await this.prisma.webhook.create({
      data: {
        integrationId: data.integrationId,
        name: data.name,
        url: data.url,
        secret: data.secret,
        events: data.events ? JSON.stringify(data.events) : null,
      },
    });
    return this.toWebhookData(webhook);
  }

  async findByIntegration(integrationId: string): Promise<WebhookData[]> {
    const webhooks = await this.prisma.webhook.findMany({
      where: { integrationId },
      orderBy: { createdAt: 'desc' },
    });
    return webhooks.map(this.toWebhookData);
  }

  async findActive(): Promise<WebhookData[]> {
    const webhooks = await this.prisma.webhook.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    return webhooks.map(this.toWebhookData);
  }

  async updateTrigger(id: string): Promise<void> {
    await this.prisma.webhook.update({
      where: { id },
      data: {
        lastTriggered: new Date(),
        triggerCount: { increment: 1 },
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.webhook.delete({ where: { id } });
  }

  private toWebhookData(webhook: any): WebhookData {
    return {
      ...webhook,
      events: webhook.events ? JSON.parse(webhook.events) : [],
    };
  }
}
