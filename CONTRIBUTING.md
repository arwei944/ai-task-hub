# 贡献指南

感谢你对 AI Task Hub 的关注！本文档将帮助你快速参与开发。

## 开发环境搭建

### 前置条件

- **Node.js** ≥ 20
- **pnpm** ≥ 10
- **Git**

### 步骤

```bash
# 1. Fork 并克隆
git clone https://github.com/<your-username>/ai-task-hub.git
cd ai-task-hub

# 2. 安装依赖
pnpm install

# 3. 初始化数据库
pnpm prisma db push

# 4. 启动开发服务器
pnpm dev
```

打开 http://localhost:3000 访问。

### 常用命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动开发服务器 (Turbopack) |
| `pnpm build` | 生产构建 |
| `pnpm start` | 启动生产服务器 |
| `pnpm test` | 运行测试 (Vitest) |
| `pnpm test:coverage` | 运行测试并生成覆盖率报告 |
| `pnpm lint` | ESLint 检查 |
| `pnpm tsc --noEmit` | TypeScript 类型检查 |
| `pnpm prisma studio` | 打开数据库可视化工具 |
| `pnpm prisma db push` | 同步数据库 Schema |

## 项目架构

AI Task Hub 采用 **v3 内核化架构**：

- **AppKernel** — 应用内核，统一管理所有能力模块
- **DI Container** — 依赖注入容器，32 个类型化服务
- **EventBus** — 事件总线，38+ 事件类型，模块间通信
- **Capability Modules** — 7 大能力模块（Task/AI/Workflow/Notification/Integration/Agent/Observability）

### 目录结构

```
src/
├── app/                    # Next.js 页面
├── lib/
│   ├── core/v3/            # 内核 (AppKernel, DI, EventBus)
│   ├── trpc/               # tRPC 路由 (17 routers)
│   └── modules/            # 业务模块
│       ├── task-core/      # 任务核心
│       ├── workflow-engine/# 工作流引擎
│       ├── ai-engine/      # AI 引擎
│       ├── notifications/  # 通知系统
│       ├── agent-collab/   # 智能体协作
│       ├── integration-*/  # 各平台集成
│       ├── plugins/        # 插件系统
│       └── mcp-server/     # MCP 工具
├── components/             # React 组件
└── prisma/                 # 数据模型
```

## 代码规范

### TypeScript

- 严格模式启用，`src/` 目录零 TypeScript 错误
- 优先使用 `interface` 而非 `type`
- 避免使用 `as any`，使用具体类型或 `unknown`
- tRPC 路由使用 Zod schema 验证输入

### 命名约定

| 类型 | 风格 | 示例 |
|------|------|------|
| 文件名 | kebab-case | `task-service.ts` |
| 组件 | PascalCase | `TaskBoard.tsx` |
| 函数/变量 | camelCase | `getUserById` |
| 常量 | UPPER_SNAKE | `MAX_RETRY_COUNT` |
| 类型/接口 | PascalCase | `TaskService` |

### Git 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/)：

```
<type>(<scope>): <description>

[optional body]
```

| 类型 | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `refactor` | 重构（不改变行为） |
| `docs` | 文档变更 |
| `test` | 测试相关 |
| `chore` | 构建/工具变更 |
| `perf` | 性能优化 |

### 分支模型

采用 GitHub Flow：

- `main` — 生产分支，始终可部署
- `phase-N/描述` — 阶段开发分支
- 每个 PR 使用 squash merge

## PR 流程

1. **Fork** 仓库并创建特性分支
2. **开发** 并确保通过所有检查：
   ```bash
   pnpm lint          # ESLint
   pnpm tsc --noEmit  # TypeScript
   pnpm test          # 测试
   ```
3. **提交** 使用 Conventional Commits 格式
4. **推送** 到你的 Fork
5. **创建 PR** 到 `arwei944/ai-task-hub` 的 `main` 分支
6. 等待 CI 通过和 Code Review

## 添加新功能

### 添加 tRPC 路由

1. 在 `src/lib/trpc/` 创建路由文件
2. 在 `src/lib/trpc/root-router.ts` 注册路由
3. 使用 Zod 定义输入 schema

### 添加 MCP 工具

1. 在 `src/lib/modules/mcp-server/tools/` 定义工具 schema 和 handler
2. 在 `src/lib/modules/mcp-server/mcp-server.module.ts` 注册
3. 同步更新 `mcp-server/index.ts`（独立 MCP Server）

### 添加新模块

1. 在 `src/lib/modules/` 创建模块目录
2. 实现 `AppModule` 接口
3. 在 `src/lib/core/v3/service-factory.ts` 注册服务
4. 在 `config/modules.yaml` 添加模块配置

## 测试

- 测试框架：Vitest
- 测试文件位于 `tests/` 目录
- 运行 `pnpm test` 执行所有测试
- 覆盖率报告：`pnpm test:coverage`

## 需要帮助？

- 提交 [Issue](https://github.com/arwei944/ai-task-hub/issues) 反馈问题或建议
- 查看 [DEPLOYMENT.md](./DEPLOYMENT.md) 了解部署细节
- 查看 [ROADMAP.md](./ROADMAP.md) 了解项目规划
