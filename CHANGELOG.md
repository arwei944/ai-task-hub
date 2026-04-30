# Changelog

## [2.0.0] - 2026-04-30

### v2.0.0 正式发布 — 全流程贯通 + 集成测试 + 文档完善

从 alpha.1 到 rc.1，历经 9 个迭代版本，AI Task Hub v2.0.0 正式发布。本版本实现了事件驱动架构、AI 主动参与、项目全生命周期管理、知识沉淀和测试管理五大核心能力。

#### 架构升级
- **EventBus v2** — 事件溯源 + Schema 校验，38 个事件类型覆盖 8 大领域
- **事件驱动工作流** — task-core/version-mgmt/workflow-engine/lifecycle/requirements 全模块事件接入
- **AI Engine v2** — 3 个事件处理器（TaskCreated/TaskStatus/ProjectPhase），规则驱动无需 API 调用
- **模块化架构** — 15+ 模块通过 ModuleRegistry + DIContainer 协同工作

#### 新模块 (5 个)
- **lifecycle** — 项目生命周期管理器，6 条阶段转换规则 + 审批系统
- **requirements** — 结构化需求管理，10 个 Service 方法 + AI 规则分析器
- **knowledge** — 知识库管理，支持经验沉淀和 AI 提取
- **test-management** — 测试管理，测试用例/执行/套件 + AI 生成
- **version-mgmt** — 版本发布系统，完整生命周期 + 语义化版本 + 审批

#### 工作流引擎增强
- **http-request 步骤** — 支持 5 种 HTTP 方法，自定义 headers/body/timeout
- **transform 步骤** — 7 种数据转换（map/filter/reduce/pick/omit/merge/template）
- **6 个阶段模板** — 需求分析到部署发布的完整工作流模板
- **阶段变更自动触发** — project.phase.changed 事件自动匹配工作流

#### 集成测试
- **全生命周期集成测试** — 端到端覆盖项目创建到发布的完整流程
- **EventBus 验证** — 事件顺序、通配符监听、类型监听器全面测试
- **多模块协同** — lifecycle + requirements + version-mgmt + test-management + knowledge 联动

#### 文档更新
- **API 文档** — 更新至 v2.0.0，覆盖 26 个数据模型
- **部署指南** — 更新至 v2.0.0，含 HF Spaces + Docker 部署
- **CHANGELOG** — 完整记录 alpha.1 到 rc.1 所有变更

#### 统计
- **数据模型**: 36 个（含 EventStore/PhaseTransition/Requirement/TestCase 等）
- **模块**: 15+ 个（task-core/ai-engine/workflow-engine/lifecycle/requirements/knowledge 等）
- **测试文件**: 100+ 个
- **测试用例**: 1600+ 个

---

## [2.0.0-beta.2] - 2026-04-30

### ⚙️ 工作流引擎补全 — 占位步骤实现 + 项目模板 + 事件触发

#### 步骤实现
- **http-request 步骤** — 支持 GET/POST/PUT/DELETE/PATCH，自定义 headers/body/timeout
- **transform 步骤** — 支持 map/filter/reduce/pick/omit/merge/template 7 种数据转换

#### 项目工作流模板
- **6 个阶段模板** — 需求分析/项目规划/架构设计/编码实现/测试验证/部署发布
- 每个模板包含完整的步骤定义和 AI 分析节点

#### 事件触发增强
- **阶段变更自动触发** — project.phase.changed 事件自动匹配并创建工作流
- 支持 autoCreate 选项，可配置是否自动创建

#### 测试
- **70 个新测试** — http-request(16) + transform(29) + templates(25)
- **总测试数** — 1627 个测试全部通过

---

## [2.0.0-beta.1] - 2026-04-30

### 📋 需求分析模块 — 结构化需求管理

#### 新模块: requirements
- **Requirement + RequirementTag 模型** — 支持需求层级、标签、状态流转
- **10 个 Service 方法** — CRUD、状态管理、标签、分解、任务映射、统计
- **AI 规则分析器** — 复杂度分析、优先级建议、验收标准生成（无 API 调用）
- **12 个 MCP 工具** — 完整的需求管理 AI 工具集

#### 需求生命周期
- draft → reviewing → approved → implemented → verified
- 支持需求分解为子需求
- 支持需求到任务的自动映射

#### 测试
- **66 个新测试** — requirements(40) + ai-analyzer(26)
- **总测试数** — 1553 个测试全部通过

---

## [2.0.0-alpha.4] - 2026-04-30

### 🔄 项目生命周期管理器 — 阶段转换规则与审批

#### 新模块: lifecycle
- **PhaseTransition 模型** — 记录所有阶段转换历史
- **6 条转换规则** — requirements → planning → architecture → implementation → testing → deployment → completed
- **审批系统** — 关键转换需人工审批，自动转换直接完成
- **7 个 Service 方法** — 验证/请求/批准/拒绝/历史/当前阶段/可用转换

#### MCP 工具 (6 个)
- `request_phase_transition` / `approve_phase_transition` / `reject_phase_transition`
- `get_phase_validation` / `get_transition_history` / `get_available_transitions`

#### 测试
- **52 个新测试** — lifecycle(33) + phase-rules(19)
- **总测试数** — 1487 个测试全部通过

---

## [2.0.0-alpha.3] - 2026-04-30

### 🤖 AI Engine v2 — 事件驱动的主动 AI 参与者

#### AI 事件处理器框架
- **BaseAIHandler** — 抽象基类，提供 safeHandle 错误隔离和 register 自动注册
- **AIOrchestrator** — 统一管理所有 AI handler 的注册、查询和清理

#### 三个事件处理器
- **TaskCreatedHandler** — 监听 task.created，基于规则分析任务复杂度（low/medium/high）
- **TaskStatusHandler** — 监听 task.status.changed，计算项目健康度并发射 project.health.updated
- **ProjectPhaseHandler** — 监听 project.phase.changed，根据阶段转换提供 AI 建议

#### AI 引擎升级
- 空壳事件处理器替换为完整的 handler 系统
- 错误隔离：单个 handler 失败不影响其他 handler
- 规则驱动：不依赖 AI API，快速响应

#### 测试
- **36 个新测试** — handlers(28) + orchestrator(8)
- **总测试数** — 1435 个测试全部通过

---

## [2.0.0-alpha.2] - 2026-04-30

### 🔗 模块事件接入 — 激活 EventBus 中枢神经

#### Task-Core 事件
- `task.created` — 任务创建时自动发射
- `task.status.changed` — 任务状态变更（含 previousStatus）
- `task.completed` — 任务完成
- `task.blocked` — 任务阻塞
- `task.assigned` — 任务分配变更

#### Project 事件
- `project.created` — 项目创建
- `project.phase.changed` — 项目阶段变更（含 previousPhase）

#### Version-Mgmt 事件
- `release.created` — 版本创建
- `release.status.changed` — 版本状态变更（6 个生命周期点）
- `release.published` — 版本发布
- `release.rolled.back` — 版本回滚

#### Workflow-Engine 事件
- `workflow.triggered` — 工作流触发
- `workflow.completed` — 工作流完成
- `workflow.failed` — 工作流失败

#### 基础设施
- workflow-engine 注册到 modules.yaml
- 通知规则引擎扩展到 17 个事件类型
- modules.yaml app.version 同步为 2.0.0-alpha.2

#### 测试
- **25 个新测试** — task-core(8) + version-mgmt(8) + workflow-engine(9)
- **总测试数** — 1399 个测试全部通过

---

## [2.0.0-alpha.1] - 2026-04-30

### 🧠 EventBus v2 — 事件溯源 + Schema 校验（中枢神经系统基础）

#### 新增: 事件系统核心
- **EventStore 模型** — SQLite 事件持久化，支持查询和回放
- **38 个事件类型** — 覆盖 project/task/workflow/release/requirement/agent/integration/system 8 大领域
- **Zod Schema 校验** — 每个事件类型有对应的 payload Schema，发射时自动校验
- **EventStore 类** — persist/query/replay/getEventCount/cleanOldEvents 五大方法

#### EventBus 升级
- **向后兼容** — 现有 emit/on/off/once/removeAllListeners 不受影响
- **可选事件溯源** — 通过 EventBusConfig.eventStore 启用持久化
- **可选 Schema 校验** — 通过 EventBusConfig.validateEvents 启用
- **新增方法** — queryEvents/replayEvents/getEventCount
- **IEventBus 接口扩展** — 新增 3 个可选方法

#### 测试
- **48 个新测试** — event-catalog(5) + schemas(13) + event-store(10) + event-bus-v2(20)
- **总测试数** — 1375 个测试全部通过

---

## [1.9.0] - 2026-04-30

### 🎯 版本管理模块 — 全生命周期版本发布系统

#### 新模块: version-mgmt
- **5 个数据模型** — Release、ReleaseChangelog、ReleaseTag、ReleaseApproval、ReleaseMilestone
- **20 个 Service 方法** — 覆盖版本发布全生命周期
- **14 个 MCP 工具** — AI Agent 可直接调用版本管理功能

#### 版本发布流程
- **完整工作流** — draft → review → approved → published → archived / rolled_back
- **语义化版本** — 自动递增 major/minor/patch
- **审批系统** — 多角色审批（reviewer/admin/auto），支持通过/拒绝/跳过
- **里程碑管理** — Code Freeze、QA Complete、Deployed 等阶段追踪

#### 变更日志
- **11 种分类** — added、changed、fixed、deprecated、removed、security、performance、docs、refactor、test、chore
- **自动生成** — 从项目活动日志自动生成 Changelog
- **版本对比** — 两个版本之间的差异分析

#### MCP 工具 (14 个)
- `create_release` — 创建版本发布
- `get_release` / `list_releases` — 查询发布
- `update_release` / `delete_release` — 管理发布
- `publish_release` — 发布版本
- `add_changelog` — 添加变更日志
- `compare_versions` — 版本对比
- `get_next_version` — 自动计算下一版本号
- `get_release_stats` — 发布统计
- `submit_for_review` / `approve_release` — 审批流程
- `rollback_release` — 版本回滚
- `generate_changelog` — 自动生成变更日志

#### Bug 修复 (5 个已知问题)
- **P0**: Standalone MCP Server 补全 12 个 Project Lifecycle 工具注册
- **P0**: `advance_phase` 的 `previousPhase` 记录错误修复
- **P1**: `advance_phase` 添加阶段守卫逻辑（防止非法跳转）
- **P1**: JWT 默认密钥安全加固（生产环境强制配置，开发环境随机生成）
- **P1**: 统一数据库默认路径（`./prisma/dev.db` → `./data/dev.db`）

#### 文档
- **交接文档** — 详细的项目交接文档（HANDOVER_DOC.docx）
- **模块架构地图** — 8 层架构可视化 + 13 步执行路径（MODULE_MAP.html）
- **流程演示视频** — 截图小工具完整流程演示（ai-task-hub-demo.mp4）

#### 测试
- 新增 50 个版本管理模块测试
- 更新 3 个 JWT 安全测试（反映新的随机密钥行为）
- 总计: 71 文件 / 1329 测试 / 0 失败

---

## [1.8.0] - 2026-04-29

### 🚀 Phase C: 智能化 — 策略即代码 + 可观测性 + 反馈闭环

#### 策略即代码 (C-1)
- **WORKFLOW.md 解析器** — 从 Markdown 文件解析工作流定义为 CreateWorkflowDTO
- **工作流验证器** — 验证 DTO 完整性：步骤类型、重试策略、并发限制、循环引用检测

#### 工作空间隔离 (C-2)
- **IsolationLevel** — 三级隔离：none / context / full
- **WorkspaceManager** — 创建/获取/销毁隔离工作区，per-workspace 上下文隔离
- **IsolatedContextWrapper** — context 级别读写隔离，向后兼容

#### 可观测性层 (C-3)
- **内存指标存储** — stepMetrics / soloCallHistory / executionHistory（上限 10000 条）
- **查询方法** — getStepMetrics / getSOLOCallHistory / getExecutionMetrics
- **统计方法** — getWorkflowStats / getGlobalStats
- **执行生命周期** — recordExecutionStart / recordExecutionEnd

#### 并发控制器 (C-4)
- **Per-workflow 并发限制** — 每个工作流独立计数
- **优先级队列** — 0-5 优先级，高优先级先出队
- **获取超时** — 可选 timeoutMs，超时自动清理

#### 反馈驱动改进闭环 (C-5)
- **ImprovementLoop** — SOLO 自动分析反馈数据并生成优化建议
- **analyzeFeedbackPatterns** — 分析审批率/拒绝率/失败率/错误模式
- **generateRecommendations** — SOLO 驱动的 6 种改进建议类型
- **applyRecommendation** — 自动创建 FeedbackRule
- **runImprovementCycle** — 完整分析→建议→应用管线

#### 标准模块注册 (C-7)
- **WorkflowEngineModule** — 实现 Module 接口，locked=true
- 12 个服务注册到 DI 容器
- 依赖 task-core 模块

#### 可观测性前端面板 (C-6)
- **/observability 页面** — 4 统计卡片 + 3 Tab 视图
- 最近执行 / 步骤性能 / SOLO 调用历史表格
- tRPC 4 个查询过程（mock 数据）
- 侧边栏新增"可观测性"入口

---

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
  - Dockerfile.hf / start.sh / entrypoint.sh 全部适配
  - 启动时自动 prisma db push 确保表结构同步
  - 容器重启后数据不再丢失

## [1.3.1] - 2026-04-28

### 🐛 修复

- **首页添加登录入口** — 顶部"登录"按钮 + Hero区"开始使用"CTA
- **首个用户自动管理员** — 第一个注册的用户自动获得 admin 角色
- **工作流表单补全** — 创建步骤下拉添加"发送通知"类型

## [1.3.0] - 2026-04-28

### ✨ 新功能

- **Agent 工作流引擎** — 完整的工作流编排系统
  - 工作流定义 CRUD（名称、触发器、步骤、变量）
  - 顺序执行引擎（create-task/update-status/ai-analyze/wait 步骤）
  - 执行历史记录 + 步骤级别状态追踪
  - 模板变量解析（{{varName}} 语法）
  - 9 个 tRPC procedure（创建/更新/删除/执行/取消/历史查询）
  - 3 张新数据库表（Workflow/WorkflowExecution/WorkflowStepExecution）
- **工作流前端页面** — 接入真实 API，替换硬编码数据
  - 工作流列表 + 创建表单
  - 执行按钮 + 执行历史折叠面板
  - AuthGuard 保护
- **Web Push 通知** — 基础推送通知框架
  - 订阅/取消订阅 API
  - 测试通知发送
  - 内存存储（可扩展为数据库持久化）

### 🔧 优化

- **代码去重** — 统一 getPrisma() 到 src/lib/db.ts（6 个文件）
- **类型安全** — REST API v1 关键 any 类型替换为 Prisma 类型

## [1.2.0] - 2026-04-28

### ✨ 新功能

- **集成适配器数据写入** — GitHub/飞书/Notion pullTasks 现在会将外部任务写入本地数据库
  - GitHub Issues → 本地任务（含标签→优先级映射）
  - 飞书任务 → 本地任务
  - Notion Pages → 本地任务（含属性提取）
  - 每个任务独立 try/catch，错误不影响其他任务

### 🐛 修复

- **测试数据库 schema** — 添加 global-setup 自动同步 Prisma schema
  - 修复 task-core/agent-collab 测试失败（phase/projectId 列缺失）
  - 全部 224 个测试通过

## [1.1.0] - 2026-04-28

### 🔒 安全加固

- **tRPC API 权限** — 48 个 procedure 从 publicProcedure 改为 protectedProcedure/adminProcedure
  - tasks-router: 9 个 procedure 全部需要登录
  - agents-router: register/authenticate/checkPermission 保持公开，其余需要登录/管理员
  - notifications-router: 5 个 procedure 全部需要登录
  - stats-router: 4 个需要登录，systemStats 仅管理员
  - integrations-router: 查询需要登录，创建/修改/删除仅管理员
  - updater-router: 查询需要登录，热重载/启停/回滚/发布仅管理员
  - plugins-router: list/get/getCustomTools 需要登录
- **REST API 认证** — SSE/备份/导出/Webhook 端点添加 JWT 认证
  - /api/sse: 需要登录
  - /api/backup: 需要 admin 角色
  - /api/export/tasks: 需要登录
  - /api/webhook: 需要登录

### 🐛 修复

- **登录跳转** — middleware 移除服务端认证，改为客户端 AuthGuard + tRPC header 认证
- **版本号同步** — package.json/首页/modules.yaml/status API 统一为 1.1.0
- **首页内容** — 模块状态从"计划中"更新为"已实现"
- **模块配置** — modules.yaml 所有已实现模块 enabled: true
- **仪表盘统计** — activeModules/totalModules 使用实际值，uptime 使用启动时间
- **安全测试** — 更新测试断言匹配新的安全策略

## [1.0.1] - 2026-04-28

### 🐛 修复

- **登录后跳转失败** — token 存 localStorage 但 middleware 读 cookie，导致死循环重定向到 /login
  - 登录/注册成功后同时设置 cookie
  - AuthService.getUserFromRequest 支持 cookie + Bearer header 双通道
- **注册报错 "Unable to transform response"** — middleware 拦截 /api/trpc 返回非 tRPC 格式的 401
  - /api/trpc 加入 PUBLIC_PATHS（权限由 tRPC 自身的 publicProcedure/protectedProcedure 控制）

## [1.0.0] - 2026-04-28

### 🎉 首次正式发布

AI 驱动的智能任务管理平台，支持 MCP 协议和 REST API 双接口。

### ✨ 核心功能

- **任务管理** — CRUD、状态机（待办→进行中→审核→完成）、任务依赖、标签系统
- **AI 引擎** — 任务提取、智能推断、分析、自动拆解
- **MCP 服务端** — Streamable HTTP 协议，支持 Trae/Cursor/Windsurf
- **REST API v1** — 通用 HTTP 接口，任何 AI 都能接入（注册→apiKey→操作）
- **智能体协作** — Agent 注册、权限管理、操作日志
- **项目管理** — 项目全生命周期（阶段→任务→活动→摘要）
- **平台集成** — GitHub/飞书/Notion/Webhook
- **数据分析** — 实时仪表盘、统计概览
- **认证与权限** — JWT + 角色（admin/user/agent）
- **国际化** — 中/英文双语
- **插件系统** — 插件市场、动态加载
- **多租户** — Workspace + 成员管理
- **PWA** — 移动端优化、离线支持

### 🚀 部署

- **Hugging Face Spaces** — Docker 自动部署，一键上线
- **GitHub Actions** — CI/CD 自动化
- **Docker** — 完整 Dockerfile 支持

### 🐛 修复

- pnpm 10 native 模块编译（onlyBuiltDependencies 配置）
- HF Spaces iframe 嵌入（CSP frame-ancestors）
- tRPC 公开路径权限（/api/trpc middleware 拦截）
- Next.js 16 + Turbopack 兼容性（z.record、require→import）
- Prisma 7.x + better-sqlite3 适配

### 📦 技术栈

- Next.js 16 (Turbopack) + React 19
- tRPC v11 + Prisma 7 + SQLite
- Tailwind CSS 4 + shadcn/ui
- TypeScript 5.9
