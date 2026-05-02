import type { McpToolConfig } from '@/lib/core/types';

export const deploymentMcpTools: McpToolConfig[] = [
  // ---- Environment Management ----
  {
    name: 'create_environment',
    description: '创建部署环境（开发/测试/生产等），配置基础 URL 和环境变量',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '环境标识 (如 dev, staging, prod)' },
        displayName: { type: 'string', description: '显示名称 (如 "开发环境")' },
        description: { type: 'string', description: '环境描述' },
        baseUrl: { type: 'string', description: '环境基础 URL' },
        config: { type: 'object', description: '环境配置 (环境变量等)' },
        order: { type: 'number', description: '排序顺序' },
      },
      required: ['name', 'displayName', 'baseUrl', 'config', 'order'],
    },
  },
  {
    name: 'list_environments',
    description: '列出所有部署环境，按排序顺序返回',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_environment',
    description: '获取指定部署环境的详细信息',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '环境 ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'update_environment',
    description: '更新部署环境配置（名称、URL、配置等）',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '环境 ID' },
        displayName: { type: 'string', description: '新的显示名称' },
        description: { type: 'string', description: '新的描述' },
        baseUrl: { type: 'string', description: '新的基础 URL' },
        config: { type: 'object', description: '新的环境配置' },
        isActive: { type: 'boolean', description: '是否启用' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_environment',
    description: '删除部署环境',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '环境 ID' },
      },
      required: ['id'],
    },
  },

  // ---- Deployment Pipeline ----
  {
    name: 'create_deployment',
    description: '创建新的部署，指定目标环境、版本和部署策略。会自动验证环境状态和冲突',
    inputSchema: {
      type: 'object',
      properties: {
        environmentId: { type: 'string', description: '目标环境 ID' },
        projectId: { type: 'string', description: '关联项目 ID（可选）' },
        version: { type: 'string', description: '部署版本号 (如 "2.7.0")' },
        strategy: {
          type: 'string',
          enum: ['rolling', 'blue_green', 'canary', 'recreate'],
          description: '部署策略',
        },
        description: { type: 'string', description: '部署描述' },
        triggeredBy: { type: 'string', description: '触发者 (agentId 或 userId)' },
        config: { type: 'object', description: '部署配置覆盖' },
      },
      required: ['environmentId', 'version', 'strategy'],
    },
  },
  {
    name: 'update_deployment_status',
    description: '更新部署状态（构建中→部署中→验证中→运行中/失败）',
    inputSchema: {
      type: 'object',
      properties: {
        deploymentId: { type: 'string', description: '部署 ID' },
        status: {
          type: 'string',
          enum: ['pending', 'queued', 'building', 'deploying', 'verifying', 'running', 'failed', 'rolled_back', 'cancelled'],
          description: '新状态',
        },
        message: { type: 'string', description: '状态变更消息' },
        metadata: { type: 'object', description: '附加元数据' },
      },
      required: ['deploymentId', 'status'],
    },
  },
  {
    name: 'get_deployment',
    description: '获取部署详情，包含所有日志',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '部署 ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_deployments',
    description: '列出部署记录，支持按环境、项目、状态筛选',
    inputSchema: {
      type: 'object',
      properties: {
        environmentId: { type: 'string', description: '按环境筛选' },
        projectId: { type: 'string', description: '按项目筛选' },
        status: { type: 'string', description: '按状态筛选' },
        limit: { type: 'number', description: '返回数量限制 (默认 20)' },
        offset: { type: 'number', description: '偏移量' },
      },
    },
  },
  {
    name: 'get_deployment_summary',
    description: '获取部署概览统计（总数、按状态分布、按环境分布、最近部署）',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'validate_deployment',
    description: '验证部署前置条件（环境状态、冲突检测、版本格式等）',
    inputSchema: {
      type: 'object',
      properties: {
        environmentId: { type: 'string', description: '目标环境 ID' },
        version: { type: 'string', description: '部署版本号' },
        strategy: {
          type: 'string',
          enum: ['rolling', 'blue_green', 'canary', 'recreate'],
          description: '部署策略',
        },
      },
      required: ['environmentId', 'version', 'strategy'],
    },
  },

  // ---- Rollback ----
  {
    name: 'validate_rollback',
    description: '验证是否可以回滚指定部署，返回可回滚到的目标版本信息',
    inputSchema: {
      type: 'object',
      properties: {
        deploymentId: { type: 'string', description: '要回滚的部署 ID' },
      },
      required: ['deploymentId'],
    },
  },
  {
    name: 'rollback_deployment',
    description: '执行部署回滚，将环境恢复到上一个成功版本',
    inputSchema: {
      type: 'object',
      properties: {
        deploymentId: { type: 'string', description: '要回滚的部署 ID' },
        reason: { type: 'string', description: '回滚原因' },
        triggeredBy: { type: 'string', description: '触发者' },
      },
      required: ['deploymentId'],
    },
  },

  // ---- Health Checks ----
  {
    name: 'create_health_check',
    description: '为环境创建健康检查（HTTP/TCP/进程/自定义检查）',
    inputSchema: {
      type: 'object',
      properties: {
        environmentId: { type: 'string', description: '环境 ID' },
        name: { type: 'string', description: '检查名称 (如 "API Health")' },
        type: {
          type: 'string',
          enum: ['http', 'tcp', 'process', 'custom'],
          description: '检查类型',
        },
        config: { type: 'object', description: '检查配置 (url, timeout, interval 等)' },
        isActive: { type: 'boolean', description: '是否启用 (默认 true)' },
      },
      required: ['environmentId', 'name', 'type', 'config'],
    },
  },
  {
    name: 'list_health_checks',
    description: '列出健康检查，可按环境筛选',
    inputSchema: {
      type: 'object',
      properties: {
        environmentId: { type: 'string', description: '按环境筛选' },
      },
    },
  },
  {
    name: 'update_health_check_status',
    description: '更新健康检查状态（healthy/degraded/unhealthy），自动更新环境整体健康状态',
    inputSchema: {
      type: 'object',
      properties: {
        healthCheckId: { type: 'string', description: '健康检查 ID' },
        status: {
          type: 'string',
          enum: ['healthy', 'degraded', 'unhealthy', 'unknown'],
          description: '健康状态',
        },
        metadata: { type: 'object', description: '附加信息 (响应时间、错误详情等)' },
      },
      required: ['healthCheckId', 'status'],
    },
  },
  {
    name: 'delete_health_check',
    description: '删除健康检查',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '健康检查 ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_environment_health',
    description: '获取所有环境的健康状态概览，包含每个环境的检查状态和运行时间',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  // ---- Deployment Logs ----
  {
    name: 'add_deployment_log',
    description: '向部署添加日志条目',
    inputSchema: {
      type: 'object',
      properties: {
        deploymentId: { type: 'string', description: '部署 ID' },
        level: {
          type: 'string',
          enum: ['info', 'warn', 'error', 'debug'],
          description: '日志级别',
        },
        message: { type: 'string', description: '日志消息' },
        metadata: { type: 'object', description: '附加元数据' },
      },
      required: ['deploymentId', 'level', 'message'],
    },
  },
  {
    name: 'get_deployment_logs',
    description: '获取部署的所有日志，按时间排序',
    inputSchema: {
      type: 'object',
      properties: {
        deploymentId: { type: 'string', description: '部署 ID' },
      },
      required: ['deploymentId'],
    },
  },
];
