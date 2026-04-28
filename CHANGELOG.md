# Changelog

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
