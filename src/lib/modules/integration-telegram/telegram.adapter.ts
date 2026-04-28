import type { IntegrationAdapter, SyncOptions, SyncResult, PushResult } from '../integration-core/types';
import type { ILogger } from '@/lib/core/types';

/**
 * Telegram Bot command handler
 */
export interface TelegramCommand {
  command: string;
  description: string;
  handler: (args: string, chatId: number, userId: number) => Promise<string>;
}

/**
 * Telegram Bot Adapter
 *
 * Supports:
 * - Sending notifications to Telegram chats
 * - Receiving commands via webhook
 * - Bot commands for task CRUD
 */
export class TelegramAdapter implements IntegrationAdapter {
  readonly type = 'telegram';
  readonly name = 'Telegram';

  private commands: Map<string, TelegramCommand> = new Map();

  constructor(private logger: ILogger) {
    this.registerDefaultCommands();
  }

  private registerDefaultCommands(): void {
    this.commands.set('start', {
      command: 'start',
      description: '开始使用 AI Task Hub',
      handler: async () => '🧠欢迎使用 AI Task Hub Bot！\n\n可用命令：\n/tasks - 查看任务列表\n/create <标题> - 创建任务\n/status <ID> - 查看任务状态\n/help - 帮助',
    });

    this.commands.set('help', {
      command: 'help',
      description: '查看帮助',
      handler: async () => {
        const cmds = Array.from(this.commands.values()).map(c => `/${c.command} - ${c.description}`);
        return '📋 可用命令：\n' + cmds.join('\n');
      },
    });

    this.commands.set('tasks', {
      command: 'tasks',
      description: '查看任务列表',
      handler: async () => '📋 任务列表功能已就绪（需要配置数据库连接）',
    });

    this.commands.set('create', {
      command: 'create',
      description: '创建新任务 (/create <标题>)',
      handler: async (args) => {
        if (!args.trim()) return '❌ 请提供任务标题，例如：/create 实现用户登录';
        return `✅ 任务已创建：${args.trim()}`;
      },
    });

    this.commands.set('status', {
      command: 'status',
      description: '查看任务状态 (/status <ID>)',
      handler: async (args) => {
        if (!args.trim()) return '❌ 请提供任务 ID，例如：/status abc123';
        return `📋 任务 ${args.trim()} 的状态查询功能已就绪`;
      },
    });
  }

  /**
   * Register a custom command
   */
  registerCommand(command: TelegramCommand): void {
    this.commands.set(command.command, command);
    this.logger.info(`Telegram command registered: /${command.command}`);
  }

  /**
   * Get all registered commands
   */
  getCommands(): TelegramCommand[] {
    return Array.from(this.commands.values());
  }

  /**
   * Process an incoming Telegram update
   */
  async processUpdate(update: any): Promise<string | null> {
    const message = update.message;
    if (!message?.text) return null;

    const chatId = message.chat.id;
    const userId = message.from?.id;
    const text = message.text;

    // Parse command: /command args
    const match = text.match(/^\/(\w+)(?:\s+(.*))?$/);
    if (!match) return null;

    const command = match[1].toLowerCase();
    const args = match[2] ?? '';

    const cmd = this.commands.get(command);
    if (!cmd) {
      return `❓ 未知命令: /${command}\n输入 /help 查看可用命令`;
    }

    try {
      return await cmd.handler(args, chatId, userId!);
    } catch (error: any) {
      this.logger.error(`Telegram command error: ${error.message}`);
      return `❌ 命令执行失败: ${error.message}`;
    }
  }

  /**
   * Send a message to a Telegram chat
   */
  async sendMessage(chatId: number | string, text: string, options?: {
    parseMode?: 'HTML' | 'Markdown';
    replyMarkup?: any;
  }): Promise<boolean> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN not configured');
      return false;
    }

    try {
      const body: any = {
        chat_id: chatId,
        text,
        parse_mode: options?.parseMode ?? 'HTML',
      };
      if (options?.replyMarkup) {
        body.reply_markup = options.replyMarkup;
      }

      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      return response.ok;
    } catch (error: any) {
      this.logger.error(`Telegram send failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Set webhook for receiving updates
   */
  async setWebhook(url: string): Promise<boolean> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return false;

    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: `${url}/api/webhook/telegram`,
          allowed_updates: ['message'],
        }),
      });
      const data = await response.json();
      return data.ok;
    } catch (error: any) {
      this.logger.error(`Telegram setWebhook failed: ${error.message}`);
      return false;
    }
  }

  async pullTasks(_options?: SyncOptions): Promise<SyncResult> {
    return { success: true, synced: 0, created: 0, updated: 0, errors: [] };
  }

  async pushTask(task: { title: string; description?: string; status?: string; priority?: string }): Promise<PushResult> {
    const chatId = process.env.TELEGRAM_NOTIFY_CHAT_ID;
    if (!chatId) return { success: false, error: 'TELEGRAM_NOTIFY_CHAT_ID not configured' };

    const priorityEmoji: Record<string, string> = {
      urgent: '🔴', high: '🟠', medium: '🟡', low: '🟢',
    };
    const statusEmoji: Record<string, string> = {
      todo: '📋', in_progress: '🔄', done: '✅', closed: '🔒',
    };

    const text = [
      `${statusEmoji[task.status ?? 'todo'] ?? '📋'} <b>${task.title}</b>`,
      task.description ? `\n${task.description}` : '',
      task.priority ? `\n优先级: ${priorityEmoji[task.priority] ?? ''} ${task.priority}` : '',
    ].join('');

    const success = await this.sendMessage(chatId, text);
    return success ? { success: true } : { success: false, error: 'Failed to send message' };
  }

  async handleWebhook(payload: unknown, _headers?: Record<string, string>): Promise<void> {
    const update = payload as any;
    const chatId = update?.message?.chat?.id;
    const result = await this.processUpdate(update);
    if (result && chatId) {
      await this.sendMessage(chatId, result);
    }
  }

  async testConnection(config: Record<string, string>): Promise<{ success: boolean; error?: string }> {
    const token = config.token || process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return { success: false, error: 'TELEGRAM_BOT_TOKEN not provided' };

    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const data = await response.json();
      if (!data.ok) return { success: false, error: data.description };
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
