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
  {
    name: 'ph_manage_docs',
    description: '管理项目文档。支持 Markdown 文档的创建、编辑、搜索和版本管理。',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 ID' },
        action: { type: 'string', enum: ['list', 'create', 'update', 'delete', 'search', 'get', 'versions', 'restore_version'], description: '操作类型' },
        docId: { type: 'string', description: '文档 ID' },
        title: { type: 'string', description: '文档标题' },
        content: { type: 'string', description: 'Markdown 内容' },
        docType: { type: 'string', enum: ['general', 'requirement', 'design', 'meeting_notes', 'api_doc', 'decision_log'] },
        parentDocId: { type: 'string', description: '父文档 ID' },
        tags: { type: 'array', items: { type: 'string' } },
        queryText: { type: 'string', description: '搜索关键词' },
        versionId: { type: 'string', description: '版本 ID（restore_version 时使用）' },
        changeLog: { type: 'string', description: '变更说明' },
      },
      required: ['projectId', 'action'],
    },
  },
  {
    name: 'ph_manage_templates',
    description: '管理项目模板。支持列出、获取、从模板创建项目、保存为模板等操作。',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'get', 'create_from_template', 'save_as_template', 'update', 'delete', 'rate', 'publish', 'built_in'], description: '操作类型' },
        templateId: { type: 'string', description: '模板 ID' },
        name: { type: 'string', description: '名称' },
        description: { type: 'string', description: '描述' },
        category: { type: 'string', description: '分类' },
        projectId: { type: 'string', description: '项目 ID（save_as_template 时使用）' },
        rating: { type: 'number', description: '评分 1-5' },
        icon: { type: 'string', description: '图标 emoji' },
      },
      required: ['action'],
    },
  },
  {
    name: 'ph_log_agent_work',
    description: '记录智能体工作日志。',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 ID' },
        projectAgentId: { type: 'string', description: 'ProjectAgent ID' },
        taskId: { type: 'string', description: '关联任务 ID' },
        date: { type: 'string', description: '日期 YYYY-MM-DD' },
        hours: { type: 'number', description: '工时数' },
        description: { type: 'string', description: '工作描述' },
        autoGenerated: { type: 'boolean', description: '是否自动记录' },
      },
      required: ['projectId', 'projectAgentId', 'date', 'hours'],
    },
  },
  {
    name: 'ph_get_agent_workload',
    description: '获取项目智能体工作量看板数据。',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 ID' },
      },
      required: ['projectId'],
    },
  },
];
