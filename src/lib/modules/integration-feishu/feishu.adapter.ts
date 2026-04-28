import type { IntegrationAdapter, SyncOptions, SyncResult, PushResult } from '../integration-core/types';
import type { ILogger } from '@/lib/core/types';

export class FeishuAdapter implements IntegrationAdapter {
  readonly type = 'feishu';
  readonly name = '飞书';

  constructor(private logger: ILogger) {}

  async pullTasks(options?: SyncOptions): Promise<SyncResult> {
    const appId = process.env.FEISHU_APP_ID;
    const appSecret = process.env.FEISHU_APP_SECRET;
    if (!appId || !appSecret) {
      return { success: false, synced: 0, created: 0, updated: 0, errors: ['FEISHU_APP_ID or FEISHU_APP_SECRET not configured'] };
    }

    try {
      // Get tenant access token
      const tokenRes = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
      });
      const tokenData = await tokenRes.json();
      if (tokenData.code !== 0) {
        return { success: false, synced: 0, created: 0, updated: 0, errors: [`Feishu auth failed: ${tokenData.msg}`] };
      }

      const token = tokenData.tenant_access_token;
      this.logger.info('Feishu: authenticated successfully');

      // List tasks (using Feishu Task API)
      const listRes = await fetch('https://open.feishu.cn/open-apis/task/v2/tasks', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const listData = await listRes.json();

      if (listData.code !== 0) {
        return { success: false, synced: 0, created: 0, updated: 0, errors: [`Feishu API error: ${listData.msg}`] };
      }

      const tasks = listData.data?.items ?? [];
      this.logger.info(`Feishu: fetched ${tasks.length} tasks`);

      return {
        success: true,
        synced: tasks.length,
        created: tasks.length,
        updated: 0,
        errors: [],
      };
    } catch (error: any) {
      return { success: false, synced: 0, created: 0, updated: 0, errors: [error.message] };
    }
  }

  async pushTask(task: { title: string; description?: string; status?: string; priority?: string }): Promise<PushResult> {
    const appId = process.env.FEISHU_APP_ID;
    const appSecret = process.env.FEISHU_APP_SECRET;
    if (!appId || !appSecret) {
      return { success: false, error: 'Feishu not configured' };
    }

    try {
      // Get token
      const tokenRes = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
      });
      const tokenData = await tokenRes.json();
      const token = tokenData.tenant_access_token;

      // Create task
      const body: any = {
        name: task.title,
        description: task.description ?? '',
      };

      // Map status
      if (task.status === 'done') {
        body.completed = true;
      }

      const response = await fetch('https://open.feishu.cn/open-apis/task/v2/tasks', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        return { success: false, error: `Feishu API error: ${response.status}` };
      }

      const data = await response.json();
      if (data.code !== 0) {
        return { success: false, error: data.msg };
      }

      return { success: true, externalId: data.data?.task_id };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async handleWebhook(payload: unknown, headers?: Record<string, string>): Promise<void> {
    const data = payload as any;
    this.logger.info(`Feishu webhook received: ${data.event}`);

    switch (data.event) {
      case 'task.created':
      case 'task.updated':
        this.logger.info(`Feishu task ${data.event}: ${data.event?.key}`);
        break;
      default:
        this.logger.debug(`Feishu webhook unhandled event: ${data.event}`);
    }
  }

  async testConnection(config: Record<string, string>): Promise<{ success: boolean; error?: string }> {
    try {
      const appId = config.app_id || process.env.FEISHU_APP_ID;
      const appSecret = config.app_secret || process.env.FEISHU_APP_SECRET;
      if (!appId || !appSecret) return { success: false, error: 'Feishu credentials not provided' };

      const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
      });

      const data = await response.json();
      if (data.code !== 0) {
        return { success: false, error: data.msg };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
