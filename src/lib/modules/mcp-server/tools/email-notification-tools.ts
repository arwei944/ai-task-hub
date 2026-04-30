import type { McpToolConfig } from '@/lib/core/types';

export const emailNotificationMcpTools: McpToolConfig[] = [
  {
    name: 'email_send_test',
    description: '发送一封测试邮件通知，用于验证 SMTP 配置是否正确',
    inputSchema: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: '收件人邮箱地址 (可选，默认使用 NOTIFY_EMAIL_TO)',
        },
        subject: {
          type: 'string',
          description: '自定义邮件主题 (可选)',
        },
      },
    },
  },
  {
    name: 'email_get_config',
    description: '获取当前邮件通知配置状态，包括哪些配置项已设置、哪些缺失',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];
