// ============================================================
// AI Task Hub - Outbound Webhook Service
// ============================================================
// Independent outbound webhook module that forwards domain events
// to external systems (CI/CD, Slack, custom endpoints).

import { getPrisma } from '@/lib/db';
import type { ILogger, IEventBus, DomainEvent } from '@/lib/core/types';

export interface OutboundWebhookConfig {
  id?: string;
  name: string;
  url: string;
  secret?: string;
  /** Comma-separated event patterns to subscribe (e.g., "task.*,deployment.*") */
  eventPatterns: string;
  /** Custom headers (JSON string) */
  headers?: string;
  isActive?: boolean;
}

export interface OutboundWebhookDelivery {
  id: string;
  webhookId: string;
  webhookName: string;
  eventType: string;
  url: string;
  method: string;
  requestBody: string;
  responseBody: string | null;
  statusCode: number | null;
  duration: number;
  success: boolean;
  error: string | null;
  retryCount: number;
  createdAt: Date;
}

export class OutboundWebhookService {
  constructor(
    private logger: ILogger,
    private eventBus?: IEventBus,
    private prismaFn: () => ReturnType<typeof getPrisma> = getPrisma,
  ) {}

  // ==================== Webhook CRUD ====================

  async createWebhook(config: OutboundWebhookConfig): Promise<OutboundWebhookConfig & { id: string }> {
    const prisma = this.prismaFn();
    try {
      const webhook = await prisma.outboundWebhook.create({
        data: {
          name: config.name,
          url: config.url,
          secret: config.secret ?? null,
          eventPatterns: config.eventPatterns,
          headers: config.headers ?? null,
          isActive: config.isActive ?? true,
        },
      });

      this.logger.info(`Outbound webhook created: ${config.name} (${webhook.id})`);
      return {
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        secret: webhook.secret ?? undefined,
        eventPatterns: webhook.eventPatterns,
        headers: webhook.headers ?? undefined,
        isActive: webhook.isActive,
      };
    } finally {
      await prisma.$disconnect();
    }
  }

  async listWebhooks(filters?: { isActive?: boolean }): Promise<OutboundWebhookConfig[]> {
    const prisma = this.prismaFn();
    try {
      const where: Record<string, unknown> = {};
      if (filters?.isActive !== undefined) where.isActive = filters.isActive;

      const webhooks = await prisma.outboundWebhook.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });

      return webhooks.map(w => ({
        id: w.id,
        name: w.name,
        url: w.url,
        secret: w.secret ?? undefined,
        eventPatterns: w.eventPatterns,
        headers: w.headers ?? undefined,
        isActive: w.isActive,
      }));
    } finally {
      await prisma.$disconnect();
    }
  }

  async updateWebhook(id: string, updates: Partial<OutboundWebhookConfig>): Promise<OutboundWebhookConfig | null> {
    const prisma = this.prismaFn();
    try {
      const data: Record<string, unknown> = {};
      if (updates.name !== undefined) data.name = updates.name;
      if (updates.url !== undefined) data.url = updates.url;
      if (updates.secret !== undefined) data.secret = updates.secret;
      if (updates.eventPatterns !== undefined) data.eventPatterns = updates.eventPatterns;
      if (updates.headers !== undefined) data.headers = updates.headers;
      if (updates.isActive !== undefined) data.isActive = updates.isActive;

      const webhook = await prisma.outboundWebhook.update({
        where: { id },
        data,
      });

      return {
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        secret: webhook.secret ?? undefined,
        eventPatterns: webhook.eventPatterns,
        headers: webhook.headers ?? undefined,
        isActive: webhook.isActive,
      };
    } catch (error: any) {
      if (error.code === 'P2025') return null;
      throw error;
    } finally {
      await prisma.$disconnect();
    }
  }

  async deleteWebhook(id: string): Promise<boolean> {
    const prisma = this.prismaFn();
    try {
      await prisma.outboundWebhook.delete({ where: { id } });
      return true;
    } catch (error: any) {
      if (error.code === 'P2025') return false;
      throw error;
    } finally {
      await prisma.$disconnect();
    }
  }

  // ==================== Event Dispatching ====================

  /**
   * Start listening to events and dispatching to matching webhooks
   */
  start(): void {
    if (!this.eventBus) {
      this.logger.warn('OutboundWebhookService: No eventBus provided, cannot start');
      return;
    }

    this.eventBus.on('*', async (event: DomainEvent) => {
      await this.dispatchEvent(event);
    });

    this.logger.info('OutboundWebhookService started, listening to all events');
  }

  /**
   * Dispatch an event to all matching outbound webhooks
   */
  async dispatchEvent(event: DomainEvent): Promise<{ dispatched: number; succeeded: number; failed: number }> {
    const prisma = this.prismaFn();
    try {
      const webhooks = await prisma.outboundWebhook.findMany({
        where: { isActive: true },
      });

      let dispatched = 0;
      let succeeded = 0;
      let failed = 0;

      for (const webhook of webhooks) {
        if (!this.matchesEvent(webhook.eventPatterns, event.type)) continue;

        dispatched++;
        const result = await this.sendWebhook(webhook, event);

        // Record delivery
        await prisma.outboundWebhookDelivery.create({
          data: {
            webhookId: webhook.id,
            eventType: event.type,
            url: webhook.url,
            method: 'POST',
            requestBody: JSON.stringify(event),
            responseBody: result.body,
            statusCode: result.statusCode,
            duration: result.duration,
            success: result.success,
            error: result.error,
            retryCount: 0,
          },
        });

        if (result.success) succeeded++;
        else failed++;
      }

      return { dispatched, succeeded, failed };
    } finally {
      await prisma.$disconnect();
    }
  }

  /**
   * Send a webhook HTTP request
   */
  private async sendWebhook(webhook: any, event: DomainEvent): Promise<{
    success: boolean;
    statusCode: number | null;
    body: string | null;
    duration: number;
    error: string | null;
  }> {
    const startTime = Date.now();

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Event-Type': event.type,
        'X-Event-Source': event.source ?? 'unknown',
        'X-Event-Timestamp': new Date(event.timestamp).toISOString(),
      };

      // Add custom headers
      if (webhook.headers) {
        try {
          const customHeaders = typeof webhook.headers === 'string' ? JSON.parse(webhook.headers) : webhook.headers;
          Object.assign(headers, customHeaders);
        } catch {
          // ignore invalid headers
        }
      }

      // Add signature if secret is configured
      if (webhook.secret) {
        const crypto = await import('crypto');
        const payload = JSON.stringify(event);
        const signature = crypto.createHmac('sha256', webhook.secret).update(payload).digest('hex');
        headers['X-Webhook-Signature'] = `sha256=${signature}`;
      }

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(event),
        signal: AbortSignal.timeout(30000), // 30s timeout
      });

      const duration = Date.now() - startTime;
      const body = await response.text().catch(() => null);

      return {
        success: response.ok,
        statusCode: response.status,
        body: body?.slice(0, 10000), // truncate large responses
        duration,
        error: response.ok ? null : `HTTP ${response.status}`,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        statusCode: null,
        body: null,
        duration,
        error: error.message,
      };
    }
  }

  // ==================== Delivery Logs ====================

  async listDeliveries(filters?: {
    webhookId?: string;
    eventType?: string;
    success?: boolean;
    limit?: number;
  }): Promise<OutboundWebhookDelivery[]> {
    const prisma = this.prismaFn();
    try {
      const where: Record<string, unknown> = {};
      if (filters?.webhookId) where.webhookId = filters.webhookId;
      if (filters?.eventType) where.eventType = filters.eventType;
      if (filters?.success !== undefined) where.success = filters.success;

      const deliveries = await prisma.outboundWebhookDelivery.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters?.limit ?? 50,
      });

      return deliveries.map(d => ({
        id: d.id,
        webhookId: d.webhookId,
        webhookName: '', // would need join
        eventType: d.eventType,
        url: d.url,
        method: d.method,
        requestBody: d.requestBody,
        responseBody: d.responseBody,
        statusCode: d.statusCode,
        duration: d.duration,
        success: d.success,
        error: d.error,
        retryCount: d.retryCount,
        createdAt: d.createdAt,
      }));
    } finally {
      await prisma.$disconnect();
    }
  }

  // ==================== Helpers ====================

  private matchesEvent(patterns: string, eventType: string): boolean {
    const patternList = patterns.split(',').map(p => p.trim());
    return patternList.some(pattern => {
      if (pattern === '*') return true;
      if (pattern === eventType) return true;
      if (pattern.endsWith('.*')) {
        return eventType.startsWith(pattern.slice(0, -2));
      }
      return false;
    });
  }
}
