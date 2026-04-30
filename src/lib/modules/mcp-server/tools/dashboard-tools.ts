import type { McpToolConfig } from '@/lib/core/types';

export const dashboardMcpTools: McpToolConfig[] = [
  {
    name: 'get_project_health',
    description: '获取所有活跃项目的健康度评分（0-100），包含任务完成率、逾期数、近期活动、部署状态等综合指标',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_task_stats',
    description: '获取任务统计概览：总数、按状态/优先级/类型分组、完成率、逾期数、今日/本周创建和完成数',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_daily_trends',
    description: '获取每日任务趋势（创建数、完成数、累计总数），支持自定义天数',
    inputSchema: {
      type: 'object',
      properties: { days: { type: 'number', description: '天数 (7-90，默认 30)' } },
    },
  },
  {
    name: 'get_deployment_stats',
    description: '获取部署统计：总数、按状态/环境/策略分组、成功率、平均耗时、最近部署、环境健康状态',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_agent_efficiency',
    description: '获取 Agent 效率指标：总数、活跃数、操作统计、成功率、Top Agent 排行、按客户端类型分组',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_event_metrics',
    description: '获取事件总线指标：总事件数、按领域分组、Top 事件类型、最近事件、每小时事件吞吐量',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_ai_stats',
    description: '获取 AI 引擎统计：调用次数、成功率、Token 消耗、按处理器分组、最近调用记录',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_system_stats',
    description: '获取系统概览：模块数、注册 Agent 数、活跃集成数、运行时间',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_full_dashboard',
    description: '获取完整仪表盘数据（一次性返回所有统计指标），适合生成项目状态报告',
    inputSchema: { type: 'object', properties: {} },
  },
];
