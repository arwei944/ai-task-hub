// ============================================================
// MCP Tool Definitions for Test Management Module
// ============================================================

import type { McpToolConfig } from '@/lib/core/types';

export const testManagementMcpTools: McpToolConfig[] = [
  {
    name: 'create_test_case',
    description: '创建测试用例。支持设置标题、描述、类型、优先级、关联任务/需求等。',
    handler: 'create_test_case',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 ID（必填）' },
        title: { type: 'string', description: '测试用例标题（必填）' },
        description: { type: 'string', description: '测试用例描述' },
        type: { type: 'string', enum: ['functional', 'unit', 'integration', 'e2e', 'performance'], description: '测试类型' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], description: '优先级' },
        status: { type: 'string', enum: ['draft', 'ready', 'passed', 'failed', 'skipped', 'blocked'], description: '状态' },
        taskId: { type: 'string', description: '关联任务 ID' },
        requirementId: { type: 'string', description: '关联需求 ID' },
        expectedResult: { type: 'string', description: '预期结果' },
        createdBy: { type: 'string', description: '创建者标识' },
        aiGenerated: { type: 'boolean', description: '是否 AI 生成' },
      },
      required: ['projectId', 'title'],
    },
  },
  {
    name: 'get_test_case',
    description: '获取单个测试用例的详细信息，包含执行历史。',
    handler: 'get_test_case',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '测试用例 ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_test_cases',
    description: '列出测试用例，支持按状态、类型、优先级筛选，支持搜索和分页。',
    handler: 'list_test_cases',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '按项目 ID 筛选' },
        status: { type: 'array', items: { type: 'string' }, description: '按状态筛选' },
        type: { type: 'array', items: { type: 'string' }, description: '按类型筛选' },
        priority: { type: 'array', items: { type: 'string' }, description: '按优先级筛选' },
        taskId: { type: 'string', description: '按关联任务筛选' },
        search: { type: 'string', description: '搜索关键词' },
        page: { type: 'number', description: '页码（从 1 开始）' },
        pageSize: { type: 'number', description: '每页数量（最大 100）' },
      },
    },
  },
  {
    name: 'create_test_execution',
    description: '创建测试执行记录，记录测试用例的执行结果。',
    handler: 'create_test_execution',
    inputSchema: {
      type: 'object',
      properties: {
        testCaseId: { type: 'string', description: '测试用例 ID（必填）' },
        status: { type: 'string', enum: ['pending', 'running', 'passed', 'failed', 'skipped'], description: '执行状态' },
        duration: { type: 'number', description: '执行时长（毫秒）' },
        output: { type: 'string', description: '执行输出' },
        errorMessage: { type: 'string', description: '错误信息' },
        executedBy: { type: 'string', description: '执行者标识' },
        environment: { type: 'string', enum: ['local', 'staging', 'production'], description: '执行环境' },
      },
      required: ['testCaseId'],
    },
  },
  {
    name: 'create_test_suite',
    description: '创建测试套件，将多个测试用例组织在一起。',
    handler: 'create_test_suite',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 ID（必填）' },
        name: { type: 'string', description: '套件名称（必填）' },
        description: { type: 'string', description: '套件描述' },
        testCaseIds: { type: 'array', items: { type: 'string' }, description: '包含的测试用例 ID 列表' },
        createdBy: { type: 'string', description: '创建者标识' },
      },
      required: ['projectId', 'name'],
    },
  },
  {
    name: 'get_test_stats',
    description: '获取项目的测试统计数据，包含按状态、类型的分布和通过率。',
    handler: 'get_test_stats',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 ID（必填）' },
      },
      required: ['projectId'],
    },
  },
];
