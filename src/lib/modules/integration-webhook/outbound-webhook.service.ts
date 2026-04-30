// ============================================================
// AI Task Hub - Outbound Webhook Service
// ============================================================
// Independent outbound webhook module that forwards domain events
// to external systems (CI/CD, Slack, custom endpoints).
// Enhanced with retry mechanism and exponential backoff.

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

/** Retry queue item for failed webhook deliveries */
interface RetryQueueItem {
  deliveryId: string;
  webhookId: string;
  webhookName: string;
  url: string;
  eventType: string;
  requestBody: string;
  retryCount: number;
  nextRetryAt: number;
  lastError: string | null;
}

/** Statistics for the retry queue */
export interface RetryQueueStats {
  pendingCount: number;
  totalRetried: number;
  successRate: number;
}

/** Exponential backoff delays: 1s, 4s, 16s (4^0, 4^1, 4^2) */
const BACKOFF_DELAYS_MS = [1000, 4000, 16000];
const DEFAULT_MAX_RETRIES = 3;
const RETRY_PROCESSOR_INTERVAL_MS = 30000;

export class OutboundWebhookService {
  /** In-memory retry queue for failed deliveries */
  private retryQueue: RetryQueueItem[] = [];
  /** Total number of retry attempts performed */
  private totalRetried = 0;
  /** Total number of successful retries */
  private totalRetrySuccess = 0;
  /** Periodic retry processor interval handle */
  private retryProcessorHandle: ReturnType<typeof setInterval> | null = null;
  /** Maximum retry attempts per delivery */
  private maxRetries: number;

  constructor(
    private logger: ILogger,
    private eventBus?: IEventBus,
    private prismaFn: () => ReturnType<typeof getPrisma> = getPrisma,
    maxRetries?: number,
  ) {
    this.maxRetries = maxRetries ?? DEFAULT_MAX_RETRIES;
  }

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
   * Start listening to events and dispatching to matching webhooks.
   * Also starts the periodic retry processor.
   */
  start(): void {
    if (!this.eventBus) {
      this.logger.warn('OutboundWebhookService: No eventBus provided, cannot start');
      return;
    }

    this.eventBus.on('*', async (event: DomainEvent) => {
      await this.dispatchEvent(event);
    });

    // Start periodic retry processor
    this.startRetryProcessor();

    this.logger.info('OutboundWebhookService started, listening to all events');
  }

  /**
   * Stop the service and clean up retry processor
   */
  stop(): void {
    if (this.retryProcessorHandle) {
      clearInterval(this.retryProcessorHandle);
      this.retryProcessorHandle = null;
      this.logger.info('Retry processor stopped');
    }
  }

  /**
   * Dispatch an event to all matching outbound webhooks.
   * Failed deliveries are added to the retry queue if retries are available.
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
        const delivery = await prisma.outboundWebhookDelivery.create({
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

        if (result.success) {
          succeeded++;
        } else {
          failed++;
          // Add to retry queue if retries available
          if (this.maxRetries > 0) {
            this.addToRetryQueue({
              deliveryId: delivery.id,
              webhookId: webhook.id,
              webhookName: webhook.name,
              url: webhook.url,
              eventType: event.type,
              requestBody: JSON.stringify(event),
              retryCount: 0,
              nextRetryAt: Date.now() + BACKOFF_DELAYS_MS[0],
              lastError: result.error,
            });
          }
        }
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

  // ==================== Retry Mechanism ====================

  /**
   * Add a failed delivery to the retry queue
   */
  private addToRetryQueue(item: RetryQueueItem): void {
    this.retryQueue.push(item);
    this.logger.info(`Delivery ${item.deliveryId} added to retry queue (attempt ${item.retryCount + 1}/${this.maxRetries})`);
  }

  /**
   * Start the periodic retry processor that runs every 30 seconds
   */
  private startRetryProcessor(): void {
    if (this.retryProcessorHandle) {
      clearInterval(this.retryProcessorHandle);
    }

    this.retryProcessorHandle = setInterval(() => {
      this.processRetryQueue().catch(err => {
        this.logger.error('Retry processor error', { error: String(err) });
      });
    }, RETRY_PROCESSOR_INTERVAL_MS);

    this.logger.info(`Retry processor started (interval: ${RETRY_PROCESSOR_INTERVAL_MS / 1000}s, max retries: ${this.maxRetries})`);
  }

  /**
   * Process all pending items in the retry queue.
   * Only processes items whose nextRetryAt has elapsed.
   */
  async processRetryQueue(): Promise<{ processed: number; succeeded: number; failed: number }> {
    const now = Date.now();
    const readyItems = this.retryQueue.filter(item => item.nextRetryAt <= now);

    if (readyItems.length === 0) {
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    let succeeded = 0;
    let failed = 0;

    for (const item of readyItems) {
      try {
        const result = await this.retryDeliveryInternal(item);
        this.totalRetried++;

        if (result.success) {
          succeeded++;
          this.totalRetrySuccess++;
          // Remove from queue on success
          this.retryQueue = this.retryQueue.filter(q => q.deliveryId !== item.deliveryId);
          this.logger.info(`Retry succeeded for delivery ${item.deliveryId}`);
        } else {
          failed++;
          const newRetryCount = item.retryCount + 1;

          if (newRetryCount < this.maxRetries) {
            // Update retry count and schedule next attempt
            const nextDelay = BACKOFF_DELAYS_MS[Math.min(newRetryCount, BACKOFF_DELAYS_MS.length - 1)];
            item.retryCount = newRetryCount;
            item.nextRetryAt = Date.now() + nextDelay;
            item.lastError = result.error;
            this.logger.warn(`Retry ${newRetryCount}/${this.maxRetries} failed for delivery ${item.deliveryId}, next attempt in ${nextDelay / 1000}s`);
          } else {
            // Max retries exceeded, remove from queue
            this.retryQueue = this.retryQueue.filter(q => q.deliveryId !== item.deliveryId);
            this.logger.error(`Max retries (${this.maxRetries}) exceeded for delivery ${item.deliveryId}`);
          }

          // Update retryCount in database
          await this.updateDeliveryRetryCount(item.deliveryId, newRetryCount);
        }
      } catch (err: any) {
        failed++;
        this.logger.error(`Retry error for delivery ${item.deliveryId}`, { error: String(err) });
        // Remove problematic item from queue
        this.retryQueue = this.retryQueue.filter(q => q.deliveryId !== item.deliveryId);
      }
    }

    return { processed: readyItems.length, succeeded, failed };
  }

  /**
   * Internally retry a single delivery
   */
  private async retryDeliveryInternal(item: RetryQueueItem): Promise<{
    success: boolean;
    error: string | null;
  }> {
    const prisma = this.prismaFn();
    try {
      const startTime = Date.now();

      // Fetch webhook config for headers/secret
      const webhook = await prisma.outboundWebhook.findUnique({
        where: { id: item.webhookId },
      });

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Event-Type': item.eventType,
        'X-Retry-Count': String(item.retryCount + 1),
      };

      if (webhook?.headers) {
        try {
          const customHeaders = typeof webhook.headers === 'string' ? JSON.parse(webhook.headers) : webhook.headers;
          Object.assign(headers, customHeaders);
        } catch {
          // ignore
        }
      }

      if (webhook?.secret) {
        const crypto = await import('crypto');
        const signature = crypto.createHmac('sha256', webhook.secret).update(item.requestBody).digest('hex');
        headers['X-Webhook-Signature'] = `sha256=${signature}`;
      }

      const response = await fetch(item.url, {
        method: 'POST',
        headers,
        body: item.requestBody,
        signal: AbortSignal.timeout(30000),
      });

      const duration = Date.now() - startTime;
      const body = await response.text().catch(() => null);

      // Update delivery record
      await prisma.outboundWebhookDelivery.update({
        where: { id: item.deliveryId },
        data: {
          statusCode: response.status,
          responseBody: body?.slice(0, 10000),
          duration,
          success: response.ok,
          error: response.ok ? null : `HTTP ${response.status} (retry ${item.retryCount + 1})`,
          retryCount: item.retryCount + 1,
        },
      });

      return {
        success: response.ok,
        error: response.ok ? null : `HTTP ${response.status}`,
      };
    } catch (error: any) {
      // Update delivery record with error
      try {
        await prisma.outboundWebhookDelivery.update({
          where: { id: item.deliveryId },
          data: {
            success: false,
            error: error.message,
            retryCount: item.retryCount + 1,
          },
        });
      } catch {
        // ignore update errors
      }
      return { success: false, error: error.message };
    } finally {
      await prisma.$disconnect();
    }
  }

  /**
   * Update the retryCount field on a delivery record
   */
  private async updateDeliveryRetryCount(deliveryId: string, retryCount: number): Promise<void> {
    const prisma = this.prismaFn();
    try {
      await prisma.outboundWebhookDelivery.update({
        where: { id: deliveryId },
        data: { retryCount },
      });
    } catch (error: any) {
      this.logger.error(`Failed to update retry count for delivery ${deliveryId}`, { error: String(error) });
    } finally {
      await prisma.$disconnect();
    }
  }

  /**
   * Manually retry a failed webhook delivery by ID
   * @param deliveryId - The delivery record ID to retry
   * @returns Result of the retry attempt
   */
  async retryDelivery(deliveryId: string): Promise<{ success: boolean; error?: string; retryCount: number }> {
    const prisma = this.prismaFn();
    try {
      const delivery = await prisma.outboundWebhookDelivery.findUnique({
        where: { id: deliveryId },
      });

      if (!delivery) {
        return { success: false, error: 'Delivery not found', retryCount: 0 };
      }

      if (delivery.success) {
        return { success: false, error: 'Delivery already succeeded', retryCount: delivery.retryCount };
      }

      // Check if already in retry queue
      const existingInQueue = this.retryQueue.find(q => q.deliveryId === deliveryId);
      if (existingInQueue) {
        return { success: false, error: 'Delivery already in retry queue', retryCount: existingInQueue.retryCount };
      }

      const item: RetryQueueItem = {
        deliveryId: delivery.id,
        webhookId: delivery.webhookId,
        webhookName: '',
        url: delivery.url,
        eventType: delivery.eventType,
        requestBody: delivery.requestBody,
        retryCount: delivery.retryCount,
        nextRetryAt: Date.now(), // Retry immediately
        lastError: delivery.error,
      };

      const result = await this.retryDeliveryInternal(item);
      this.totalRetried++;

      if (result.success) {
        this.totalRetrySuccess++;
      } else {
        // Add to queue for automatic retry if under max
        if (delivery.retryCount + 1 < this.maxRetries) {
          this.addToRetryQueue(item);
        }
      }

      return {
        success: result.success,
        error: result.error ?? undefined,
        retryCount: delivery.retryCount + 1,
      };
    } catch (error: any) {
      return { success: false, error: error.message, retryCount: 0 };
    } finally {
      await prisma.$disconnect();
    }
  }

  /**
   * Get statistics about the retry queue
   * @returns Object with pending count, total retried, and success rate
   */
  getRetryQueueStats(): RetryQueueStats {
    const pendingCount = this.retryQueue.length;
    const successRate = this.totalRetried > 0
      ? Math.round((this.totalRetrySuccess / this.totalRetried) * 100) / 100
      : 0;

    return {
      pendingCount,
      totalRetried: this.totalRetried,
      successRate,
    };
  }

  /**
   * Clear all pending items from the retry queue
   * @returns The number of items that were cleared
   */
  clearRetryQueue(): number {
    const count = this.retryQueue.length;
    this.retryQueue = [];
    this.logger.info(`Retry queue cleared (${count} items removed)`);
    return count;
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
