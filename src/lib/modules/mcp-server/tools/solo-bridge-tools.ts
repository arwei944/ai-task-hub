import type { McpToolConfig } from '@/lib/core/types';

/**
 * SOLO Bridge MCP 工具定义
 * 提供通过 MCP 协议与 SOLO Bridge 交互的 7 个工具
 */
export const soloBridgeMcpTools: McpToolConfig[] = [
  {
    name: 'solo_health_check',
    description: '检查 SOLO Bridge 健康状态，包括各客户端连接状态、熔断器状态和活跃会话数',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'solo_call',
    description: '通过 SOLO Bridge 执行 AI 调用，支持指定通信模式（mcp/rest/pull）、子智能体类型和提示文本',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: '发送给 SOLO 的提示文本' },
        mode: { type: 'string', enum: ['mcp', 'rest', 'pull'], description: '通信模式 (默认使用配置的默认模式)' },
        subAgentType: { type: 'string', enum: ['explore', 'plan', 'general_purpose'], description: 'SOLO 子智能体类型' },
        sessionId: { type: 'string', description: '会话 ID (可选，自动生成)' },
        timeoutMs: { type: 'integer', description: '超时时间（毫秒）' },
        context: { type: 'object', description: '附加上下文信息' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'solo_get_records',
    description: '获取 SOLO 调用历史记录，支持按执行 ID、步骤 ID 过滤和数量限制',
    inputSchema: {
      type: 'object',
      properties: {
        executionId: { type: 'string', description: '按执行 ID 过滤' },
        stepId: { type: 'string', description: '按步骤 ID 过滤' },
        limit: { type: 'integer', description: '返回记录数量限制' },
      },
    },
  },
  {
    name: 'solo_get_sessions',
    description: '获取当前活跃的 SOLO 会话列表，包含会话 ID 和最后活跃时间',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'solo_get_stats',
    description: '获取 SOLO Bridge 统计信息，包括调用次数、成功率、平均耗时、Token 使用量等',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'solo_pull_tasks',
    description: '轮询 SOLO Bridge 中待处理的 Pull 模式任务（供 SOLO 主动拉取使用）',
    inputSchema: {
      type: 'object',
      properties: {
        maxTasks: { type: 'integer', description: '最多返回的任务数量 (默认 1)' },
      },
    },
  },
  {
    name: 'solo_complete_task',
    description: '完成一个 Pull 模式的任务，返回执行结果（供 SOLO 完成任务后回调使用）',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: '任务 ID' },
        data: { type: 'object', description: '执行结果数据' },
        error: { type: 'string', description: '错误信息（如果执行失败）' },
        durationMs: { type: 'integer', description: '执行耗时（毫秒）' },
        tokensUsed: { type: 'integer', description: '使用的 Token 数量' },
      },
      required: ['taskId'],
    },
  },
];
