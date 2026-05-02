# AI Task Hub v3.0 — 智能任务管理系统

AI 驱动的智能任务管理平台，基于 v3 内核化架构，支持 MCP 协议和 tRPC API 双接口。

## 架构概览

### 技术栈

- **Next.js 16** + Turbopack + TypeScript
- **v3 内核**: AppKernel + 7 Capability 模块
- **DI Container** + ServiceRegistry (32 typed services)
- **tRPC API** (17 routers)
- **Prisma ORM** + SQLite
- **Vitest** 测试框架

### v3 内核架构

v3 内核采用模块化 Capability 注册机制，通过 AppKernel 统一管理 7 大能力模块：

| 模块 | 职责 |
|------|------|
| **Task** | 任务管理核心 — CRUD、状态机、依赖关系、标签系统 |
| **AI** | AI 引擎 — 任务提取、智能推断、事件驱动处理器 |
| **Workflow** | 工作流引擎 — 14 种步骤类型、触发器、子工作流 |
| **Notification** | 通知系统 — 多渠道投递、规则引擎、偏好管理 |
| **Integration** | 平台集成 — GitHub / 飞书 / Notion / Webhook |
| **Agent** | 智能体协作 — 注册、权限、操作日志 |
| **Observability** | 可观测性 — 指标收集、执行追踪、健康检查 |

### DI Container + ServiceRegistry

- **依赖注入容器** — 32 个服务全类型化注册，零 `any` 泛型推断
- **ServiceRegistry** — 完整类型接口，支持服务发现和依赖解析
- **冷启动** — 322ms 内完成全部模块初始化

### V3 EventBus

- 类型安全的事件总线，支持 38+ 事件类型
- 事件 TTL 自动清理（默认 7 天）
- 事件持久化 + Schema 校验
- 死信队列 (DLQ) + 指数退避重试

## 快速开始

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 运行测试
pnpm test
```

打开 [http://localhost:3000](http://localhost:3000) 即可访问。

## 项目结构

```
src/
├── lib/
│   ├── core/
│   │   └── v3/              # v3 内核 — AppKernel, Capability, DI Container
│   ├── trpc/                # tRPC API — 17 routers
│   ├── db.ts                # Prisma 数据库客户端
│   └── modules/             # 业务模块
├── app/
│   ├── ops/                 # 运维面板 — 8 个视图
│   ├── dashboard/           # 主仪表盘
│   ├── workflows/           # 工作流管理
│   └── ...
└── prisma/
    └── schema.prisma        # 数据模型定义
```

## 运维面板

v3 内置 8 视图运维面板 (`/ops`)，提供全方位系统监控和干预能力：

| 视图 | 功能 |
|------|------|
| **总览** | 7 能力健康卡片 + 熔断器状态 + 死信队列 + 实时统计 |
| **积木拓扑** | ReactFlow 可视化模块依赖关系 |
| **联动追踪** | 事件链路追踪，支持筛选和重试 |
| **事件流** | SSE 双通道实时事件流 |
| **工作流** | 运行状态 + 步骤详情 |
| **AI 服务** | 模型状态 + 用量统计 + 延迟监控 |
| **通知系统** | 渠道状态 + 投递统计 |
| **手动干预** | DLQ 管理 + 熔断器控制 |

### 自愈系统

- **SelfHealingManager** — 30s 周期健康检查
- **熔断器** — 三态自动恢复 (Closed / Open / Half-Open)
- **死信队列** — 失败事件自动捕获和重试
- **SSE 健康推送** — 实时状态变更通知

## 统计

- **101 测试套件 / 1886 测试通过**
- **TypeScript 错误: src/ 目录 0 错误**
- **17 tRPC 路由**
- **162+ MCP 工具**
- **32 typed services**

## 许可证

MIT
