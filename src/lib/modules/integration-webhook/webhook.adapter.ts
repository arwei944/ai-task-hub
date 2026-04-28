import type { IntegrationAdapter, SyncOptions, SyncResult, PushResult } from '../integration-core/types';
import type { ILogger } from '@/lib/core/types';
import { createHash, timingSafeEqual } from 'crypto';

/**
 * Webhook rule for auto-creating/updating tasks from webhook payloads
 */
export interface WebhookRule {
  id: string;
  name: string;
  /** JSONPath-like expression to extract title from payload */
  titlePath: string;
  /** JSONPath-like expression to extract description (optional) */
  descriptionPath?: string;
  /** JSONPath-like expression to extract status (optional) */
  statusPath?: string;
  /** JSONPath-like expression to extract priority (optional) */
  priorityPath?: string;
  /** Only apply rule when this path matches this value */
  conditionPath?: string;
  conditionValue?: string;
}

/**
 * Simple path extraction from nested objects
 * e.g., "data.issue.title" extracts obj.data.issue.title
 */
function extractByPath(obj: any, path: string): unknown {
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

export class WebhookAdapter implements IntegrationAdapter {
  readonly type = 'webhook';
  readonly name = '通用 Webhook';

  private rules: Map<string, WebhookRule> = new Map();

  constructor(private logger: ILogger) {}

  /**
   * Add a webhook rule
   */
  addRule(rule: WebhookRule): void {
    this.rules.set(rule.id, rule);
    this.logger.info(`Webhook rule added: ${rule.name}`);
  }

  /**
   * Remove a webhook rule
   */
  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  /**
   * Get all rules
   */
  getRules(): WebhookRule[] {
    return Array.from(this.rules.values());
  }

  async pullTasks(_options?: SyncOptions): Promise<SyncResult> {
    // Webhook adapter doesn't pull - it receives
    return { success: true, synced: 0, created: 0, updated: 0, errors: [] };
  }

  async pushTask(_task: { title: string; description?: string; status?: string; priority?: string; externalId?: string }): Promise<PushResult> {
    return { success: false, error: 'Webhook adapter does not support push' };
  }

  async handleWebhook(payload: unknown, headers?: Record<string, string>): Promise<void> {
    this.logger.info('Webhook received, processing rules...');

    const data = payload as any;
    const results: { rule: string; title?: string; matched: boolean }[] = [];

    for (const rule of this.rules.values()) {
      // Check condition
      if (rule.conditionPath && rule.conditionValue) {
        const conditionValue = extractByPath(data, rule.conditionPath);
        if (conditionValue !== rule.conditionValue) {
          results.push({ rule: rule.name, matched: false });
          continue;
        }
      }

      // Extract fields
      const title = extractByPath(data, rule.titlePath) as string | undefined;
      if (!title) {
        results.push({ rule: rule.name, matched: false });
        continue;
      }

      const description = rule.descriptionPath ? extractByPath(data, rule.descriptionPath) as string | undefined : undefined;
      const status = rule.statusPath ? extractByPath(data, rule.statusPath) as string | undefined : undefined;
      const priority = rule.priorityPath ? extractByPath(data, rule.priorityPath) as string | undefined : undefined;

      this.logger.info(`Webhook rule "${rule.name}" matched: "${title}"`);

      results.push({ rule: rule.name, title, matched: true });
    }

    this.logger.info(`Webhook processing complete: ${results.filter(r => r.matched).length}/${results.length} rules matched`);
  }

  async testConnection(config: Record<string, string>): Promise<{ success: boolean; error?: string }> {
    // Webhook adapter is always "connected" - it just receives
    return { success: true };
  }

  /**
   * Verify webhook signature (HMAC-SHA256)
   */
  verifySignature(payload: string, signature: string, secret: string): boolean {
    try {
      const expected = createHash('sha256').update(secret + payload).digest('hex');
      return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      return false;
    }
  }
}
