# Trae × AI Task Hub — 完整项目执行流程演示

> 场景：用户在 Trae 中发起一个「电商后端 API 开发」项目，从需求分析到部署上线的全流程。

---

## 📖 流程总览

```
用户提出需求 → Trae 注册 → 创建项目 → AI 拆解任务 → 工作流执行
→ 代码审查 → 人工审批 → 部署 → 项目完成
```

---

## Phase 1: Agent 注册

**触发**：Trae 首次连接 AI Task Hub

**Trae 发送**：
```json
{
  "tool": "register_agent",
  "arguments": {
    "name": "Trae AI",
    "clientType": "ide",
    "clientVersion": "3.2.0",
    "capabilities": ["code-generation", "code-review", "testing", "deployment"]
  }
}
```

**涉及模块**：

| 模块 | 作用 |
|------|------|
| **mcp-server** | 接收 MCP 工具调用，路由到 `register_agent` handler |
| **agent-collab** | AgentService 创建 Agent 记录，生成 API Key |
| **Prisma** | 写入 `Agent` 表 |
| **EventBus** | 发射 `agent.registered` 事件 |
| **notifications** | 监听事件，生成「新 Agent 注册」通知 |
| **realtime (SSE)** | EventBridge 桥接，推送通知到前端 |

**返回**：
```json
{
  "agentId": "agent-trae-001",
  "apiKey": "sk-trae-xxxx",
  "status": "active"
}
```

---

## Phase 2: 创建项目

**触发**：Trae 调用 `create_project` 工具

**Trae 发送**：
```json
{
  "tool": "create_project",
  "arguments": {
    "name": "电商后端 API",
    "description": "基于 Node.js + Express 的电商后端，包含商品/订单/支付模块",
    "priority": "high",
    "techStack": ["Node.js", "Express", "PostgreSQL", "Redis"],
    "repository": "https://github.com/user/ecommerce-api",
    "agentId": "agent-trae-001"
  }
}
```

**涉及模块**：

| 模块 | 作用 |
|------|------|
| **mcp-server** | 路由到 `project-tools.ts` 的 `create_project` handler |
| **Prisma** | 写入 `Project` 表（phase: requirements, status: active） |
| **EventBus** | 发射 `task.*` 事件（间接） |
| **notifications** | 生成「项目创建」通知 |
| **realtime (SSE)** | 推送到前端仪表盘 |

**返回**：
```json
{
  "projectId": "proj-ecom-001",
  "name": "电商后端 API",
  "phase": "requirements",
  "status": "active"
}
```

---

## Phase 3: AI 需求拆解

**触发**：Trae 调用 `decompose_task` + `create_task` 批量创建任务

### 3.1 AI 智能拆解

**Trae 发送**：
```json
{
  "tool": "decompose_task",
  "arguments": {
    "title": "电商后端 API 开发",
    "description": "基于 Node.js + Express 的电商后端，包含商品/订单/支付模块"
  }
}
```

**涉及模块**：

| 模块 | 作用 |
|------|------|
| **mcp-server** | 路由到 `ai-engine-tools.ts` 的 `decompose_task` handler |
| **ai-engine** | TaskDecomposer 调用 OpenAI API 进行智能拆解 |
| **ai-engine** | AuditLogRepository 记录 AI 调用日志（token 消耗、耗时） |
| **Prisma** | 写入 `AIAuditLog` 表 |

**AI 返回拆解结果**：
```json
{
  "subtasks": [
    { "title": "设计数据库 Schema", "priority": "high", "phase": "planning" },
    { "title": "实现商品模块 CRUD", "priority": "high", "phase": "implementation" },
    { "title": "实现订单模块", "priority": "high", "phase": "implementation" },
    { "title": "实现支付模块", "priority": "high", "phase": "implementation" },
    { "title": "编写单元测试", "priority": "medium", "phase": "testing" },
    { "title": "部署到生产环境", "priority": "medium", "phase": "deployment" }
  ]
}
```

### 3.2 批量创建任务

**Trae 循环调用** `project_create_task`（6 次）：

```json
{
  "tool": "project_create_task",
  "arguments": {
    "projectId": "proj-ecom-001",
    "title": "设计数据库 Schema",
    "priority": "high",
    "phase": "planning",
    "agentId": "agent-trae-001",
    "tags": ["database", "design"]
  }
}
```

**涉及模块**：

| 模块 | 作用 |
|------|------|
| **mcp-server** | 路由到 `project_create_task` handler |
| **task-core** | TaskService.createTask() 创建任务 |
| **task-core** | TaskRepository 写入 `Task` 表 |
| **task-core** | TaskHistoryRepository 记录创建历史 |
| **Prisma** | 写入 `Task` + `TaskHistory` + `TaskTag` 表 |
| **EventBus** | 发射 `task.created` 事件（每次创建） |
| **notifications** | NotificationRuleEngine 监听 `task.created`，生成通知 |
| **realtime (SSE)** | SSE 推送「新任务创建」到前端看板 |
| **agent-collab** | AgentOperationRepository 记录 Trae 的操作日志 |

**唯一性检查**（S-MCP-02 修复）：同名任务不会重复创建。

---

## Phase 4: 推进阶段 + 工作流执行

**触发**：Trae 调用 `advance_phase` + 触发工作流

### 4.1 推进到 planning 阶段

```json
{
  "tool": "advance_phase",
  "arguments": {
    "projectId": "proj-ecom-001",
    "phase": "planning",
    "summary": "需求分析完成，进入架构设计阶段",
    "agentId": "agent-trae-001"
  }
}
```

**涉及模块**：

| 模块 | 作用 |
|------|------|
| **mcp-server** | 路由到 `advance_phase` handler |
| **Prisma** | 更新 `Project.phase` → `planning` |
| **notifications** | 生成「阶段推进」通知 |
| **realtime (SSE)** | 推送阶段变更到前端 |

### 4.2 触发工作流执行

```json
{
  "tool": "workflows.run",
  "arguments": {
    "workflowId": "wf-code-review"
  }
}
```

**涉及模块**（这是最复杂的协作流程）：

```
tRPC Router (workflows-router.ts)
  │
  v
WorkflowOrchestrator ─── ConcurrencyController（并发控制）
  │
  v
WorkflowExecutor ─── 遍历步骤
  │
  ├── Step 1: condition（条件判断）
  │     └── condition.ts 安全求值器（黑名单 + 长度限制）
  │
  ├── Step 2: ai-analyze（AI 分析）
  │     └── SOLOBridge.call() → 外部 AI API
  │           └── Observability 记录指标 → EventBus
  │
  ├── Step 3: parallel-group（并行执行）
  │     ├── create-task → TaskService [task-core]
  │     └── send-notification → SSEService [realtime]
  │
  ├── Step 4: foreach（循环处理，concurrency=5）
  │     └── 分批并行执行子步骤
  │
  ├── Step 5: approval（人工审批）
  │     └── FeedbackModule
  │           ├── SOLO 自省（风险评估）
  │           ├── 创建 FeedbackCheckpoint → Prisma
  │           ├── SSE 推送审批请求 → [realtime]
  │           └── 轮询等待审批结果（2s 间隔）
  │
  └── Step 6: invoke-agent（调用 Trae 执行代码修改）
        └── SOLOBridge.call() → Trae API
```

**完整模块协作图**：

```
workflows-router (tRPC)
    │
    ├── workflow-engine
    │     ├── WorkflowOrchestrator
    │     ├── WorkflowExecutor
    │     ├── StepRegistry (12 种步骤)
    │     ├── FeedbackModule
    │     │     ├── SOLOBridge → 外部 AI
    │     │     └── ImprovementLoop（改进建议）
    │     ├── Observability → EventBus
    │     ├── TriggerDispatcher
    │     └── WorkflowNotificationIntegration → SSE
    │
    ├── task-core
    │     ├── TaskService (create/update/delete)
    │     ├── TaskRepository → Prisma
    │     └── TaskHistoryRepository → Prisma
    │
    ├── ai-engine
    │     ├── TaskDecomposer → OpenAI API
    │     └── AuditLogRepository → Prisma
    │
    ├── agent-collab
    │     └── AgentOperationRepository → Prisma
    │
    ├── notifications
    │     ├── NotificationRuleEngine (监听 EventBus)
    │     └── NotificationRepository → Prisma
    │
    ├── realtime (SSE)
    │     ├── SSEService.broadcast()
    │     └── EventBridge (EventBus → SSE 桥接)
    │
    ├── auth
    │     └── AuthService (JWT 验证 tRPC 请求)
    │
    └── Prisma (全局单例 getPrisma())
          └── SQLite (25 个表)
```

---

## Phase 5: 代码审查工作流（详细步骤）

### Step 1: 解析 PR 变更

```
workflow-engine → StepHandler: http-request
  → 调用 GitHub API 获取 PR diff
  → 返回变更文件列表
```

**模块**: workflow-engine (http-request 步骤) + 外部 GitHub API

### Step 2: AI 代码审查

```
workflow-engine → StepHandler: ai-analyze
  → SOLOBridge.call()
    → OpenAI API (gpt-4o)
    → 返回审查报告
  → Observability.recordStepMetrics()
    → EventBus.emit('workflow.step.completed')
    → WorkflowNotificationIntegration → SSE 广播
```

**模块**: workflow-engine + ai-engine (SOLO) + realtime (SSE)

### Step 3: 并行创建审查任务

```
workflow-engine → StepHandler: parallel-group
  ├── create-task "修复安全问题" → TaskService [task-core]
  ├── create-task "优化性能" → TaskService [task-core]
  └── create-task "补充测试" → TaskService [task-core]
```

**模块**: workflow-engine + task-core + EventBus + notifications

### Step 4: 人工审批

```
workflow-engine → StepHandler: approval
  → FeedbackModule.preExecuteCheck()
    ├── SOLO 自省：评估风险级别
    ├── 创建 FeedbackCheckpoint → Prisma
    ├── SSE 推送：通知前端有审批待处理 [realtime]
    └── 轮询 DB 等待审批（pollInterval: 2000ms）
```

**前端用户操作**：
```
用户在前端点击「批准」
  → tRPC: feedback.handleApproval({ action: 'approved' })
    → FeedbackModule 收到审批结果
    → 继续执行后续步骤
```

**模块**: workflow-engine (FeedbackModule) + SOLO + Prisma + realtime (SSE) + auth (tRPC 认证)

### Step 5: 调用 Trae 执行修改

```
workflow-engine → StepHandler: invoke-agent
  → SOLOBridge.call()
    → Trae API（通过 MCP 回调）
    → Trae 执行代码修改
    → 返回修改结果
```

**模块**: workflow-engine (SOLOBridge)

---

## Phase 6: 部署上线

**触发**：Trae 调用 `advance_phase` → `deployment`

```json
{
  "tool": "advance_phase",
  "arguments": {
    "projectId": "proj-ecom-001",
    "phase": "deployment",
    "summary": "所有测试通过，准备部署",
    "agentId": "agent-trae-001"
  }
}
```

**涉及模块**：

| 模块 | 作用 |
|------|------|
| **mcp-server** | 路由请求 |
| **Prisma** | 更新 Project.phase → deployment |
| **EventBus** | 发射事件 |
| **notifications** | 多渠道通知（Telegram + Webhook + SSE） |
| **realtime (SSE)** | 前端仪表盘实时更新进度 |

---

## Phase 7: 项目完成

**触发**：Trae 调用 `advance_phase` → `completed`

```json
{
  "tool": "advance_phase",
  "arguments": {
    "projectId": "proj-ecom-001",
    "phase": "completed",
    "summary": "电商后端 API 开发完成，已部署上线",
    "agentId": "agent-trae-001"
  }
}
```

**Trae 获取项目摘要**：
```json
{
  "tool": "get_project_summary",
  "arguments": {
    "projectId": "proj-ecom-001"
  }
}
```

**涉及模块**：

| 模块 | 作用 |
|------|------|
| **mcp-server** | 路由到 `get_project_summary` handler |
| **Prisma** | 并行查询 Project + Task + ActivityLog + Agent |
| **task-core** | 任务统计（完成率、各状态数量） |
| **agent-collab** | Agent 列表和统计 |

**返回**：
```json
{
  "project": {
    "name": "电商后端 API",
    "phase": "completed",
    "status": "active"
  },
  "overallProgress": 100,
  "taskStats": {
    "total": 6,
    "todo": 0,
    "inProgress": 0,
    "done": 6,
    "completionRate": 100
  },
  "agents": [
    { "name": "Trae AI", "completedTasks": 6 }
  ]
}
```

---

## 📊 全流程模块调用统计

| 模块 | 调用次数 | 主要作用 |
|------|---------|---------|
| **mcp-server** | 15+ | 工具路由和请求处理 |
| **task-core** | 8 | 任务 CRUD + 状态管理 |
| **workflow-engine** | 3 | 工作流编排 + 步骤执行 |
| **ai-engine** | 2 | 需求拆解 + 代码审查 |
| **agent-collab** | 3 | Agent 注册 + 操作记录 |
| **notifications** | 10+ | 事件驱动通知（自动触发） |
| **realtime (SSE)** | 10+ | 实时推送（自动桥接） |
| **auth** | 3 | tRPC 请求认证 |
| **Prisma** | 30+ | 数据持久化（全局单例） |
| **EventBus** | 20+ | 模块间异步通信 |

---

## 🔗 模块协作关系总结

```
Trae (外部 AI Agent)
  │
  │ MCP Streamable HTTP
  v
┌─────────────────────────────────────────────────┐
│                  mcp-server                      │
│  (工具注册 + 路由 + 会话管理)                     │
└────────┬──────────────┬──────────────┬──────────┘
         │              │              │
         v              v              v
   ┌──────────┐  ┌──────────┐  ┌──────────────┐
   │task-core │  │ai-engine │  │agent-collab  │
   └────┬─────┘  └────┬─────┘  └──────────────┘
        │              │
        │              │
        v              v
   ┌─────────────────────────────┐
   │       workflow-engine        │
   │  (编排 + 12 步骤 + 反馈)     │
   └──┬──────────┬──────────┬────┘
      │          │          │
      v          v          v
  ┌────────┐ ┌────────┐ ┌────────┐
  │task-core│ │ SOLO   │ │feedback │
  │(子任务) │ │(AI自省)│ │(人工审批)│
  └────────┘ └────────┘ └────────┘
      │                     │
      v                     v
  ┌─────────────────────────────────┐
  │          EventBus (事件总线)       │
  └──┬──────────────┬───────────────┘
     │              │
     v              v
┌──────────┐  ┌──────────┐
│notifications│ │ realtime │
│(多渠道通知) │ │(SSE 推送)│
└──────────┘  └──────────┘
     │              │
     v              v
┌─────────────────────────────────┐
│       Prisma (全局单例)           │
│       SQLite (25 个表)            │
└─────────────────────────────────┘
```

**关键设计**：
- **EventBus** 是模块间松耦合的核心，notifications 和 realtime 不需要直接引用 workflow-engine
- **DIContainer** 管理服务生命周期，模块通过 token 解析依赖
- **Prisma 全局单例** 确保所有模块共享同一个数据库连接
- **MCP 协议** 是外部 Agent 接入的唯一入口，所有工具调用统一路由
