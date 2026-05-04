# 🧠 AI Task Hub

> AI 驱动的智能任务管理平台 — 让 AI Agent 成为你团队的任务协作伙伴

[在线体验](https://arwei944-ai-task-hub.hf.space) · [静态演示](./demo.html) · [部署文档](./DEPLOYMENT.md) · [贡献指南](./CONTRIBUTING.md)

AI Task Hub 是一个开源的智能任务管理平台，通过 MCP (Model Context Protocol) 协议与 AI Agent 深度集成。它不是又一个 Todo 应用——而是一个让 AI Agent 能够创建、分解、执行和追踪任务的协作平台。

## ✨ 核心特性

- **📋 任务管理** — CRUD、状态机、依赖关系、标签系统、优先级排序
- **🤖 AI 引擎** — 自然语言任务提取、智能推断、自动拆解、NL 查询
- **🔄 工作流引擎** — 14 种步骤类型、触发器、子工作流、断点恢复
- **🤝 智能体协作** — Agent 注册、权限管理、操作审计日志
- **🔗 平台集成** — GitHub / 飞书 / Notion / Telegram / Webhook
- **📊 数据仪表盘** — 全局统计、趋势分析、实时监控
- **🔔 通知系统** — 多渠道投递（系统/Web Push/Email/Telegram/企业微信）、规则引擎
- **🔌 MCP 服务端** — 162+ 工具，Streamable HTTP 协议
- **🔌 插件系统** — 可扩展架构，8 种插件能力
- **🛡️ 自愈系统** — 熔断器、死信队列、30s 周期健康检查

## 🖥️ 界面预览

> 📸 截图待补充 — 运行项目后访问各页面截图

| 页面 | 路径 | 说明 |
|------|------|------|
| 项目总览 | `/project-hub` | 项目列表、模板、时间线 |
| 任务看板 | `/project-hub/[id]/tasks` | 看板/列表视图、拖拽排序 |
| 工作流管理 | `/workflows` | 可视化工作流编辑器 |
| 运维面板 | `/ops` | 8 视图实时监控 |
| 仪表盘 | `/dashboard` | 全局数据统计 |

## 🚀 快速开始

### 前置条件

- **Node.js** ≥ 20
- **pnpm** ≥ 10 (`npm install -g pnpm`)
- **Git**

### 方式一：本地开发

```bash
# 1. 克隆仓库
git clone https://github.com/arwei944/ai-task-hub.git
cd ai-task-hub

# 2. 安装依赖
pnpm install

# 3. 初始化数据库
pnpm prisma db push

# 4. 启动开发服务器
pnpm dev
```

打开 [http://localhost:3000](http://localhost:3000) 即可访问。首次启动会自动创建管理员账户。

### 方式二：Docker 一键启动

```bash
# 1. 克隆仓库
git clone https://github.com/arwei944/ai-task-hub.git
cd ai-task-hub

# 2. Docker Compose 启动
docker compose up -d
```

打开 [http://localhost:7860](http://localhost:7860) 即可访问。

### 方式三：在线体验

直接访问 [HuggingFace Spaces 在线演示](https://arwei944-ai-task-hub.hf.space)，无需安装任何依赖。

> 💡 还有一个 [静态 HTML 演示](./demo.html) 展示 UI 设计，无需后端即可浏览。

## 🏗️ 技术架构

### 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 16 + React 19 + TypeScript |
| API | tRPC v11 (17 routers) + MCP (162+ tools) |
| 数据库 | Prisma 7 + SQLite |
| 样式 | Tailwind CSS v4 |
| 测试 | Vitest |
| 部署 | Docker / HuggingFace Spaces |

### v3 内核架构

```
┌─────────────────────────────────────────────┐
│                  AppKernel                   │
├─────────────────────────────────────────────┤
│  Task  │  AI   │ Workflow │ Notification    │
│  Core  │ Engine│ Engine  │ System          │
├─────────────────────────────────────────────┤
│ Integration │ Agent │ Observability │ Plugin │
├─────────────────────────────────────────────┤
│            DI Container (32 services)        │
├─────────────────────────────────────────────┤
│         EventBus (38+ event types)           │
├─────────────────────────────────────────────┤
│         Prisma ORM + SQLite                  │
└─────────────────────────────────────────────┘
```

### 项目结构

```
src/
├── app/                    # Next.js App Router (19 pages)
│   ├── api/                # API Routes (MCP, SSE, Webhook, REST)
│   ├── project-hub/        # 项目管理 (含子页面)
│   ├── ops/                # 运维面板 (8 views)
│   ├── dashboard/          # 仪表盘
│   └── workflows/          # 工作流管理
├── lib/
│   ├── core/v3/            # v3 内核 (AppKernel, DI, EventBus)
│   ├── trpc/               # tRPC API (17 routers)
│   └── modules/            # 业务模块 (12 modules)
├── components/             # React 组件
└── prisma/                 # 数据模型 (36+ models)
```

## 📊 项目统计

| 指标 | 数值 |
|------|------|
| MCP 工具 | 162+ |
| tRPC 路由 | 17 |
| Prisma 模型 | 36+ |
| 测试用例 | 1875+ |
| 前端页面 | 19 |
| 工作流步骤类型 | 14 |
| 通知渠道 | 5 |
| 注册服务 | 32 |

## 🔗 相关链接

- [在线体验](https://arwei944-ai-task-hub.hf.space)
- [部署文档](./DEPLOYMENT.md)
- [贡献指南](./CONTRIBUTING.md)
- [路线图](./ROADMAP.md)
- [更新日志](./CHANGELOG.md)

## 📄 许可证

[MIT](./LICENSE) © 2026 arwei944
