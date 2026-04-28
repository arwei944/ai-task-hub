import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Logger } from '@/lib/core/logger';
import { TelegramAdapter } from '@/lib/modules/integration-telegram/telegram.adapter';
import { WeChatAdapter } from '@/lib/modules/integration-wechat/wechat.adapter';
import { TelegramNotificationChannel } from '@/lib/modules/notifications/channels/telegram-channel';
import { WeChatNotificationChannel } from '@/lib/modules/notifications/channels/wechat-channel';

describe('TelegramAdapter', () => {
  let adapter: TelegramAdapter;
  const logger = new Logger('test');

  beforeEach(() => {
    adapter = new TelegramAdapter(logger);
  });

  it('should have correct type and name', () => {
    expect(adapter.type).toBe('telegram');
    expect(adapter.name).toBe('Telegram');
  });

  it('should register default commands', () => {
    const commands = adapter.getCommands();
    const commandNames = commands.map(c => c.command);
    expect(commandNames).toContain('start');
    expect(commandNames).toContain('help');
    expect(commandNames).toContain('tasks');
    expect(commandNames).toContain('create');
    expect(commandNames).toContain('status');
  });

  it('should register custom commands', () => {
    adapter.registerCommand({
      command: 'custom',
      description: 'Custom command',
      handler: async () => 'custom result',
    });
    const commands = adapter.getCommands();
    expect(commands.some(c => c.command === 'custom')).toBe(true);
  });

  it('should process /start command', async () => {
    const result = await adapter.processUpdate({
      message: { text: '/start', chat: { id: 123 }, from: { id: 456 } },
    });
    expect(result).toContain('AI Task Hub');
  });

  it('should process /help command', async () => {
    const result = await adapter.processUpdate({
      message: { text: '/help', chat: { id: 123 }, from: { id: 456 } },
    });
    expect(result).toContain('可用命令');
  });

  it('should process /create command with args', async () => {
    const result = await adapter.processUpdate({
      message: { text: '/create 实现用户登录', chat: { id: 123 }, from: { id: 456 } },
    });
    expect(result).toContain('实现用户登录');
  });

  it('should return error for /create without args', async () => {
    const result = await adapter.processUpdate({
      message: { text: '/create', chat: { id: 123 }, from: { id: 456 } },
    });
    expect(result).toContain('请提供任务标题');
  });

  it('should return unknown command for invalid commands', async () => {
    const result = await adapter.processUpdate({
      message: { text: '/unknown', chat: { id: 123 }, from: { id: 456 } },
    });
    expect(result).toContain('未知命令');
  });

  it('should return null for non-command messages', async () => {
    const result = await adapter.processUpdate({
      message: { text: 'just a message', chat: { id: 123 }, from: { id: 456 } },
    });
    expect(result).toBeNull();
  });

  it('should return null for messages without text', async () => {
    const result = await adapter.processUpdate({
      message: { photo: 'abc', chat: { id: 123 } },
    });
    expect(result).toBeNull();
  });

  it('should pullTasks return empty result', async () => {
    const result = await adapter.pullTasks();
    expect(result.success).toBe(true);
    expect(result.synced).toBe(0);
  });

  it('should testConnection fail without token', async () => {
    const originalToken = process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_BOT_TOKEN;
    const result = await adapter.testConnection({});
    expect(result.success).toBe(false);
    expect(result.error).toContain('TELEGRAM_BOT_TOKEN');
    if (originalToken) process.env.TELEGRAM_BOT_TOKEN = originalToken;
  });

  it('should pushTask fail without chat ID', async () => {
    const originalChatId = process.env.TELEGRAM_NOTIFY_CHAT_ID;
    delete process.env.TELEGRAM_NOTIFY_CHAT_ID;
    const result = await adapter.pushTask({ title: 'Test' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('TELEGRAM_NOTIFY_CHAT_ID');
    if (originalChatId) process.env.TELEGRAM_NOTIFY_CHAT_ID = originalChatId;
  });
});

describe('WeChatAdapter', () => {
  let adapter: WeChatAdapter;
  const logger = new Logger('test');

  beforeEach(() => {
    adapter = new WeChatAdapter(logger);
  });

  it('should have correct type and name', () => {
    expect(adapter.type).toBe('wechat');
    expect(adapter.name).toBe('企业微信');
  });

  it('should register default commands', () => {
    const commands = adapter.getCommands();
    const commandNames = commands.map(c => c.command);
    expect(commandNames).toContain('help');
    expect(commandNames).toContain('tasks');
    expect(commandNames).toContain('create');
    expect(commandNames).toContain('status');
  });

  it('should register custom commands', () => {
    adapter.registerCommand({
      command: 'custom',
      description: 'Custom command',
      handler: async () => 'custom result',
    });
    const commands = adapter.getCommands();
    expect(commands.some(c => c.command === 'custom')).toBe(true);
  });

  it('should process help command', async () => {
    const result = await adapter.processMessage({
      content: 'help',
      userId: 'user1',
      msgType: 'text',
    });
    expect(result).toContain('可用命令');
  });

  it('should process create command with args', async () => {
    const result = await adapter.processMessage({
      content: 'create 实现用户登录',
      userId: 'user1',
      msgType: 'text',
    });
    expect(result).toContain('实现用户登录');
  });

  it('should return null for non-text messages', async () => {
    const result = await adapter.processMessage({
      content: '',
      userId: 'user1',
      msgType: 'image',
    });
    expect(result).toBeNull();
  });

  it('should return unknown command for invalid commands', async () => {
    const result = await adapter.processMessage({
      content: 'unknown',
      userId: 'user1',
      msgType: 'text',
    });
    expect(result).toContain('未知命令');
  });

  it('should pullTasks return empty result', async () => {
    const result = await adapter.pullTasks();
    expect(result.success).toBe(true);
    expect(result.synced).toBe(0);
  });

  it('should testConnection fail without webhook URL', async () => {
    const originalUrl = process.env.WECHAT_BOT_WEBHOOK_URL;
    delete process.env.WECHAT_BOT_WEBHOOK_URL;
    const result = await adapter.testConnection({});
    expect(result.success).toBe(false);
    expect(result.error).toContain('WECHAT_BOT_WEBHOOK_URL');
    if (originalUrl) process.env.WECHAT_BOT_WEBHOOK_URL = originalUrl;
  });

  it('should pushTask fail without user ID', async () => {
    const originalUserId = process.env.WECHAT_NOTIFY_USER_ID;
    delete process.env.WECHAT_NOTIFY_USER_ID;
    const result = await adapter.pushTask({ title: 'Test' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('WECHAT_NOTIFY_USER_ID');
    if (originalUserId) process.env.WECHAT_NOTIFY_USER_ID = originalUserId;
  });
});

describe('TelegramNotificationChannel', () => {
  const logger = new Logger('test');
  const channel = new TelegramNotificationChannel(logger);

  it('should have correct id and name', () => {
    expect(channel.id).toBe('telegram');
    expect(channel.name).toBe('Telegram 通知');
  });

  it('should skip send when not configured', async () => {
    const originalToken = process.env.TELEGRAM_BOT_TOKEN;
    const originalChatId = process.env.TELEGRAM_NOTIFY_CHAT_ID;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_NOTIFY_CHAT_ID;

    // Should not throw
    await channel.send({
      type: 'test',
      title: 'Test',
      message: 'Test message',
      level: 'info',
      channel: 'telegram',
    });

    if (originalToken) process.env.TELEGRAM_BOT_TOKEN = originalToken;
    if (originalChatId) process.env.TELEGRAM_NOTIFY_CHAT_ID = originalChatId;
  });
});

describe('WeChatNotificationChannel', () => {
  const logger = new Logger('test');
  const channel = new WeChatNotificationChannel(logger);

  it('should have correct id and name', () => {
    expect(channel.id).toBe('wechat');
    expect(channel.name).toBe('企业微信通知');
  });

  it('should skip send when not configured', async () => {
    const originalUrl = process.env.WECHAT_BOT_WEBHOOK_URL;
    delete process.env.WECHAT_BOT_WEBHOOK_URL;

    // Should not throw
    await channel.send({
      type: 'test',
      title: 'Test',
      message: 'Test message',
      level: 'info',
      channel: 'wechat',
    });

    if (originalUrl) process.env.WECHAT_BOT_WEBHOOK_URL = originalUrl;
  });
});
