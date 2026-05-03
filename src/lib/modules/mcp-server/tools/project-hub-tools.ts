import type { McpToolConfig } from '@/lib/core/types';

export const projectHubMcpTools: McpToolConfig[] = [
  {
    name: 'ph_get_dashboard',
    description: '获取项目管理中心总览仪表盘数据，包含项目统计、健康度概览、即将到期里程碑、最近活动等。',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'ph_get_project_health',
    description: '获取所有项目的健康度矩阵，包含进度、时间线、工作量评分和风险等级。',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'ph_list_projects',
    description: '列出项目，支持按状态、阶段、优先级筛选和排序。',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: '项目状态筛选' },
        phase: { type: 'string', description: '项目阶段筛选' },
        priority: { type: 'string', description: '优先级筛选' },
        sortBy: { type: 'string', description: '排序字段' },
        sortOrder: { type: 'string', enum: ['asc', 'desc'], description: '排序方向' },
        page: { type: 'number', description: '页码' },
        pageSize: { type: 'number', description: '每页数量' },
        search: { type: 'string', description: '搜索关键词' },
      },
    },
  },
  {
    name: 'ph_manage_milestones',
    description: '管理项目里程碑。支持列出、创建、更新、删除和排序操作。',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 ID' },
        action: { type: 'string', enum: ['list', 'create', 'update', 'delete', 'reorder'], description: '操作类型' },
        milestoneId: { type: 'string', description: '里程碑 ID（update/delete 时必填）' },
        title: { type: 'string', description: '里程碑标题（create 时必填）' },
        description: { type: 'string', description: '里程碑描述' },
        dueDate: { type: 'string', description: '截止日期 ISO 格式' },
        status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'overdue'] },
        orders: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, sortOrder: { type: 'number' } } }, description: '排序数据（reorder 时使用）' },
      },
      required: ['projectId', 'action'],
    },
  },
  {
    name: 'ph_manage_agents',
    description: '管理项目智能体。支持列出、分配、更新角色和移除操作。',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 ID' },
        action: { type: 'string', enum: ['list', 'assign', 'update_role', 'remove', 'cross_project_view', 'available'], description: '操作类型' },
        agentId: { type: 'string', description: 'Agent ID（assign 时必填）' },
        role: { type: 'string', enum: ['lead', 'developer', 'reviewer', 'observer'], description: '角色' },
        id: { type: 'string', description: 'ProjectAgent ID（update_role/remove 时必填）' },
      },
      required: ['projectId', 'action'],
    },
  },
  {
    name: 'ph_get_cross_project_deps',
    description: '获取跨项目依赖关系图数据。',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'ph_create_project_dependency',
    description: '创建项目间依赖关系。自动检测循环依赖。',
    inputSchema: {
      type: 'object',
      properties: {
        sourceProjectId: { type: 'string', description: '依赖方项目 ID' },
        targetProjectId: { type: 'string', description: '被依赖方项目 ID' },
        dependencyType: { type: 'string', enum: ['finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish'], description: '依赖类型' },
        description: { type: 'string', description: '依赖描述' },
      },
      required: ['sourceProjectId', 'targetProjectId'],
    },
  },
];
