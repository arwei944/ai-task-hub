# Changelog

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
