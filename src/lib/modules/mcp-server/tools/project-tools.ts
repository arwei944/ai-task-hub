// ============================================================
// Project Lifecycle MCP Tools
// ============================================================
// These tools enable AI agents (Trae, Cursor, etc.) to manage
// the full project lifecycle through MCP protocol.
//

import type { McpToolConfig } from '@/lib/core/types';

export interface ProjectMcpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export const projectMcpTools: ProjectMcpTool[] = [
  // ---- Project Management ----
  {
    name: 'create_project',
    description: '创建新项目。当用户提出一个新的开发需求时调用此工具。自动创建项目并初始化需求阶段。返回项目ID用于后续操作。',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '项目名称' },
        description: { type: 'string', description: '项目描述' },
        priority: { type: 'string', enum: ['urgent', 'high', 'medium', 'low'], description: '优先级' },
        techStack: { type: 'array', items: { type: 'string' }, description: '技术栈，如 ["Next.js", "Prisma"]' },
        repository: { type: 'string', description: '代码仓库 URL' },
        agentId: { type: 'string', description: '当前 Agent ID（自动传入）' },
        clientType: { type: 'string', enum: ['trae', 'cursor', 'windsurf', 'vscode', 'claude', 'chatgpt', 'mcp', 'api'], description: '客户端类型（自动传入）' },
      },
      required: ['name'],
    },
  },

  {
    name: 'update_project',
    description: '更新项目信息。可以更新名称、描述、阶段、状态、技术栈等。',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '项目 ID' },
        name: { type: 'string' },
        description: { type: 'string' },
        phase: { type: 'string', enum: ['requirements', 'planning', 'architecture', 'implementation', 'testing', 'deployment', 'completed'], description: '当前阶段' },
        status: { type: 'string', enum: ['active', 'completed', 'archived', 'paused'] },
        priority: { type: 'string', enum: ['urgent', 'high', 'medium', 'low'] },
        techStack: { type: 'array', items: { type: 'string' } },
        repository: { type: 'string' },
      },
      required: ['id'],
    },
  },

  {
    name: 'get_project',
    description: '获取项目详情，包含统计信息、阶段进度、任务概览。',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '项目 ID' },
      },
      required: ['id'],
    },
  },

  {
    name: 'list_projects',
    description: '列出所有项目，支持按状态、阶段、优先级筛选。',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['active', 'completed', 'archived', 'paused'] },
        phase: { type: 'string', enum: ['requirements', 'planning', 'architecture', 'implementation', 'testing', 'deployment', 'completed'] },
        priority: { type: 'string', enum: ['urgent', 'high', 'medium', 'low'] },
      },
    },
  },

  // ---- Task Management (project-scoped) ----
  {
    name: 'project_create_task',
    description: '在项目中创建任务。每个任务属于一个阶段（需求/规划/架构/实施/测试/部署）。AI 在执行过程中自动创建和更新任务。',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '所属项目 ID' },
        title: { type: 'string', description: '任务标题' },
        description: { type: 'string', description: '任务描述' },
        phase: { type: 'string', enum: ['requirements', 'planning', 'architecture', 'implementation', 'testing', 'deployment', 'review'], description: '所属阶段' },
        priority: { type: 'string', enum: ['urgent', 'high', 'medium', 'low'] },
        status: { type: 'string', enum: ['todo', 'in_progress', 'done', 'closed'] },
        parentTaskId: { type: 'string', description: '父任务 ID（用于子任务）' },
        dueDate: { type: 'string', description: '截止日期 ISO 格式' },
        tags: { type: 'array', items: { type: 'string' }, description: '标签' },
        agentId: { type: 'string', description: '创建者 Agent ID' },
        clientType: { type: 'string', enum: ['trae', 'cursor', 'windsurf', 'vscode', 'claude', 'chatgpt', 'mcp', 'api'], description: '客户端类型' },
      },
      required: ['title'],
    },
  },

  {
    name: 'project_update_task',
    description: '更新项目中的任务信息。AI 完成某一步后调用此工具更新任务状态和进度。',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '任务 ID' },
        title: { type: 'string' },
        description: { type: 'string' },
        status: { type: 'string', enum: ['todo', 'in_progress', 'done', 'closed'] },
        priority: { type: 'string', enum: ['urgent', 'high', 'medium', 'low'] },
        progress: { type: 'number', description: '进度 0-100' },
        phase: { type: 'string', enum: ['requirements', 'planning', 'architecture', 'implementation', 'testing', 'deployment', 'review'] },
        agentId: { type: 'string', description: '操作者 Agent ID' },
      },
      required: ['id'],
    },
  },

  {
    name: 'project_list_tasks',
    description: '列出项目中的任务，支持按项目、阶段、状态筛选。',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '按项目筛选' },
        phase: { type: 'string', enum: ['requirements', 'planning', 'architecture', 'implementation', 'testing', 'deployment', 'review'] },
        status: { type: 'array', items: { type: 'string' }, description: '按状态筛选' },
        priority: { type: 'array', items: { type: 'string' } },
        parentTaskId: { type: 'string', description: '获取子任务' },
        search: { type: 'string', description: '搜索关键词' },
      },
    },
  },

  // ---- Phase & Lifecycle ----
  {
    name: 'advance_phase',
    description: '推进项目阶段。当 AI 完成当前阶段所有任务后调用，自动更新项目阶段并记录活动。',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 ID' },
        phase: { type: 'string', enum: ['requirements', 'planning', 'architecture', 'implementation', 'testing', 'deployment', 'completed'], description: '新阶段' },
        summary: { type: 'string', description: '阶段变更说明' },
        agentId: { type: 'string', description: '操作者 Agent ID' },
      },
      required: ['projectId', 'phase'],
    },
  },

  // ---- Activity & Timeline ----
  {
    name: 'log_activity',
    description: '记录活动日志。AI 每执行一个重要操作时调用，用于在面板上展示实时活动时间线。',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 ID' },
        taskId: { type: 'string', description: '关联任务 ID' },
        agentId: { type: 'string', description: '操作者 Agent ID' },
        action: { type: 'string', enum: ['project_created', 'task_created', 'task_updated', 'task_completed', 'phase_changed', 'requirement_added', 'architecture_chosen', 'code_committed', 'test_passed', 'test_failed', 'deploy_started', 'deploy_completed', 'decision_made', 'file_created', 'file_modified', 'error_occurred', 'note_added'], description: '活动类型' },
        phase: { type: 'string', enum: ['requirements', 'planning', 'architecture', 'implementation', 'testing', 'deployment', 'review'] },
        title: { type: 'string', description: '活动标题（人类可读）' },
        details: { type: 'object', description: '详细信息 JSON' },
      },
      required: ['action', 'title'],
    },
  },

  {
    name: 'get_activity_log',
    description: '获取活动日志/时间线。查看项目或任务的所有操作记录。',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '按项目筛选' },
        taskId: { type: 'string', description: '按任务筛选' },
        agentId: { type: 'string', description: '按 Agent 筛选' },
        action: { type: 'string', description: '按活动类型筛选' },
        limit: { type: 'number', description: '返回条数，默认 50' },
      },
    },
  },

  // ---- Agent Registration ----
  {
    name: 'register_agent',
    description: '注册/识别当前 Agent。AI 首次连接时调用，记录 Agent 身份、客户端类型和版本。返回 agentId 用于后续所有操作。',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Agent 名称' },
        clientType: { type: 'string', enum: ['trae', 'cursor', 'windsurf', 'vscode', 'claude', 'chatgpt', 'mcp', 'api'], description: '客户端/IDE 类型' },
        clientVersion: { type: 'string', description: '客户端版本' },
        capabilities: { type: 'array', items: { type: 'string' }, description: 'Agent 能力列表' },
      },
      required: ['name', 'clientType'],
    },
  },

  {
    name: 'get_project_summary',
    description: '获取项目概览摘要。包含各阶段任务统计、Agent 活动统计、进度百分比。适合 AI 在对话中汇报项目状态。',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 ID' },
      },
      required: ['projectId'],
    },
  },
];
