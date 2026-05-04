# AI Agent 配置指南

AI Task Hub 通过 MCP (Model Context Protocol) 协议与 AI Agent 集成。本文档说明如何配置和使用。

## MCP 服务端

AI Task Hub 内置 MCP 服务端，提供 162+ 工具供 AI Agent 调用。

### 连接方式

| 方式 | 端点 | 协议 |
|------|------|------|
| Web MCP (Streamable HTTP) | `http://localhost:3000/api/mcp` | Streamable HTTP |
| 独立 MCP Server | `http://localhost:3001/mcp` | Stdio/SSE |

### SOLO Bridge

SOLO Bridge 是 AI Task Hub 与 SOLO Agent 之间的桥梁，支持三种调用模式：

| 模式 | 说明 | 适用场景 |
|------|------|----------|
| `mcp` | MCP 协议调用 | SOLO Agent 直接调用 Hub 工具 |
| `rest` | REST API 调用 | 非标准 MCP 客户端 |
| `pull` | 事件驱动 | Hub 主动推送事件给 Agent |

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `SOLO_MCP_ENDPOINT` | MCP Server 地址 | `http://localhost:3001/mcp` |
| `SOLO_REST_ENDPOINT` | REST API 地址 | `http://localhost:3001/api/solo/call` |
| `SOLO_DEFAULT_MODE` | 默认调用模式 | `mcp` |
| `SOLO_TIMEOUT_MS` | 调用超时 (ms) | `30000` |

## MCP 工具分类

### 项目管理 (project-handlers)
- `create_project` — 创建项目
- `get_project` — 获取项目详情
- `list_projects` — 列出项目
- `update_project` — 更新项目
- `delete_project` — 删除项目

### 任务管理 (task-handlers)
- `create_task` — 创建任务
- `update_task` — 更新任务
- `list_tasks` — 列出任务
- `update_task_status` — 更新任务状态
- `get_task_dependencies` — 获取任务依赖

### 工作流 (workflow-v3-handlers)
- `start_workflow_execution` — 启动工作流执行
- `get_execution_status` — 获取执行状态
- `cancel_execution` — 取消执行
- `list_workflow_templates` — 列出工作流模板

### 需求管理 (requirement-handlers)
- `create_requirement` — 创建需求
- `update_requirement` — 更新需求
- `list_requirements` — 列出需求
- `link_requirement_task` — 关联需求和任务

### 版本管理 (version-handlers)
- `create_release` — 创建版本
- `update_release` — 更新版本
- `list_releases` — 列出版本
- `create_changelog` — 创建变更日志

### 通知规则 (notification-rule-handlers)
- `create_notification_rule` — 创建通知规则
- `list_notification_rules` — 列出通知规则
- `delete_notification_rule` — 删除通知规则

### 部署管理 (deployment-handlers)
- `create_deployment` — 创建部署
- `list_deployments` — 列出部署
- `get_deployment_status` — 获取部署状态

## 配置示例

### Claude Desktop (claude_desktop_config.json)

```json
{
  "mcpServers": {
    "ai-task-hub": {
      "url": "http://localhost:3000/api/mcp",
      "transport": "streamable-http"
    }
  }
}
```

### Cursor / VS Code

在 MCP 设置中添加 Streamable HTTP 类型的服务器，地址为 `http://localhost:3000/api/mcp`。

## 安全说明

- MCP 服务端通过 JWT 认证保护
- 首次访问会自动创建管理员账户
- 生产环境请配置 `ADMIN_PASSWORD` 环境变量
