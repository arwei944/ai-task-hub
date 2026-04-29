# Changelog

## [1.7.0] - 2026-04-29

### 🚀 Phase B: 触发器系统 + 高级步骤 + 通知集成

#### 触发器系统 (B-1~B-4)
- **TriggerDispatcher** — 统一触发器管理，支持 5 种触发类型
  - `schedule` — 定时触发（cron 表达式 + 固定间隔）
  - `event` — EventBus 事件触发（支持通配符过滤）
  - `webhook` — HTTP 回调触发
  - `manual` — 手动触发
  - `github-issue` — GitHub Issue 触发（预留）
- **WorkflowTriggerLog** — 触发器执行日志记录

#### 高级步骤 (B-5~B-8)
- **invoke-agent** — SOLO 完整任务执行步骤，支持子智能体类型和调用模式配置
- **foreach** — 数组迭代步骤，支持子步骤执行、itemVar/indexVar 变量注入、failFast 模式
- **approval** — 人工审批节点，阻塞式等待，支持 approved/rejected/modified/skipped/timeout 状态
- **重试机制** — 步骤级重试策略，支持 exponential/linear/fixed 三种退避算法

#### 反馈规则引擎 (B-9)
- **后置规则评估** — postExecuteCheck 集成规则引擎，支持 duration/token_cost/error 触发
- **SOLO 深度自省** — soloSelfReflect 通过 SOLO Bridge 进行风险评估，失败时回退简单逻辑
- **error 触发类型** — 正则表达式匹配错误消息，自动触发干预规则

#### 通知集成 (B-10)
- **WorkflowNotificationIntegration** — EventBus→SSE 事件桥接，7 种工作流事件实时推送
- **反馈检查点 SSE 推送** — checkpoint.created / checkpoint.completed 实时广播
- **工作流通知 SSE 推送** — send-notification 步骤结果实时广播到 notifications 频道

#### tRPC 路由
- **workflows-router** — 新增 trigger procedure，支持手动触发工作流

---

## [1.6.0] - 2026-04-29

### 🚀 Phase A: SOLO 统一 AI 层 + 反馈模块

#### 后端架构
- **SOLO Bridge** — 统一 AI 调用层，支持 MCP/REST/Pull 三种模式，完整调用记录和会话管理
- **反馈模块** — 嵌入执行流程的检查点系统，4 种干预模式（auto/notify/block/smart），SOLO 自省，规则引擎
- **执行层重构** — Executor + Orchestrator + Context + Concurrency + Observability 六层架构
- **12 种步骤类型** — create-task, update-status, ai-analyze, send-notification, wait, parallel-group, condition, foreach, invoke-agent, http-request, transform, approval
- **数据库扩展** — 新增 FeedbackCheckpoint/FeedbackRule/StepFeedback 模型，Workflow/WorkflowStepExecution 新字段

#### 前端
- **反馈中心** — 独立交互通道，待处理队列、批准/拒绝操作、统计面板
- **工作流管理** — 5 Tab 导航（工作流/智能体/技能库/记忆/规则组合），支持 12 种步骤类型
- **导航重构** — 侧边栏更新为：仪表盘、反馈中心、工作流管理、任务、智能体等
- **旧页面重定向** — /agent-workflows 自动重定向到 /workflows

#### tRPC 路由
- **feedback-router** — listCheckpoints, handleApproval, listRules, createRule, getStats
- **workflows-router** — 扩展支持 12 种步骤类型和反馈模式字段

#### 版本管理
- 新增发布脚本 `scripts/release.sh`，支持自动版本号、CHANGELOG 更新、Git tag

---

## [1.5.0] - 2026-04-29

### 🔄 重大变更

- **单管理员免登录模式** — 移除注册/登录流程，打开即用
  - 首次访问自动创建管理员账号 (admin/admin)
  - tRPC context 层自动认证，所有 protectedProcedure/adminProcedure 直接通过
  - 移除 AuthGuard 组件，所有页面直接渲染
  - tRPC client 不再需要发送 Authorization header
  - REST API (backup/sse/export/webhook) 移除认证检查
  - 首页 "登录" 按钮改为 "进入仪表盘"

### 🔧 优化

- 简化认证架构，减少不必要的 JWT 验证开销
- REST API 响应更快（无 auth 中间件延迟）

## [1.4.0] - 2026-04-29

### ✨ 新功能

- **关于页面** — 全新项目信息展示页
  - 项目简介与核心特性展示
  - 技术栈详情（Next.js 16 / tRPC v11 / Prisma 7 / React 19）
  - 模块化架构说明（EventBus / DIContainer / ModuleRegistry）
  - 版本历史与更新日志
  - 开源协议与联系方式
- **侧边栏导航** — 新增"关于"入口

### 🔧 优化

- **HF Spaces 持久化存储** — 数据库路径迁移到 /data（HF Bucket 挂载点）