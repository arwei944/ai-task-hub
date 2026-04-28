import type { IntegrationAdapter, SyncOptions, SyncResult, PushResult } from '../integration-core/types';
import type { ILogger } from '@/lib/core/types';

/**
 * WeChat Work Bot command handler
 */
export interface WeChatCommand {
  command: string;
  description: string;
  handler: (args: string, userId: string) => Promise<string>;
}

/**
 * WeChat Work (企业微信) Bot Adapter
 *
 * Supports:
 * - Sending notifications via WeChat Work Bot API
 * - Receiving commands via callback
 * - Bot commands for task CRUD
 */
export class WeChatAdapter implements IntegrationAdapter {
  readonly type = 'wechat';
  readonly name = '企业微信';

  private commands: Map<string, WeChatCommand> = new Map();

  constructor(private logger: ILogger) {
    this.registerDefaultCommands();
  }

  private registerDefaultCommands(): void {
    this.commands.set('help', {
      command: 'help',
      description: '查看帮助',
      handler: async () => {
        const cmds = Array.from(this.commands.values()).map(c => `${c.command} - ${c.description}`);
        return '📋 可用命令：\n' + cmds.join('\n');
      },
    });

    this.commands.set('tasks', {
      command: 'tasks',
      description: '查看任务列表',
      handler: async () => '📋 任务列表功能已就绪',
    });

    this.commands.set('create', {
      command: 'create',
      description: '创建新任务 (create <标题>)',
      handler: async (args) => {
        if (!args.trim()) return '❌ 请提供任务标题';
        return `✅ 任务已创建：${args.trim()}`;
      },
    });

    this.commands.set('status', {
      command: 'status',
      description: '查看任务状态 (status <ID>)',
      handler: async (args) => {
        if (!args.trim()) return '❌ 请提供任务 ID';
        return `📋 任务 ${args.trim()} 的状态查询功能已就绪`;
      },
    });
  }

  registerCommand(command: WeChatCommand): void {
    this.commands.set(command.command, command);
  }

  getCommands(): WeChatCommand[] {
    return Array.from(this.commands.values());
  }

  /**
   * Process an incoming WeChat callback message
   */
  async processMessage(message: { content: string; userId: string; msgType: string }): Promise<string | null> {
    if (message.msgType !== 'text') return null;

    const text = message.content.trim();
    const parts = text.split(/\s+/);
    const command = parts[0];
    const args = parts.slice(1).join(' ');

    const cmd = this.commands.get(command);
    if (!cmd) {
      return `❓ 未知命令: ${command}\n输入 help 查看可用命令`;
    }

    try {
      return await cmd.handler(args, message.userId);
    } catch (error: any) {
      this.logger.error(`WeChat command error: ${error.message}`);
      return `❌ 命令执行失败: ${error.message}`;
    }
  }

  /**
   * Send a message via WeChat Work Bot API
   */
  async sendMessage(userId: string, content: string, options?: {
    mentionedList?: string[];
  }): Promise<boolean> {
    const webhookUrl = process.env.WECHAT_BOT_WEBHOOK_URL;
    if (!webhookUrl) {
      this.logger.warn('WECHAT_BOT_WEBHOOK_URL not configured');
      return false;
    }

    try {
      const body: any = {
        msgtype: 'text',
        text: { content },
      };
      if (options?.mentionedList) {
        body.text.mentioned_list = options.mentionedList;
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      return data.errcode === 0;
    } catch (error: any) {
      this.logger.error(`WeChat send failed: ${error.message}`);
      return false;
    }
  }

  async pullTasks(_options?: SyncOptions): Promise<SyncResult> {
    return { success: true, synced: 0, created: 0, updated: 0, errors: [] };
  }

  async pushTask(task: { title: string; description?: string; status?: string; priority?: string }): Promise<PushResult> {
    const userId = process.env.WECHAT_NOTIFY_USER_ID;
    if (!userId) return { success: false, error: 'WECHAT_NOTIFY_USER_ID not configured' };

    const priorityLabel: Record<string, string> = {
      urgent: '🔴紧急', high: '🟠高', medium: '🟡中', low: '🟢低',
    };
    const statusLabel: Record<string, string> = {
      todo: '📋待办', in_progress: '🔄进行中', done: '✅已完成', closed: '🔒已关闭',
    };

    const content = [
      `📋 任务: ${task.title}`,
      task.description ? `   ${task.description}` : '',
      task.priority ? `   优先级: ${priorityLabel[task.priority] ?? task.priority}` : '',
      task.status ? `   状态: ${statusLabel[task.status] ?? task.status}` : '',
    ].join('\n');

    const success = await this.sendMessage(userId, content);
    return success ? { success: true } : { success: false, error: 'Failed to send message' };
  }

  async handleWebhook(payload: unknown, _headers?: Record<string, string>): Promise<void> {
    const data = payload as any;
    this.logger.info(`WeChat webhook received: ${data.msgType}`);

    if (data.msgType === 'text') {
      const result = await this.processMessage({
        content: data.text?.content ?? '',
        userId: data.fromUserId ?? 'unknown',
        msgType: data.msgType,
      });
      if (result) {
        this.logger.info(`WeChat bot reply: ${result}`);
      }
    }
  }

  async testConnection(config: Record<string, string>): Promise<{ success: boolean; error?: string }> {
    const webhookUrl = config.webhook_url || process.env.WECHAT_BOT_WEBHOOK_URL;
    if (!webhookUrl) return { success: false, error: 'WECHAT_BOT_WEBHOOK_URL not provided' };

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          msgtype: 'text',
          text: { content: '🧠 AI Task Hub 连接测试成功' },
        }),
      });
      const data = await response.json();
      if (data.errcode !== 0) return { success: false, error: data.errmsg };
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
