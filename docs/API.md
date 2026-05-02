# AI Task Hub API 文档

> 版本：v3.0.0 "Kernel Reborn" | 最后更新：2026-05-02

## 目录

- [概述](#概述)
- [认证机制](#认证机制)
- [一、tRPC API](#一-trpc-api)
  - [1.1 auth — 认证与用户管理](#11-auth--认证与用户管理)
  - [1.2 tasks — 任务管理](#12-tasks--任务管理)
  - [1.3 ai — AI 引擎](#13-ai--ai-引擎)
  - [1.4 agents — 智能体管理](#14-agents--智能体管理)
  - [1.5 integrations — 平台集成](#15-integrations--平台集成)
  - [1.6 notifications — 通知管理](#16-notifications--通知管理)
  - [1.7 workflows — 工作流引擎](#17-workflows--工作流引擎)
  - [1.8 updater — 模块热更新](#18-updater--模块热更新)
  - [1.9 stats — 数据统计](#19-stats--数据统计)
  - [1.10 plugins — 插件系统](#110-plugins--插件系统)
  - [1.11 workspaces — 工作空间](#111-workspaces--工作空间)
  - [1.12 feedback — 反馈系统](#112-feedback--反馈系统)
- [二、REST API](#二-rest-api)
  - [2.1 tRPC 传输端点](#21-trpc-传输端点)
  - [2.2 MCP Streamable HTTP](#22-mcp-streamable-http)
  - [2.3 Agent REST API](#23-agent-rest-api)
  - [2.4 健康检查](#24-健康检查)
  - [2.5 SSE 实时推送](#25-sse-实时推送)
  - [2.6 数据备份与恢复](#26-数据备份与恢复)
  - [2.7 任务导出](#27-任务导出)
  - [2.8 项目 API](#28-项目-api)
  - [2.9 Webhook 接收](#29-webhook-接收)
- [三、MCP 工具](#三-mcp-工具)
  - [3.1 Task Core（任务核心）](#31-task-core任务核心)
  - [3.2 AI Engine（AI 引擎）](#32-ai-engineai-引擎)
  - [3.3 Project Lifecycle（项目生命周期）](#33-project-lifecycle项目生命周期)
- [四、数据库模型](#四-数据库模型)
  - [4.1 User](#41-user)
  - [4.2 Task](#42-task)
  - [4.3 TaskDependency](#43-taskdependency)
  - [4.4 TaskHistory](#44-taskhistory)
  - [4.5 Tag](#45-tag)
  - [4.6 TaskTag](#46-tasktag)
  - [4.7 AIAuditLog](#47-aiauditlog)
  - [4.8 Agent](#48-agent)
  - [4.9 AgentOperation](#49-agentoperation)
  - [4.10 Integration](#410-integration)
  - [4.11 Webhook](#411-webhook)
  - [4.12 Notification](#412-notification)
  - [4.13 AppVersion](#413-appversion)
  - [4.14 ModuleVersion](#414-moduleversion)
  - [4.15 Plugin](#415-plugin)
  - [4.16 Workspace](#416-workspace)
  - [4.17 WorkspaceMember](#417-workspacemember)
  - [4.18 Project](#418-project)
  - [4.19 ActivityLog](#419-activitylog)
  - [4.20 Workflow](#420-workflow)
  - [4.21 WorkflowExecution](#421-workflowexecution)
  - [4.22 WorkflowStepExecution](#422-workflowstepexecution)
  - [4.23 WorkflowTriggerLog](#423-workflowtriggerlog)
  - [4.24 FeedbackCheckpoint](#424-feedbackcheckpoint)
  - [4.25 FeedbackRule](#425-feedbackrule)
  - [4.26 StepFeedback](#426-stepfeedback)

---

## 概述

AI Task Hub 提供三种 API 接入方式：

| 接口类型 | 协议 | 适用场景 |
|---------|------|---------|
| **tRPC API** | HTTP (JSON) | 前端应用、TypeScript 客户端 |
| **REST API** | HTTP (JSON) | 第三方集成、通用 HTTP 客户端 |
| **MCP 工具** | Streamable HTTP / Stdio | AI 智能体（Trae/Cursor/Windsurf/VS Code） |

---

## 认证机制

系统提供三种 procedure 级别的认证控制：

| Procedure 类型 | 认证要求 | 说明 |
|---------------|---------|------|
| `publicProcedure` | 无需认证 | 公开接口，如注册、登录、Agent 认证 |
| `protectedProcedure` | 需要 JWT Token | 已登录用户或已认证 Agent 可访问 |
| `adminProcedure` | 需要 JWT Token + admin 角色 | 仅管理员可访问 |

### JWT 认证

- **Header 格式**：`Authorization: Bearer <token>`
- **Cookie 格式**：自动读取 `token` cookie
- **Token 有效期**：服务端配置（默认 7 天）
- **Agent 认证**：通过 `X-API-Key` header 传递 apiKey

### 单管理员免登录模式

默认配置下，系统运行在单管理员免登录模式：

- 首次访问自动创建管理员账号（`admin/admin`）
- tRPC context 层自动认证，所有 `protectedProcedure` / `adminProcedure` 直接通过
- REST API（backup/sse/export/webhook）移除认证检查

---

## 一、tRPC API

所有 tRPC 请求通过 `/api/trpc/[router].[procedure]` 发送。

**请求格式**：

```json
{
  "json": {
    "param1": "value1"
  }
}
```

**响应格式**：

```json
{
  "result": {
    "data": { ... }
  }
}
```

---

### 1.1 auth — 认证与用户管理

| Procedure | 方法 | 认证 | 说明 |
|-----------|------|------|------|
| `auth.register` | Mutation | 公开 | 用户注册 |
| `auth.login` | Mutation | 公开 | 用户登录，返回 JWT Token |
| `auth.me` | Query | 需认证 | 获取当前用户信息 |
| `auth.changePassword` | Mutation | 需认证 | 修改密码 |
| `auth.listUsers` | Query | 管理员 | 列出所有用户 |
| `auth.updateRole` | Mutation | 管理员 | 更新用户角色 |
| `auth.toggleUser` | Mutation | 管理员 | 启用/禁用用户 |

#### auth.register

```typescript
// 输入
{
  username: string;    // 用户名，唯一
  email: string;       // 邮箱，唯一
  password: string;    // 密码，至少 6 位
  displayName?: string; // 显示名称
}

// 输出
{
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  role: string;
  token: string;       // JWT Token
}
```

#### auth.login

```typescript
// 输入
{
  username: string;    // 用户名或邮箱
  password: string;    // 密码
}

// 输出
{
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  role: string;
  token: string;       // JWT Token
}
```

#### auth.me

```typescript
// 输出
{
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  role: "admin" | "user" | "agent";
  avatar: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}
```

#### auth.changePassword

```typescript
// 输入
{
  currentPassword: string;  // 当前密码
  newPassword: string;      // 新密码
}
```

#### auth.listUsers

```typescript
// 输入（可选）
{
  page?: number;     // 页码，默认 1
  limit?: number;    // 每页数量，默认 20
  search?: string;   // 搜索关键词
  role?: string;     // 按角色筛选
}

// 输出
{
  users: User[];
  total: number;
  page: number;
  limit: number;
}
```

#### auth.updateRole

```typescript
// 输入
{
  userId: string;    // 用户 ID
  role: "admin" | "user" | "agent";  // 新角色
}
```

#### auth.toggleUser

```typescript
// 输入
{
  userId: string;    // 用户 ID
}
```

---

### 1.2 tasks — 任务管理

| Procedure | 方法 | 认证 | 说明 |
|-----------|------|------|------|
| `tasks.list` | Query | 需认证 | 获取任务列表（支持筛选/分页） |
| `tasks.get` | Query | 需认证 | 获取单个任务详情 |
| `tasks.create` | Mutation | 需认证 | 创建任务 |
| `tasks.update` | Mutation | 需认证 | 更新任务 |
| `tasks.updateStatus` | Mutation | 需认证 | 更新任务状态 |
| `tasks.delete` | Mutation | 需认证 | 删除任务 |
| `tasks.history` | Query | 需认证 | 获取任务变更历史 |
| `tasks.subTasks` | Query | 需认证 | 获取子任务列表 |
| `tasks.statusCounts` | Query | 需认证 | 获取各状态任务数量 |

#### tasks.list

```typescript
// 输入（可选）
{
  page?: number;          // 页码，默认 1
  limit?: number;         // 每页数量，默认 20
  status?: string;        // 按状态筛选：todo | in_progress | done | closed | deleted
  priority?: string;      // 按优先级筛选：urgent | high | medium | low
  type?: string;          // 按类型筛选
  phase?: string;         // 按阶段筛选
  source?: string;        // 按来源筛选：trae | cursor | windsurf | manual | ai | import | mcp
  assignee?: string;      // 按负责人筛选
  projectId?: string;     // 按项目筛选
  parentTaskId?: string;  // 获取子任务
  search?: string;        // 搜索关键词
  sortBy?: string;        // 排序字段
  sortOrder?: "asc" | "desc";  // 排序方向
}

// 输出
{
  tasks: Task[];
  total: number;
  page: number;
  limit: number;
}
```

#### tasks.get

```typescript
// 输入
{ id: string; }

// 输出
Task & {
  dependencies: TaskDependency[];
  dependents: TaskDependency[];
  tags: TaskTag[];
  subTasks: Task[];
  project?: Project;
}
```

#### tasks.create

```typescript
// 输入
{
  title: string;           // 任务标题
  description?: string;    // 任务描述
  status?: string;         // 初始状态，默认 "todo"
  priority?: string;       // 优先级，默认 "medium"
  type?: string;           // 类型，默认 "general"
  phase?: string;          // 阶段，默认 "implementation"
  source?: string;         // 来源，默认 "manual"
  sourceRef?: string;      // 来源引用
  assignee?: string;       // 负责人
  parentTaskId?: string;   // 父任务 ID
  projectId?: string;      // 所属项目 ID
  dueDate?: string;        // 截止日期（ISO 8601）
  metadata?: object;       // 元数据（JSON）
  tags?: string[];         // 标签名称列表
  dependencies?: string[]; // 依赖任务 ID 列表
}
```

#### tasks.update

```typescript
// 输入
{
  id: string;
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  progress?: number;       // 0-100
  type?: string;
  phase?: string;
  assignee?: string;
  dueDate?: string;
  metadata?: object;
  tags?: string[];
}
```

#### tasks.updateStatus

```typescript
// 输入
{
  id: string;
  status: "todo" | "in_progress" | "done" | "closed" | "deleted";
}

// 输出
Task  // 更新后的任务
```

#### tasks.delete

```typescript
// 输入
{ id: string; }

// 输出
{ success: boolean; }
```

#### tasks.history

```typescript
// 输入
{
  taskId: string;
  limit?: number;  // 默认 50
}

// 输出
TaskHistory[]  // 变更历史记录
```

#### tasks.subTasks

```typescript
// 输入
{ parentTaskId: string; }

// 输出
Task[]  // 子任务列表
```

#### tasks.statusCounts

```typescript
// 输出
{
  todo: number;
  in_progress: number;
  done: number;
  closed: number;
  deleted: number;
}
```

---

### 1.3 ai — AI 引擎

| Procedure | 方法 | 认证 | 说明 |
|-----------|------|------|------|
| `ai.extractTasks` | Mutation | 需认证 | 从文本中提取任务 |
| `ai.decomposeTask` | Mutation | 需认证 | 将任务拆解为子任务 |
| `ai.inferStatus` | Mutation | 需认证 | AI 推断任务状态 |
| `ai.generateReport` | Mutation | 需认证 | 生成分析报告 |
| `ai.nlQuery` | Mutation | 需认证 | 自然语言查询任务 |
| `ai.scheduleAdvice` | Mutation | 需认证 | AI 调度建议 |
| `ai.autoDecompose` | Mutation | 需认证 | 自动拆解任务（含创建） |

#### ai.extractTasks

```typescript
// 输入
{
  text: string;           // 待提取的文本内容
  projectId?: string;     // 关联项目 ID
  source?: string;        // 来源标识
}

// 输出
{
  tasks: {
    title: string;
    description?: string;
    priority: string;
    phase: string;
  }[];
  model: string;          // 使用的 AI 模型
  tokensUsed: number;     // Token 消耗
  duration: number;       // 耗时（ms）
}
```

#### ai.decomposeTask

```typescript
// 输入
{
  taskId: string;         // 要拆解的任务 ID
  maxDepth?: number;      // 最大拆解深度，默认 2
  strategy?: string;      // 拆解策略
}

// 输出
{
  subTasks: Task[];       // 创建的子任务
  model: string;
  tokensUsed: number;
  duration: number;
}
```

#### ai.inferStatus

```typescript
// 输入
{
  taskId: string;         // 目标任务 ID
}

// 输出
{
  taskId: string;
  inferredStatus: string; // 推断的状态
  confidence: number;     // 置信度 0-1
  reasoning: string;      // 推理过程
}
```

#### ai.generateReport

```typescript
// 输入
{
  type: "project" | "team" | "task";  // 报告类型
  scope?: string;         // 范围（项目 ID 或团队 ID）
  period?: string;        // 时间范围
}

// 输出
{
  report: string;         // Markdown 格式报告
  model: string;
  tokensUsed: number;
  duration: number;
}
```

#### ai.nlQuery

```typescript
// 输入
{
  query: string;          // 自然语言查询
  limit?: number;         // 结果数量限制
}

// 输出
{
  tasks: Task[];          // 匹配的任务
  interpretation: string; // 查询意图解析
}
```

#### ai.scheduleAdvice

```typescript
// 输入
{
  taskIds?: string[];     // 指定任务 ID
  projectId?: string;     // 指定项目
}

// 输出
{
  suggestions: {
    taskId: string;
    suggestion: string;
    reason: string;
    priority: string;
  }[];
}
```

#### ai.autoDecompose

```typescript
// 输入
{
  taskId: string;         // 要拆解的任务 ID
  maxSubTasks?: number;   // 最大子任务数，默认 5
}

// 输出
{
  subTasks: Task[];       // 自动创建的子任务
  model: string;
  tokensUsed: number;
  duration: number;
}
```

---

### 1.4 agents — 智能体管理

| Procedure | 方法 | 认证 | 说明 |
|-----------|------|------|------|
| `agents.register` | Mutation | 公开 | 注册新智能体 |
| `agents.authenticate` | Mutation | 公开 | 智能体认证 |
| `agents.list` | Query | 需认证 | 列出所有智能体 |
| `agents.get` | Query | 需认证 | 获取智能体详情 |
| `agents.update` | Mutation | 需认证 | 更新智能体信息 |
| `agents.deactivate` | Mutation | 管理员 | 停用智能体 |
| `agents.delete` | Mutation | 管理员 | 删除智能体 |
| `agents.operations` | Query | 需认证 | 获取智能体操作日志 |
| `agents.recentOperations` | Query | 需认证 | 获取最近操作 |
| `agents.stats` | Query | 需认证 | 获取智能体统计 |
| `agents.checkPermission` | Mutation | 公开 | 检查智能体权限 |

#### agents.register

```typescript
// 输入
{
  name: string;           // 智能体名称
  description?: string;   // 描述
  clientType: string;     // 客户端类型：trae | cursor | windsurf | vscode | claude | chatgpt | mcp | api
  clientVersion?: string; // 客户端版本
  capabilities?: string[];// 能力列表
}

// 输出
{
  id: string;
  name: string;
  apiKey: string;         // API Key（仅注册时返回一次）
  clientType: string;
  permissionLevel: string;
}
```

#### agents.authenticate

```typescript
// 输入
{
  apiKey: string;         // API Key
}

// 输出
{
  id: string;
  name: string;
  clientType: string;
  permissionLevel: string;
  isActive: boolean;
}
```

#### agents.list

```typescript
// 输入（可选）
{
  clientType?: string;    // 按客户端类型筛选
  isActive?: boolean;     // 按状态筛选
  page?: number;
  limit?: number;
}

// 输出
{
  agents: Agent[];
  total: number;
}
```

#### agents.get

```typescript
// 输入
{ id: string; }

// 输出
Agent & {
  operationCount: number;
  lastOperationAt: string | null;
}
```

#### agents.update

```typescript
// 输入
{
  id: string;
  name?: string;
  description?: string;
  capabilities?: string[];
  permissionLevel?: "user" | "agent";
}
```

#### agents.deactivate

```typescript
// 输入
{ id: string; }

// 输出
{ success: boolean; }
```

#### agents.delete

```typescript
// 输入
{ id: string; }

// 输出
{ success: boolean; }
```

#### agents.operations

```typescript
// 输入
{
  agentId: string;
  action?: string;        // 按操作类型筛选
  limit?: number;
  offset?: number;
}

// 输出
AgentOperation[]
```

#### agents.recentOperations

```typescript
// 输入
{
  agentId: string;
  limit?: number;         // 默认 10
}

// 输出
AgentOperation[]
```

#### agents.stats

```typescript
// 输入
{ agentId: string; }

// 输出
{
  totalOperations: number;
  successRate: number;
  topActions: { action: string; count: number }[];
  lastActiveAt: string | null;
}
```

#### agents.checkPermission

```typescript
// 输入
{
  apiKey: string;
  action: string;         // 要检查的操作
  resource?: string;      // 目标资源
}

// 输出
{
  allowed: boolean;
  reason?: string;
  permissionLevel: string;
}
```

---

### 1.5 integrations — 平台集成

| Procedure | 方法 | 认证 | 说明 |
|-----------|------|------|------|
| `integrations.adapterTypes` | Query | 需认证 | 获取支持的集成类型 |
| `integrations.create` | Mutation | 管理员 | 创建集成 |
| `integrations.list` | Query | 需认证 | 列出所有集成 |
| `integrations.get` | Query | 需认证 | 获取集成详情 |
| `integrations.update` | Mutation | 管理员 | 更新集成配置 |
| `integrations.delete` | Mutation | 管理员 | 删除集成 |
| `integrations.testConnection` | Mutation | 管理员 | 测试连接 |
| `integrations.sync` | Mutation | 管理员 | 触发同步 |

#### integrations.adapterTypes

```typescript
// 输出
{
  types: {
    key: string;          // github | feishu | notion | webhook
    name: string;
    description: string;
    configFields: { key: string; label: string; type: string; required: boolean }[];
  }[];
}
```

#### integrations.create

```typescript
// 输入
{
  type: string;           // 集成类型
  name: string;           // 集成名称
  description?: string;
  config: object;         // 平台特定配置（JSON）
}

// 输出
Integration
```

#### integrations.list

```typescript
// 输入（可选）
{
  type?: string;          // 按类型筛选
  isActive?: boolean;
}

// 输出
Integration[]
```

#### integrations.get

```typescript
// 输入
{ id: string; }

// 输出
Integration & { webhooks: Webhook[] }
```

#### integrations.update

```typescript
// 输入
{
  id: string;
  name?: string;
  description?: string;
  config?: object;
  isActive?: boolean;
}
```

#### integrations.delete

```typescript
// 输入
{ id: string; }

// 输出
{ success: boolean; }
```

#### integrations.testConnection

```typescript
// 输入
{ id: string; }

// 输出
{
  success: boolean;
  message: string;
  latency?: number;       // 响应时间（ms）
}
```

#### integrations.sync

```typescript
// 输入
{
  id: string;
  fullSync?: boolean;     // 是否全量同步
}

// 输出
{
  success: boolean;
  syncedCount: number;
  errors?: string[];
}
```

---

### 1.6 notifications — 通知管理

| Procedure | 方法 | 认证 | 说明 |
|-----------|------|------|------|
| `notifications.list` | Query | 需认证 | 获取通知列表 |
| `notifications.unreadCount` | Query | 需认证 | 获取未读通知数 |
| `notifications.markAsRead` | Mutation | 需认证 | 标记通知已读 |
| `notifications.markAllAsRead` | Mutation | 需认证 | 全部标记已读 |
| `notifications.delete` | Mutation | 需认证 | 删除通知 |
| `notifications.pushSubscribe` | Mutation | 需认证 | 订阅 Web Push |
| `notifications.pushUnsubscribe` | Mutation | 需认证 | 取消 Web Push |
| `notifications.pushTest` | Mutation | 需认证 | 发送测试通知 |

#### notifications.list

```typescript
// 输入（可选）
{
  page?: number;
  limit?: number;
  type?: string;          // 按类型筛选
  isRead?: boolean;       // 按已读状态筛选
  level?: string;         // info | warning | error | success
}

// 输出
{
  notifications: Notification[];
  total: number;
  unreadCount: number;
}
```

#### notifications.unreadCount

```typescript
// 输出
{ count: number; }
```

#### notifications.markAsRead

```typescript
// 输入
{ id: string; }
```

#### notifications.markAllAsRead

```typescript
// 无输入
```

#### notifications.delete

```typescript
// 输入
{ id: string; }
```

#### notifications.pushSubscribe

```typescript
// 输入
{
  subscription: object;   // PushSubscription JSON
}
```

#### notifications.pushUnsubscribe

```typescript
// 输入
{
  endpoint: string;       // 订阅端点 URL
}
```

#### notifications.pushTest

```typescript
// 无输入

// 输出
{ success: boolean; message: string; }
```

---

### 1.7 workflows — 工作流引擎

| Procedure | 方法 | 认证 | 说明 |
|-----------|------|------|------|
| `workflows.create` | Mutation | 需认证 | 创建工作流 |
| `workflows.update` | Mutation | 需认证 | 更新工作流 |
| `workflows.delete` | Mutation | 需认证 | 删除工作流 |
| `workflows.get` | Query | 需认证 | 获取工作流详情 |
| `workflows.list` | Query | 需认证 | 列出工作流 |
| `workflows.run` | Mutation | 需认证 | 执行工作流 |
| `workflows.cancel` | Mutation | 需认证 | 取消执行 |
| `workflows.getExecution` | Query | 需认证 | 获取执行详情 |
| `workflows.listExecutions` | Query | 需认证 | 列出执行历史 |
| `workflows.trigger` | Mutation | 需认证 | 手动触发工作流 |
| `workflows.getObservabilityStats` | Query | 需认证 | 获取可观测性统计 |
| `workflows.getRecentExecutions` | Query | 需认证 | 获取最近执行 |
| `workflows.getStepPerformance` | Query | 需认证 | 获取步骤性能 |
| `workflows.getSOLOCallHistory` | Query | 需认证 | 获取 SOLO 调用历史 |

#### workflows.create

```typescript
// 输入
{
  name: string;
  description?: string;
  trigger: string;              // manual | webhook | schedule | event | github-issue | approval
  triggerConfig?: object;       // 触发器配置（JSON）
  steps: object[];              // 步骤定义数组
  variables?: object;           // 全局变量（JSON）
  retryPolicy?: {               // 重试策略
    max: number;                // 最大重试次数
    backoff: "exponential" | "linear" | "fixed";
    delayMs: number;            // 延迟（ms）
  };
  concurrencyLimit?: number;    // 并发限制，默认 5
  timeoutMs?: number;           // 超时时间，默认 300000
  soloConfig?: object;          // SOLO 调用配置（JSON）
}

// 支持的步骤类型
// create-task, update-status, ai-analyze, send-notification,
// wait, parallel-group, condition, foreach, invoke-agent,
// http-request, transform, approval
```

#### workflows.update

```typescript
// 输入
{
  id: string;
  name?: string;
  description?: string;
  trigger?: string;
  triggerConfig?: object;
  steps?: object[];
  variables?: object;
  retryPolicy?: object;
  concurrencyLimit?: number;
  timeoutMs?: number;
  soloConfig?: object;
  isActive?: boolean;
}
```

#### workflows.delete

```typescript
// 输入
{ id: string; }
```

#### workflows.get

```typescript
// 输入
{ id: string; }

// 输出
Workflow & {
  executionCount: number;
  lastExecutionAt: string | null;
}
```

#### workflows.list

```typescript
// 输入（可选）
{
  isActive?: boolean;
  page?: number;
  limit?: number;
}

// 输出
{
  workflows: Workflow[];
  total: number;
}
```

#### workflows.run

```typescript
// 输入
{
  workflowId: string;
  variables?: object;     // 运行时变量覆盖
  triggerType?: string;   // 触发类型
}

// 输出
{
  executionId: string;
  status: string;
}
```

#### workflows.cancel

```typescript
// 输入
{ executionId: string; }

// 输出
{ success: boolean; }
```

#### workflows.getExecution

```typescript
// 输入
{ executionId: string; }

// 输出
WorkflowExecution & {
  stepExecutions: WorkflowStepExecution[];
  feedbackCheckpoints: FeedbackCheckpoint[];
}
```

#### workflows.listExecutions

```typescript
// 输入
{
  workflowId: string;
  status?: string;
  limit?: number;
  offset?: number;
}

// 输出
{
  executions: WorkflowExecution[];
  total: number;
}
```

#### workflows.trigger

```typescript
// 输入
{
  workflowId: string;
  payload?: object;       // 触发器载荷
}

// 输出
{
  executionId: string;
  triggerLogId: string;
}
```

#### workflows.getObservabilityStats

```typescript
// 输入（可选）
{ workflowId?: string; }

// 输出
{
  totalExecutions: number;
  successRate: number;
  avgDuration: number;
  stepMetrics: {
    stepType: string;
    avgDuration: number;
    successRate: number;
    totalRuns: number;
  }[];
  soloCallHistory: object[];
}
```

#### workflows.getRecentExecutions

```typescript
// 输入（可选）
{ limit?: number; }  // 默认 20

// 输出
WorkflowExecution[]
```

#### workflows.getStepPerformance

```typescript
// 输入（可选）
{ workflowId?: string; }

// 输出
{
  steps: {
    stepType: string;
    stepName: string;
    avgDurationMs: number;
    successRate: number;
    totalExecutions: number;
    avgTokensUsed: number;
    p50Duration: number;
    p95Duration: number;
  }[];
}
```

#### workflows.getSOLOCallHistory

```typescript
// 输入（可选）
{ limit?: number; }  // 默认 50

// 输出
{
  calls: {
    id: string;
    executionId: string;
    stepId: string;
    stepName: string;
    mode: string;
    subAgent: string;
    status: string;
    durationMs: number;
    tokensUsed: number;
    createdAt: string;
  }[];
}
```

---

### 1.8 updater — 模块热更新

| Procedure | 方法 | 认证 | 说明 |
|-----------|------|------|------|
| `updater.listModules` | Query | 需认证 | 列出所有模块 |
| `updater.getModuleInfo` | Query | 需认证 | 获取模块详情 |
| `updater.hotReload` | Mutation | 管理员 | 热重载模块 |
| `updater.enableModule` | Mutation | 管理员 | 启用模块 |
| `updater.disableModule` | Mutation | 管理员 | 禁用模块 |
| `updater.rollback` | Mutation | 管理员 | 回滚模块版本 |
| `updater.checkUpdates` | Mutation | 需认证 | 检查模块更新 |
| `updater.versionHistory` | Query | 需认证 | 获取版本历史 |
| `updater.publishVersion` | Mutation | 管理员 | 发布新版本 |
| `updater.moduleVersionHistory` | Query | 需认证 | 获取模块版本历史 |

#### updater.listModules

```typescript
// 输出
{
  modules: {
    id: string;
    name: string;
    enabled: boolean;
    locked: boolean;
    version: string;
    status: string;
  }[];
}
```

#### updater.getModuleInfo

```typescript
// 输入
{ moduleId: string; }

// 输出
{
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  locked: boolean;
  config: object;
  dependencies: string[];
  currentVersion: ModuleVersion;
}
```

#### updater.hotReload

```typescript
// 输入
{
  moduleId: string;
  force?: boolean;        // 强制重载
}

// 输出
{ success: boolean; message: string; }
```

#### updater.enableModule

```typescript
// 输入
{ moduleId: string; }
```

#### updater.disableModule

```typescript
// 输入
{ moduleId: string; }
```

#### updater.rollback

```typescript
// 输入
{
  moduleId: string;
  targetVersion?: string; // 目标版本，不指定则回滚到上一版本
}

// 输出
{ success: boolean; newVersion: string; }
```

#### updater.checkUpdates

```typescript
// 输入（可选）
{ moduleId?: string; }  // 不指定则检查所有模块

// 输出
{
  updates: {
    moduleId: string;
    currentVersion: string;
    latestVersion: string;
    changelog?: string;
  }[];
}
```

#### updater.versionHistory

```typescript
// 输出
AppVersion[]
```

#### updater.publishVersion

```typescript
// 输入
{
  version: string;        // 语义化版本号
  channel?: string;       // stable | beta | canary
  releaseNotes?: string;  // 发布说明（Markdown）
}

// 输出
AppVersion
```

#### updater.moduleVersionHistory

```typescript
// 输入
{ moduleId: string; }

// 输出
ModuleVersion[]
```

---

### 1.9 stats — 数据统计

| Procedure | 方法 | 认证 | 说明 |
|-----------|------|------|------|
| `stats.taskStats` | Query | 需认证 | 任务统计概览 |
| `stats.dailyTrends` | Query | 需认证 | 每日趋势数据 |
| `stats.aiStats` | Query | 需认证 | AI 引擎统计 |
| `stats.systemStats` | Query | 管理员 | 系统运行统计 |
| `stats.dashboard` | Query | 需认证 | 仪表盘聚合数据 |

#### stats.taskStats

```typescript
// 输出
{
  total: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  byPhase: Record<string, number>;
  overdueCount: number;
  completedToday: number;
  createdToday: number;
}
```

#### stats.dailyTrends

```typescript
// 输入（可选）
{
  days?: number;          // 天数，默认 30
}

// 输出
{
  dates: string[];
  created: number[];
  completed: number[];
  active: number[];
}
```

#### stats.aiStats

```typescript
// 输出
{
  totalCalls: number;
  successRate: number;
  avgTokensUsed: number;
  avgDuration: number;
  byProcessor: Record<string, number>;
  recentCalls: AIAuditLog[];
}
```

#### stats.systemStats

```typescript
// 输出
{
  version: string;
  uptime: number;
  activeModules: number;
  totalModules: number;
  activeAgents: number;
  totalAgents: number;
  dbSize: number;
  memoryUsage: object;
}
```

#### stats.dashboard

```typescript
// 输出
{
  taskStats: object;
  aiStats: object;
  recentActivities: ActivityLog[];
  systemInfo: object;
}
```

---

### 1.10 plugins — 插件系统

| Procedure | 方法 | 认证 | 说明 |
|-----------|------|------|------|
| `plugins.list` | Query | 需认证 | 列出所有插件 |
| `plugins.get` | Query | 需认证 | 获取插件详情 |
| `plugins.install` | Mutation | 管理员 | 安装插件 |
| `plugins.enable` | Mutation | 管理员 | 启用插件 |
| `plugins.disable` | Mutation | 管理员 | 禁用插件 |
| `plugins.uninstall` | Mutation | 管理员 | 卸载插件 |
| `plugins.updateSettings` | Mutation | 管理员 | 更新插件设置 |
| `plugins.getCustomTools` | Query | 需认证 | 获取插件自定义工具 |

#### plugins.list

```typescript
// 输出
Plugin[]
```

#### plugins.get

```typescript
// 输入
{ name: string; }

// 输出
Plugin
```

#### plugins.install

```typescript
// 输入
{
  name: string;
  entryPoint: string;
  displayName: string;
  description?: string;
  version?: string;
  author?: string;
  config?: object;
}

// 输出
Plugin
```

#### plugins.enable

```typescript
// 输入
{ name: string; }
```

#### plugins.disable

```typescript
// 输入
{ name: string; }
```

#### plugins.uninstall

```typescript
// 输入
{ name: string; }
```

#### plugins.updateSettings

```typescript
// 输入
{
  name: string;
  settings: object;       // 用户自定义设置（JSON）
}
```

#### plugins.getCustomTools

```typescript
// 输入
{ name: string; }

// 输出
{
  tools: {
    name: string;
    description: string;
    inputSchema: object;
  }[];
}
```

---

### 1.11 workspaces — 工作空间

| Procedure | 方法 | 认证 | 说明 |
|-----------|------|------|------|
| `workspaces.list` | Query | 需认证 | 列出工作空间 |
| `workspaces.get` | Query | 需认证 | 获取工作空间详情 |
| `workspaces.create` | Mutation | 需认证 | 创建工作空间 |
| `workspaces.update` | Mutation | 需认证 | 更新工作空间 |
| `workspaces.delete` | Mutation | 需认证 | 删除工作空间 |
| `workspaces.invite` | Mutation | 需认证 | 邀请成员 |
| `workspaces.removeMember` | Mutation | 需认证 | 移除成员 |
| `workspaces.members` | Query | 需认证 | 获取成员列表 |

#### workspaces.list

```typescript
// 输出
Workspace[]
```

#### workspaces.get

```typescript
// 输入
{ id: string; }

// 输出
Workspace & { memberCount: number; }
```

#### workspaces.create

```typescript
// 输入
{
  name: string;
  description?: string;
  slug: string;           // URL 友好标识，唯一
  icon?: string;
  settings?: object;
}

// 输出
Workspace
```

#### workspaces.update

```typescript
// 输入
{
  id: string;
  name?: string;
  description?: string;
  icon?: string;
  settings?: object;
}
```

#### workspaces.delete

```typescript
// 输入
{ id: string; }
```

#### workspaces.invite

```typescript
// 输入
{
  workspaceId: string;
  userId: string;
  role: "owner" | "admin" | "member" | "viewer";
}
```

#### workspaces.removeMember

```typescript
// 输入
{
  workspaceId: string;
  userId: string;
}
```

#### workspaces.members

```typescript
// 输入
{ workspaceId: string; }

// 输出
{
  members: (WorkspaceMember & { user: User })[];
}
```

---

### 1.12 feedback — 反馈系统

| Procedure | 方法 | 认证 | 说明 |
|-----------|------|------|------|
| `feedback.listCheckpoints` | Query | 需认证 | 列出反馈检查点 |
| `feedback.handleApproval` | Mutation | 需认证 | 处理审批 |
| `feedback.listRules` | Query | 需认证 | 列出反馈规则 |
| `feedback.createRule` | Mutation | 需认证 | 创建反馈规则 |
| `feedback.getStats` | Query | 需认证 | 获取反馈统计 |

#### feedback.listCheckpoints

```typescript
// 输入（可选）
{
  status?: string;        // pending | approved | rejected | skipped | modified | timeout_expired
  checkpointType?: string;// pre_execute | post_execute | timeout | error | manual
  limit?: number;
  offset?: number;
}

// 输出
{
  checkpoints: FeedbackCheckpoint[];
  total: number;
  pendingCount: number;
}
```

#### feedback.handleApproval

```typescript
// 输入
{
  checkpointId: string;
  action: "approved" | "rejected" | "modified" | "skipped";
  feedback?: string;      // 审批意见
  modifiedOutput?: object; // 修改后的输出
  rating?: number;        // 评分 1-5
}

// 输出
FeedbackCheckpoint
```

#### feedback.listRules

```typescript
// 输入（可选）
{
  isActive?: boolean;
  triggerType?: string;   // step_type | duration | token_cost | rating | error_rate | always
  scopeWorkflowId?: string;
}

// 输出
FeedbackRule[]
```

#### feedback.createRule

```typescript
// 输入
{
  name: string;
  triggerType: string;
  triggerConfig: object;  // 触发条件配置（JSON）
  action: "block" | "notify" | "skip" | "modify" | "escalate";
  actionConfig?: object;
  scopeWorkflowId?: string;
  scopeStepType?: string;
}

// 输出
FeedbackRule
```

#### feedback.getStats

```typescript
// 输出
{
  totalCheckpoints: number;
  approvalRate: number;
  rejectionRate: number;
  autoApprovalRate: number;
  averageRating: number;
  byCheckpointType: Record<string, number>;
  byAction: Record<string, number>;
  recentTrend: object[];
}
```

---

## 二、REST API

### 2.1 tRPC 传输端点

tRPC 通过标准 HTTP 端点进行传输：

```
GET  /api/trpc/[router].[procedure]?input=<encoded_input>
POST /api/trpc/[router].[procedure]
```

**POST 请求示例**：

```bash
curl -X POST http://localhost:3000/api/trpc/tasks.list \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"json":{"page":1,"limit":10}}'
```

**批量请求**：

```bash
curl -X POST http://localhost:3000/api/trpc \
  -H "Content-Type: application/json" \
  -d '{"batch":[{"0":{"json":{"page":1}}},{"1":{"json":{}}}]}'
```

---

### 2.2 MCP Streamable HTTP

MCP（Model Context Protocol）通过 Streamable HTTP 传输：

```
GET  /api/mcp          # SSE 连接
POST /api/mcp          # 发送 MCP 请求
DELETE /api/mcp        # 关闭连接
```

**POST 请求示例**：

```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "id": 1
  }'
```

**调用 MCP 工具**：

```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "create_task",
      "arguments": {
        "title": "实现用户认证模块",
        "priority": "high"
      }
    },
    "id": 2
  }'
```

---

### 2.3 Agent REST API

通用 REST API，任何 AI 智能体均可通过此接口操作：

```
POST /api/v1
```

**认证**：通过 `X-API-Key` header 传递 API Key。

**请求格式**：

```json
{
  "action": "create_task",
  "params": {
    "title": "任务标题",
    "priority": "high"
  }
}
```

**支持的操作**：

| action | 说明 |
|--------|------|
| `create_task` | 创建任务 |
| `update_task` | 更新任务 |
| `get_task` | 获取任务 |
| `list_tasks` | 列出任务 |
| `delete_task` | 删除任务 |
| `update_task_status` | 更新任务状态 |
| `extract_tasks` | AI 提取任务 |
| `decompose_task` | AI 拆解任务 |
| `infer_task_status` | AI 推断状态 |
| `generate_report` | 生成报告 |

**请求示例**：

```bash
curl -X POST http://localhost:3000/api/v1 \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <api-key>" \
  -d '{
    "action": "create_task",
    "params": {
      "title": "实现用户认证模块",
      "description": "包含登录、注册、JWT 鉴权",
      "priority": "high",
      "phase": "implementation"
    }
  }'
```

---

### 2.4 健康检查

```
GET /api/status
```

**响应示例**：

```json
{
  "status": "ok",
  "version": "1.9.0",
  "uptime": 3600,
  "timestamp": "2026-04-29T12:00:00.000Z"
}
```

---

### 2.5 SSE 实时推送

```
GET /api/sse
```

**认证**：`Authorization: Bearer <token>`

**事件类型**：

| 事件频道 | 说明 |
|---------|------|
| `notifications` | 通知推送 |
| `tasks` | 任务状态变更 |
| `workflows` | 工作流执行状态 |
| `checkpoints` | 反馈检查点事件 |

**连接示例**：

```javascript
const eventSource = new EventSource('/api/sse', {
  headers: { 'Authorization': `Bearer ${token}` }
});

eventSource.addEventListener('notifications', (e) => {
  const data = JSON.parse(e.data);
  console.log('通知:', data);
});
```

---

### 2.6 数据备份与恢复

**导出数据**：

```
GET /api/backup
Authorization: Bearer <token>
```

返回 JSON 格式的完整数据库备份。

**导入数据**：

```
POST /api/backup
Authorization: Bearer <token>
Content-Type: application/json
```

请求体为之前导出的 JSON 数据。

> **注意**：导入操作会覆盖现有数据，请谨慎使用。

---

### 2.7 任务导出

```
GET /api/export/tasks?format=json|csv
Authorization: Bearer <token>
```

**查询参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `format` | string | 导出格式：`json` 或 `csv` |
| `status` | string | 按状态筛选 |
| `projectId` | string | 按项目筛选 |

---

### 2.8 项目 API

#### 获取项目列表

```
GET /api/projects
```

**响应**：

```json
{
  "projects": [
    {
      "id": "uuid",
      "name": "项目名称",
      "description": "描述",
      "status": "active",
      "phase": "implementation",
      "priority": "medium",
      "taskCount": 10,
      "createdAt": "2026-04-29T12:00:00.000Z"
    }
  ]
}
```

#### 获取项目活动

```
GET /api/projects/[id]/activities
```

**查询参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `limit` | number | 返回数量，默认 20 |
| `action` | string | 按操作类型筛选 |

#### 获取项目摘要

```
GET /api/projects/[id]/summary
```

**响应**：

```json
{
  "project": { ... },
  "taskStats": {
    "total": 10,
    "byStatus": { "todo": 3, "in_progress": 4, "done": 3 }
  },
  "recentActivities": [ ... ],
  "phaseProgress": { ... }
}
```

---

### 2.9 Webhook 接收

```
POST /api/webhook/[type]
Authorization: Bearer <token>
```

**支持的 Webhook 类型**：

| type | 说明 |
|------|------|
| `github` | GitHub 事件推送 |
| `feishu` | 飞书事件推送 |
| `notion` | Notion 事件推送 |
| `generic` | 通用 Webhook |

**请求示例**：

```bash
curl -X POST http://localhost:3000/api/webhook/github \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '<github-event-payload>'
```

---

## 三、MCP 工具

MCP 服务端提供 25 个工具，供 AI 智能体通过 MCP 协议调用。

### 3.1 Task Core（任务核心）

| 工具名 | 说明 | 关键参数 |
|--------|------|---------|
| `create_task` | 创建任务 | `title`, `description?`, `priority?`, `phase?`, `assignee?`, `dueDate?`, `projectId?`, `tags?`, `dependencies?` |
| `update_task` | 更新任务 | `id`, `title?`, `description?`, `status?`, `priority?`, `progress?`, `assignee?`, `dueDate?` |
| `get_task` | 获取任务详情 | `id` |
| `list_tasks` | 列出任务 | `status?`, `priority?`, `phase?`, `assignee?`, `projectId?`, `limit?`, `offset?`, `search?` |
| `delete_task` | 删除任务 | `id` |
| `update_task_status` | 更新任务状态 | `id`, `status` |
| `get_task_history` | 获取任务变更历史 | `taskId`, `limit?` |
| `get_sub_tasks` | 获取子任务列表 | `parentTaskId` |
| `get_status_counts` | 获取各状态任务数量 | 无 |

#### create_task 示例

```json
{
  "name": "create_task",
  "arguments": {
    "title": "实现用户认证模块",
    "description": "包含登录、注册、JWT 鉴权功能",
    "priority": "high",
    "phase": "implementation",
    "assignee": "developer-1",
    "dueDate": "2026-05-15",
    "tags": ["backend", "auth"]
  }
}
```

---

### 3.2 AI Engine（AI 引擎）

| 工具名 | 说明 | 关键参数 |
|--------|------|---------|
| `extract_tasks` | 从文本中提取任务 | `text`, `projectId?`, `source?` |
| `decompose_task` | 将任务拆解为子任务 | `taskId`, `maxDepth?`, `strategy?` |
| `infer_task_status` | AI 推断任务状态 | `taskId` |
| `generate_report` | 生成分析报告 | `type`, `scope?`, `period?` |

#### extract_tasks 示例

```json
{
  "name": "extract_tasks",
  "arguments": {
    "text": "我们需要实现用户登录功能，包括邮箱密码登录和 OAuth 登录。还需要实现密码重置功能。",
    "projectId": "project-uuid"
  }
}
```

---

### 3.3 Project Lifecycle（项目生命周期）

| 工具名 | 说明 | 关键参数 |
|--------|------|---------|
| `create_project` | 创建项目 | `name`, `description?`, `priority?`, `techStack?`, `repository?` |
| `update_project` | 更新项目 | `id`, `name?`, `description?`, `status?`, `phase?`, `priority?` |
| `get_project` | 获取项目详情 | `id` |
| `list_projects` | 列出项目 | `status?`, `phase?`, `limit?`, `offset?` |
| `project_create_task` | 在项目中创建任务 | `projectId`, `title`, `description?`, `priority?`, `phase?` |
| `project_update_task` | 更新项目中的任务 | `projectId`, `taskId`, `updates` |
| `project_list_tasks` | 列出项目任务 | `projectId`, `status?`, `limit?` |
| `advance_phase` | 推进项目阶段 | `projectId`, `phase` |
| `log_activity` | 记录活动日志 | `projectId`, `action`, `title`, `details?`, `phase?` |
| `get_activity_log` | 获取活动日志 | `projectId`, `action?`, `limit?` |
| `register_agent` | 注册智能体 | `name`, `clientType`, `description?`, `capabilities?` |
| `get_project_summary` | 获取项目摘要 | `projectId` |

#### create_project 示例

```json
{
  "name": "create_project",
  "arguments": {
    "name": "AI Task Hub v2.0",
    "description": "下一代智能任务管理平台",
    "priority": "high",
    "techStack": ["Next.js", "Prisma", "tRPC", "React"],
    "repository": "https://github.com/example/ai-task-hub-v2"
  }
}
```

---

## 四、数据库模型

数据库使用 SQLite，通过 Prisma 7 ORM 管理。共 26 个模型。

### 4.1 User

用户表。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String (UUID) | 主键 |
| `username` | String | 用户名，唯一 |
| `email` | String | 邮箱，唯一 |
| `passwordHash` | String | 密码哈希 |
| `displayName` | String? | 显示名称 |
| `role` | String | 角色：admin / user / agent |
| `avatar` | String? | 头像 URL |
| `isActive` | Boolean | 是否启用 |
| `lastLoginAt` | DateTime? | 最后登录时间 |
| `createdAt` | DateTime | 创建时间 |
| `updatedAt` | DateTime | 更新时间 |

**索引**：username, email, role, isActive

---

### 4.2 Task

任务表。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String (UUID) | 主键 |
| `title` | String | 任务标题 |
| `description` | String? | 任务描述 |
| `status` | String | 状态：todo / in_progress / done / closed / deleted |
| `priority` | String | 优先级：urgent / high / medium / low |
| `progress` | Int | 进度 0-100 |
| `type` | String | 类型 |
| `phase` | String | 阶段：requirements / planning / architecture / implementation / testing / deployment / review |
| `source` | String | 来源：trae / cursor / windsurf / manual / ai / import / mcp |
| `sourceRef` | String? | 来源引用 |
| `assignee` | String? | 负责人 |
| `creator` | String? | 创建者（agentId 或 userId） |
| `parentTaskId` | String? | 父任务 ID |
| `projectId` | String? | 所属项目 ID |
| `dueDate` | DateTime? | 截止日期 |
| `startedAt` | DateTime? | 开始时间 |
| `completedAt` | DateTime? | 完成时间 |
| `metadata` | String? | 元数据（JSON） |
| `createdAt` | DateTime | 创建时间 |
| `updatedAt` | DateTime | 更新时间 |

**关联**：project, parentTask, subTasks, dependencies, dependents, history, tags, activities

**索引**：status, priority, type, creator, parentTaskId, dueDate, createdAt, [status, createdAt], [status, priority], [assignee, status], projectId, phase, source

---

### 4.3 TaskDependency

任务依赖关系表。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String (UUID) | 主键 |
| `taskId` | String | 任务 ID |
| `dependsOnId` | String | 依赖的任务 ID |
| `createdAt` | DateTime | 创建时间 |

**唯一约束**：[taskId, dependsOnId]

---

### 4.4 TaskHistory

任务变更历史表。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String (UUID) | 主键 |
| `taskId` | String | 任务 ID |
| `field` | String | 变更字段 |
| `oldValue` | String? | 旧值 |
| `newValue` | String? | 新值 |
| `actor` | String? | 操作者 |
| `createdAt` | DateTime | 创建时间 |

---

### 4.5 Tag

标签表。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String (UUID) | 主键 |
| `name` | String | 标签名，唯一 |
| `color` | String | 颜色，默认 #6B7280 |
| `createdAt` | DateTime | 创建时间 |

---

### 4.6 TaskTag

任务-标签关联表。

| 字段 | 类型 | 说明 |
|------|------|------|
| `taskId` | String | 任务 ID |
| `tagId` | String | 标签 ID |

**复合主键**：[taskId, tagId]

---

### 4.7 AIAuditLog

AI 审计日志表。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String (UUID) | 主键 |
| `processor` | String | 处理器名称 |
| `input` | String | 输入数据 |
| `output` | String | 输出数据 |
| `model` | String | AI 模型 |
| `tokensUsed` | Int | Token 消耗 |
| `duration` | Int | 耗时（ms） |
| `success` | Boolean | 是否成功 |
| `error` | String? | 错误信息 |
| `createdAt` | DateTime | 创建时间 |

---

### 4.8 Agent

智能体表。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String (UUID) | 主键 |
| `name` | String | 智能体名称 |
| `description` | String? | 描述 |
| `apiKey` | String | API Key，唯一 |
| `clientType` | String | 客户端类型：trae / cursor / windsurf / vscode / claude / chatgpt / mcp / api |
| `clientVersion` | String? | 客户端版本 |
| `capabilities` | String? | 能力列表（JSON） |
| `permissionLevel` | String | 权限级别：user / agent |
| `isActive` | Boolean | 是否启用 |
| `lastSeenAt` | DateTime? | 最后活跃时间 |
| `createdAt` | DateTime | 创建时间 |
| `updatedAt` | DateTime | 更新时间 |

**关联**：operations, projects, activities

---

### 4.9 AgentOperation

智能体操作日志表。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String (UUID) | 主键 |
| `agentId` | String | 智能体 ID |
| `action` | String | 操作类型 |
| `target` | String? | 目标资源 ID |
| `details` | String? | 操作详情（JSON） |
| `success` | Boolean | 是否成功 |
| `error` | String? | 错误信息 |
| `createdAt` | DateTime | 创建时间 |

---

### 4.10 Integration

集成配置表。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String (UUID) | 主键 |
| `type` | String | 集成类型：github / feishu / notion / webhook |
| `name` | String | 集成名称 |
| `description` | String? | 描述 |
| `config` | String | 配置（JSON） |
| `isActive` | Boolean | 是否启用 |
| `lastSyncAt` | DateTime? | 最后同步时间 |
| `syncStatus` | String | 同步状态：idle / syncing / error |
| `lastError` | String? | 最后错误 |
| `createdAt` | DateTime | 创建时间 |
| `updatedAt` | DateTime | 更新时间 |

---

### 4.11 Webhook

Webhook 配置表。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String (UUID) | 主键 |
| `integrationId` | String? | 关联集成 ID |
| `name` | String | Webhook 名称 |
| `url` | String | 回调 URL |
| `secret` | String? | HMAC 签名密钥 |
| `events` | String? | 事件列表（JSON） |
| `isActive` | Boolean | 是否启用 |
| `lastTriggered` | DateTime? | 最后触发时间 |
| `triggerCount` | Int | 触发次数 |
| `createdAt` | DateTime | 创建时间 |
| `updatedAt` | DateTime | 更新时间 |

---

### 4.12 Notification

通知表。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String (UUID) | 主键 |
| `type` | String | 通知类型 |
| `title` | String | 标题 |
| `message` | String | 消息内容 |
| `level` | String | 级别：info / warning / error / success |
| `channel` | String | 渠道：system / webhook / browser_push / email / telegram / wechat |
| `isRead` | Boolean | 是否已读 |
| `metadata` | String? | 元数据（JSON） |
| `createdAt` | DateTime | 创建时间 |

---

### 4.13 AppVersion

应用版本表。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String (UUID) | 主键 |
| `version` | String | 版本号，唯一 |
| `channel` | String | 渠道：stable / beta / canary |
| `releaseNotes` | String? | 发布说明（Markdown） |
| `checksum` | String? | SHA256 校验和 |
| `isCurrent` | Boolean | 是否为当前版本 |
| `publishedAt` | DateTime | 发布时间 |

---

### 4.14 ModuleVersion

模块版本表。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String (UUID) | 主键 |
| `moduleId` | String | 模块 ID |
| `version` | String | 版本号 |
| `previousVersion` | String? | 上一版本 |
| `changelog` | String? | 变更日志 |
| `status` | String | 状态：active / rollback / archived |
| `configSnapshot` | String? | 配置快照（JSON） |
| `deployedAt` | DateTime | 部署时间 |

---

### 4.15 Plugin

插件表。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String (UUID) | 主键 |
| `name` | String | 插件名，唯一 |
| `displayName` | String | 显示名称 |
| `description` | String? | 描述 |
| `version` | String | 版本号 |
| `author` | String? | 作者 |
| `homepage` | String? | 主页 |
| `license` | String? | 许可证 |
| `entryPoint` | String | 入口文件路径 |
| `config` | String? | 配置（JSON） |
| `isEnabled` | Boolean | 是否启用 |
| `settings` | String? | 用户设置（JSON） |
| `installedAt` | DateTime | 安装时间 |
| `updatedAt` | DateTime | 更新时间 |

---

### 4.16 Workspace

工作空间表。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String (UUID) | 主键 |
| `name` | String | 名称 |
| `description` | String? | 描述 |
| `slug` | String | URL 标识，唯一 |
| `icon` | String? | 图标 |
| `owner` | String | 所有者（用户 ID） |
| `settings` | String? | 设置（JSON） |
| `isDefault` | Boolean | 是否为默认空间 |
| `createdAt` | DateTime | 创建时间 |
| `updatedAt` | DateTime | 更新时间 |

---

### 4.17 WorkspaceMember

工作空间成员表。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String (UUID) | 主键 |
| `workspaceId` | String | 工作空间 ID |
| `userId` | String | 用户 ID |
| `role` | String | 角色：owner / admin / member / viewer |
| `joinedAt` | DateTime | 加入时间 |

**唯一约束**：[workspaceId, userId]

---

### 4.18 Project

项目表。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String (UUID) | 主键 |
| `name` | String | 项目名称 |
| `description` | String? | 描述 |
| `status` | String | 状态：active / completed / archived / paused |
| `phase` | String | 阶段：requirements / planning / architecture / implementation / testing / deployment / completed |
| `priority` | String | 优先级：urgent / high / medium / low |
| `techStack` | String? | 技术栈（JSON） |
| `repository` | String? | 仓库 URL |
| `creatorId` | String? | 创建者 ID |
| `creatorType` | String | 创建者类型：agent / user |
| `metadata` | String? | 元数据（JSON） |
| `startedAt` | DateTime? | 开始时间 |
| `completedAt` | DateTime? | 完成时间 |
| `createdAt` | DateTime | 创建时间 |
| `updatedAt` | DateTime | 更新时间 |

**关联**：tasks, activities, creator

---

### 4.19 ActivityLog

活动日志表。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String (UUID) | 主键 |
| `projectId` | String? | 项目 ID |
| `taskId` | String? | 任务 ID |
| `agentId` | String? | 智能体 ID |
| `action` | String | 操作类型 |
| `phase` | String? | 阶段 |
| `title` | String | 标题 |
| `details` | String? | 详情（JSON） |
| `metadata` | String? | 元数据（JSON） |
| `createdAt` | DateTime | 创建时间 |

---

### 4.20 Workflow

工作流定义表。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String (UUID) | 主键 |
| `name` | String | 工作流名称 |
| `description` | String? | 描述 |
| `trigger` | String | 触发器类型：manual / webhook / schedule / event / github-issue / approval |
| `triggerConfig` | String? | 触发器配置（JSON） |
| `steps` | String | 步骤定义（JSON） |
| `variables` | String? | 全局变量（JSON） |
| `isActive` | Boolean | 是否启用 |
| `createdBy` | String? | 创建者 |
| `retryPolicy` | String? | 重试策略（JSON） |
| `concurrencyLimit` | Int | 并发限制，默认 5 |
| `timeoutMs` | Int | 超时时间，默认 300000 |
| `soloConfig` | String? | SOLO 配置（JSON） |
| `createdAt` | DateTime | 创建时间 |
| `updatedAt` | DateTime | 更新时间 |

**关联**：executions, triggerLogs

---

### 4.21 WorkflowExecution

工作流执行记录表。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String (UUID) | 主键 |
| `workflowId` | String | 工作流 ID |
| `workflowSnapshot` | String | 执行时工作流快照（JSON） |
| `status` | String | 状态：pending / running / completed / failed / cancelled |
| `currentStepId` | String? | 当前步骤 ID |
| `context` | String? | 执行上下文（JSON） |
| `triggerType` | String | 触发类型 |
| `triggeredBy` | String? | 触发者 |
| `startedAt` | DateTime? | 开始时间 |
| `completedAt` | DateTime? | 完成时间 |
| `error` | String? | 错误信息 |
| `createdAt` | DateTime | 创建时间 |
| `updatedAt` | DateTime | 更新时间 |

**关联**：workflow, stepExecutions, feedbackCheckpoints

---

### 4.22 WorkflowStepExecution

工作流步骤执行记录表。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String (UUID) | 主键 |
| `executionId` | String | 执行记录 ID |
| `stepId` | String | 步骤 ID |
| `stepName` | String | 步骤名称 |
| `stepType` | String | 步骤类型 |
| `status` | String | 状态：pending / running / completed / failed / skipped |
| `input` | String? | 输入（JSON） |
| `output` | String? | 输出（JSON） |
| `error` | String? | 错误信息 |
| `startedAt` | DateTime? | 开始时间 |
| `completedAt` | DateTime? | 完成时间 |
| `durationMs` | Int? | 耗时（ms） |
| `tokensUsed` | Int | Token 消耗 |
| `retryCount` | Int | 重试次数 |
| `parentStepId` | String? | 父步骤 ID |
| `soloSessionId` | String? | SOLO 会话 ID |
| `soloCallMode` | String? | SOLO 调用模式 |
| `soloSubAgent` | String? | SOLO 子智能体 |
| `createdAt` | DateTime | 创建时间 |

---

### 4.23 WorkflowTriggerLog

工作流触发日志表。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String (UUID) | 主键 |
| `workflowId` | String | 工作流 ID |
| `triggerType` | String | 触发类型：manual / webhook / schedule / event / github-issue / approval |
| `payload` | String? | 触发载荷（JSON） |
| `success` | Boolean | 是否成功 |
| `error` | String? | 错误信息 |
| `createdAt` | DateTime | 创建时间 |

---

### 4.24 FeedbackCheckpoint

反馈检查点表。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String (UUID) | 主键 |
| `executionId` | String | 执行记录 ID |
| `stepId` | String | 步骤 ID |
| `stepName` | String | 步骤名称 |
| `stepType` | String | 步骤类型 |
| `checkpointType` | String | 类型：pre_execute / post_execute / timeout / error / manual |
| `status` | String | 状态：pending / approved / rejected / skipped / modified / timeout_expired |
| `approvalMode` | String | 审批模式：auto / notify / block / smart |
| `contextSnapshot` | String? | 上下文快照（JSON） |
| `stepOutput` | String? | 步骤输出 |
| `soloCallRecord` | String? | SOLO 调用记录 |
| `intervenedBy` | String? | 干预者：user / solo / auto_rule |
| `intervention` | String? | 干预详情 |
| `rating` | Int? | 评分 1-5 |
| `feedback` | String? | 反馈内容 |
| `createdAt` | DateTime | 创建时间 |
| `resolvedAt` | DateTime? | 解决时间 |

---

### 4.25 FeedbackRule

反馈规则表。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String (UUID) | 主键 |
| `name` | String | 规则名称 |
| `triggerType` | String | 触发类型：step_type / duration / token_cost / rating / error_rate / always |
| `triggerConfig` | String | 触发配置（JSON） |
| `action` | String | 动作：block / notify / skip / modify / escalate |
| `actionConfig` | String? | 动作配置（JSON） |
| `scopeWorkflowId` | String? | 作用域工作流 ID |
| `scopeStepType` | String? | 作用域步骤类型 |
| `isActive` | Boolean | 是否启用 |
| `createdBy` | String? | 创建者：user / solo |
| `createdAt` | DateTime | 创建时间 |
| `updatedAt` | DateTime | 更新时间 |

---

### 4.26 StepFeedback

步骤反馈表。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String (UUID) | 主键 |
| `executionId` | String | 执行记录 ID |
| `stepExecutionId` | String | 步骤执行 ID |
| `rating` | Int | 评分 1-5 |
| `tags` | String? | 标签（JSON 数组） |
| `comment` | String? | 评论 |
| `soloReflection` | String? | SOLO 自省（JSON） |
| `improvementAction` | String? | 改进措施（JSON） |
| `createdAt` | DateTime | 创建时间 |
