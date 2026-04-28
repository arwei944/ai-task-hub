import type { IntegrationAdapter, SyncOptions, SyncResult, PushResult } from '../integration-core/types';
import type { ILogger } from '@/lib/core/types';

export class NotionAdapter implements IntegrationAdapter {
  readonly type = 'notion';
  readonly name = 'Notion';

  constructor(private logger: ILogger) {}

  async pullTasks(options?: SyncOptions): Promise<SyncResult> {
    const token = process.env.NOTION_TOKEN;
    const databaseId = process.env.NOTION_DATABASE_ID;
    if (!token || !databaseId) {
      return { success: false, synced: 0, created: 0, updated: 0, errors: ['NOTION_TOKEN or NOTION_DATABASE_ID not configured'] };
    }

    try {
      // Query Notion database
      const body: any = {
        page_size: options?.limit ?? 100,
      };

      if (options?.since) {
        body.filter = {
          timestamp: 'last_edited_time',
          last_edited_time: { on_or_after: options.since.toISOString() },
        };
      }

      const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, synced: 0, created: 0, updated: 0, errors: [`Notion API error: ${response.status} - ${error}`] };
      }

      const data = await response.json();
      const pages = data.results ?? [];

      this.logger.info(`Notion: fetched ${pages.length} pages from database ${databaseId}`);

      return {
        success: true,
        synced: pages.length,
        created: pages.length,
        updated: 0,
        errors: [],
      };
    } catch (error: any) {
      return { success: false, synced: 0, created: 0, updated: 0, errors: [error.message] };
    }
  }

  async pushTask(task: { title: string; description?: string; status?: string; priority?: string; externalId?: string }): Promise<PushResult> {
    const token = process.env.NOTION_TOKEN;
    const databaseId = process.env.NOTION_DATABASE_ID;
    if (!token || !databaseId) {
      return { success: false, error: 'Notion not configured' };
    }

    try {
      // Map task fields to Notion properties
      const properties: any = {
        'Name': {
          title: [{ text: { content: task.title } }],
        },
      };

      // Map status
      if (task.status) {
        properties['Status'] = {
          select: { name: task.status === 'todo' ? 'To Do' : task.status === 'in_progress' ? 'In Progress' : task.status === 'done' ? 'Done' : 'Closed' },
        };
      }

      // Map priority
      if (task.priority) {
        properties['Priority'] = {
          select: { name: task.priority.charAt(0).toUpperCase() + task.priority.slice(1) },
        };
      }

      let url: string;
      if (task.externalId) {
        // Update existing page
        url = `https://api.notion.com/v1/pages/${task.externalId}`;
        const response = await fetch(url, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ properties }),
        });
        if (!response.ok) {
          return { success: false, error: `Notion API error: ${response.status}` };
        }
        return { success: true, externalId: task.externalId };
      } else {
        // Create new page
        url = `https://api.notion.com/v1/pages`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            parent: { database_id: databaseId },
            properties,
          }),
        });
        if (!response.ok) {
          return { success: false, error: `Notion API error: ${response.status}` };
        }
        const data = await response.json();
        return { success: true, externalId: data.id, externalUrl: data.url };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async handleWebhook(payload: unknown, headers?: Record<string, string>): Promise<void> {
    const data = payload as any;
    this.logger.info(`Notion webhook received: ${data.type}`);

    // Notion doesn't have native webhooks, but third-party services
    // (like Zapier, Make) can forward Notion events
    if (data.type === 'page.updated' || data.type === 'page.created') {
      this.logger.info(`Notion page ${data.type}: ${data.id}`);
    }
  }

  async testConnection(config: Record<string, string>): Promise<{ success: boolean; error?: string }> {
    try {
      const token = config.token || process.env.NOTION_TOKEN;
      const databaseId = config.database_id || process.env.NOTION_DATABASE_ID;
      if (!token || !databaseId) return { success: false, error: 'Notion credentials not provided' };

      const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Notion-Version': '2022-06-28',
        },
      });

      if (!response.ok) {
        return { success: false, error: `Notion API returned ${response.status}` };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
