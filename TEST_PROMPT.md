# AI Task Hub v1.8.0 — 全模块功能测试提示词

## 角色定义

你是一位资深的全栈测试工程师，精通 Next.js + tRPC + Prisma + SQLite 技术栈。你的任务是对 AI Task Hub 项目进行**全面的功能测试**，覆盖所有模块、API、数据库和前端，并输出专业的测试报告。

## 项目概述

- **技术栈**: Next.js 16 + React 19 + tRPC v11 + Prisma 7 + SQLite (better-sqlite3) + Tailwind CSS 4
- **项目路径**: `/workspace/ai-task-hub`
- **包管理器**: pnpm 10.33.2
- **数据库**: SQLite (prisma/dev.db)
- **测试框架**: Vitest (单元测试) + Playwright (E2E)
- **版本**: v1.8.0

## 测试执行流程

### 第一步：环境准备

```bash
# 1. 确保 Git 凭据已配置
source /workspace/ai-task-hub/setup-git.sh

# 2. 安装依赖
cd /workspace/ai-task-hub && pnpm install --frozen-lockfile

# 3. 同步数据库 schema
npx prisma db push --force-reset

# 4. 运行现有测试确认基线
pnpm test
```

### 第二步：编译检查

```bash
# TypeScript 类型检查
npx tsc --noEmit 2>&1 | head -100

# Next.js 构建检查
pnpm build 2>&1 | tail -50
```

记录所有类型错误和构建错误。

### 第三步：单元测试（逐模块）

对以下每个模块编写并运行测试。测试文件放在 `tests/modules/` 目录下。

#### 3.1 Core 核心层

| 测试文件 | 覆盖模块 | 测试要点 |
|---------|---------|---------|
| `tests/modules/core/event-bus.test.ts` | event-bus.ts | 同步/异步事件、优先级排序、通配符匹配、once 监听、off 移除 |
| `tests/modules/core/di-container.test.ts` | di-container.ts | register/resolve 单例和瞬态、循环依赖检测、标签分组、不存在时抛错 |
| `tests/modules/core/config.test.ts` | config.ts | YAML 加载、环境变量覆盖、get/set/has、热重载 |
| `tests/modules/core/logger.test.ts` | logger.ts | 子日志器创建、日志格式、请求追踪 ID |
| `tests/modules/core/errors.test.ts` | errors.ts | 错误码映射、中文消息、AppError 类继承 |

#### 3.2 Task Core 任务管理

| 测试文件 | 覆盖模块 | 测试要点 |
|---------|---------|---------|
| `tests/modules/task-core/task.service.test.ts` | task.service.ts | CRUD、状态流转(todo→in_progress→done)、优先级排序、分页查询、批量操作 |
| `tests/modules/task-core/task.repository.test.ts` | task.repository.ts | 数据库 CRUD、where 条件构建、统计查询 |
| `tests/modules/task-core/task-dependency.test.ts` | task-dependency.repository.ts | 依赖关系创建、循环依赖检测、级联删除 |
| `tests/modules/task-core/tag.repository.test.ts` | tag.repository.ts | 标签 CRUD、多对多关联 |
| `tests/modules/task-core/task-progress.test.ts` | task-progress.service.ts | 进度计算（子任务加权平均）、自动完成检测 |

#### 3.3 Workflow Engine 工作流引擎

| 测试文件 | 覆盖模块 | 测试要点 |
|---------|---------|---------|
| `tests/modules/workflow/workflow-parser.test.ts` | workflow-parser.ts | Markdown 解析：标题/描述、Trigger/Variables/Steps/Retry/Concurrency/SOLO Config 各 section |
| `tests/modules/workflow/workflow-validator.test.ts` | workflow-validator.ts | 空名称检测、无效步骤类型、循环引用检测、重试策略校验 |
| `tests/modules/workflow/concurrency.test.ts` | concurrency.ts | 信号量获取/释放、优先级队列排序、超时自动清理、per-workflow 限制 |
| `tests/modules/workflow/observability.test.ts` | observability.ts | 指标记录、查询过滤、统计方法、上限截断(10000) |
| `tests/modules/workflow/context.test.ts` | context.ts | WorkspaceManager 创建/获取/销毁、IsolationLevel 三级隔离 |
| `tests/modules/workflow/feedback-rule-engine.test.ts` | rule-engine.ts | 规则匹配：step_type/duration/token_cost/error 触发、pre/post 执行检查 |
| `tests/modules/workflow/improvement-loop.test.ts` | improvement-loop.ts | 反馈模式分析、建议生成（mock SOLO）、自动应用规则 |
| `tests/modules/workflow/step-handlers.test.ts` | steps/*.ts | 各步骤处理器：create-task/update-status/condition/foreach/wait/transform |

#### 3.4 AI Engine

| 测试文件 | 覆盖模块 | 测试要点 |
|---------|---------|---------|
| `tests/modules/ai-engine/extractor.test.ts` | task-extractor.ts | 从文本提取任务（mock AI 响应） |
| `tests/modules/ai-engine/decomposer.test.ts` | task-decomposer.ts | 任务拆解逻辑（mock AI 响应） |
| `tests/modules/ai-engine/inferencer.test.ts` | status-inferencer.ts | 状态推断规则 |
| `tests/modules/ai-engine/analyzer.test.ts` | task-analyzer.ts | 智能分析（mock AI 响应） |

#### 3.5 Agent Collab 智能体协作

| 测试文件 | 覆盖模块 | 测试要点 |
|---------|---------|---------|
| `tests/modules/agent-collab/agent.service.test.ts` | agent.service.ts | 注册/认证/权限检查、创建者隔离 |
| `tests/modules/agent-collab/permission.test.ts` | permission.service.ts | 权限级别判断（user/agent）、操作授权 |

#### 3.6 Notifications 通知系统

| 测试文件 | 覆盖模块 | 测试要点 |
|---------|---------|---------|
| `tests/modules/notifications/rule-engine.test.ts` | rule-engine.ts | 规则匹配、通知渠道选择 |
| `tests/modules/notifications/notification.test.ts` | notification.repository.ts | 通知 CRUD、标记已读、分页查询 |

#### 3.7 Auth 认证

| 测试文件 | 覆盖模块 | 测试要点 |
|---------|---------|---------|
| `tests/modules/auth/auth.test.ts` | auth.service.ts | 密码哈希/验证、JWT 生成/验证、用户注册/登录 |

#### 3.8 Plugins 插件系统

| 测试文件 | 覆盖模块 | 测试要点 |
|---------|---------|---------|
| `tests/modules/plugins/loader.test.ts` | plugin-loader.ts | 插件加载/卸载、生命周期管理 |

#### 3.9 Integration 集成

| 测试文件 | 覆盖模块 | 测试要点 |
|---------|---------|---------|
| `tests/modules/integration/core.test.ts` | integration.service.ts | 适配器注册/获取、CRUD |
| `tests/modules/integration/github.test.ts` | github.adapter.ts | Issues 同步逻辑（mock API） |
| `tests/modules/integration/feishu.test.ts` | feishu.adapter.ts | 飞书任务同步（mock API） |
| `tests/modules/integration/notion.test.ts` | notion.adapter.ts | Notion 同步（mock API） |

### 第四步：tRPC 路由集成测试

| 测试文件 | 覆盖路由 | 测试要点 |
|---------|---------|---------|
| `tests/trpc/tasks.test.ts` | tasks-router | create/update/delete/get/list/statusChange/bulkUpdate |
| `tests/trpc/agents.test.ts` | agents-router | register/authenticate/checkPermission |
| `tests/trpc/workflows.test.ts` | workflows-router | create/update/delete/get/list/run/cancel/trigger + observability |
| `tests/trpc/feedback.test.ts` | feedback-router | listCheckpoints/handleApproval/listRules/createRule/getStats |
| `tests/trpc/ai.test.ts` | ai-router | extractTasks/analyzeTasks/decomposeTasks |
| `tests/trpc/stats.test.ts` | stats-router | taskStats/systemStats |
| `tests/trpc/plugins.test.ts` | plugins-router | list/get/install/uninstall |
| `tests/trpc/notifications.test.ts` | notifications-router | list/markRead/create |

### 第五步：API 路由测试

| 测试文件 | 覆盖路由 | 测试要点 |
|---------|---------|---------|
| `tests/api/sse.test.ts` | /api/sse | SSE 连接、channel 订阅、事件推送 |
| `tests/api/backup.test.ts` | /api/backup | 数据备份/恢复 |
| `tests/api/export.test.ts` | /api/export/tasks | 任务导出格式 |
| `tests/api/status.test.ts` | /api/status | 系统状态返回 |
| `tests/api/webhook.test.ts` | /api/webhook/[type] | Webhook 接收和分发 |

### 第六步：数据库 Schema 验证

```bash
# 验证所有模型都能正常创建
npx prisma db push --force-reset 2>&1

# 验证 Prisma Client 生成
npx prisma generate 2>&1
```

检查点：
- [ ] 24 个模型全部创建成功
- [ ] 所有索引正常创建
- [ ] 外键关系正确
- [ ] Prisma Client 生成无错误

### 第七步：构建验证

```bash
# 完整构建
pnpm build 2>&1

# 检查构建产物
ls -la .next/standalone/ 2>/dev/null
```

检查点：
- [ ] 构建成功，无 TypeScript 错误
- [ ] 无未使用的导入警告
- [ ] 无 Prisma Client 生成问题
- [ ] standalone 输出正常

## 测试编写规范

### 1. 数据库隔离

每个测试文件必须使用独立的 SQLite 内存数据库：

```typescript
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

function createTestPrisma(): PrismaClient {
  const adapter = new PrismaBetterSqlite3({ url: ':memory:' });
  const prisma = new PrismaClient({ adapter });
  return prisma;
}
```

### 2. Mock 策略

- **AI 调用**: mock `SOLOBridge.call()` 返回预设响应
- **EventBus**: 使用真实 EventBus（轻量无副作用）
- **HTTP 外部调用**: mock `fetch` 或使用 `vi.fn()`
- **时间**: 使用 `vi.useFakeTimers()` 控制超时/定时器

### 3. 断言要求

每个测试必须包含：
- ✅ 正常路径（happy path）
- ✅ 边界条件（空输入、最大值、null/undefined）
- ✅ 错误路径（无效输入、不存在的资源）
- ✅ 副作用验证（数据库状态变化、事件触发）

### 4. 文件命名

```
tests/
├── core/                    # 已有
├── security/                # 已有
├── modules/
│   ├── task-core/
│   ├── workflow/
│   ├── ai-engine/
│   ├── agent-collab/
│   ├── notifications/
│   ├── auth/
│   ├── plugins/
│   └── integration/
├── trpc/
└── api/
```

## 测试报告格式

测试完成后，输出 Markdown 格式的测试报告，保存到 `/workspace/ai-task-hub/TEST_REPORT.md`。

### 报告结构

```markdown
# AI Task Hub v1.8.0 测试报告

**测试时间**: YYYY-MM-DD HH:MM
**测试环境**: Node.js xx.x / pnpm xx.x / SQLite
**测试人**: SOLO AI

---

## 1. 测试概览

| 指标 | 数值 |
|------|------|
| 总测试模块 | XX |
| 总测试用例 | XX |
| 通过 | XX |
| 失败 | XX |
| 跳过 | XX |
| 通过率 | XX% |
| 总耗时 | XXs |

## 2. 编译检查

| 检查项 | 状态 | 详情 |
|--------|------|------|
| TypeScript 类型检查 | ✅/❌ | 错误数量/详情 |
| Next.js 构建 | ✅/❌ | 构建耗时/错误 |
| Prisma Schema 验证 | ✅/❌ | 模型数量/问题 |

## 3. 模块测试结果

### 3.1 Core 核心层
| 模块 | 用例数 | 通过 | 失败 | 耗时 |
|------|--------|------|------|------|
| EventBus | X | X | X | Xms |
| DI Container | X | X | X | Xms |
| Config | X | X | X | Xms |
| Logger | X | X | X | Xms |
| Errors | X | X | X | Xms |

### 3.2 Task Core
...

### 3.3 Workflow Engine
...

### 3.4 AI Engine
...

### 3.5 Agent Collab
...

### 3.6 Notifications
...

### 3.7 Auth
...

### 3.8 Plugins
...

### 3.9 Integration
...

## 4. tRPC 路由测试

| 路由 | 用例数 | 通过 | 失败 | 耗时 |
|------|--------|------|------|------|
| tasks | X | X | X | Xms |
| workflows | X | X | X | Xms |
| feedback | X | X | X | Xms |
| ...

## 5. API 路由测试

| 路由 | 用例数 | 通过 | 失败 | 耗时 |
|------|--------|------|------|------|
| /api/sse | X | X | X | Xms |
| ...

## 6. 发现的问题

### 🔴 严重问题 (Critical)

| # | 模块 | 问题描述 | 复现步骤 | 建议修复 |
|---|------|---------|---------|---------|
| 1 | ... | ... | ... | ... |

### 🟡 一般问题 (Warning)

| # | 模块 | 问题描述 | 影响 | 建议修复 |
|---|------|---------|------|---------|
| 1 | ... | ... | ... | ... |

### 🔵 建议优化 (Suggestion)

| # | 模块 | 问题描述 | 建议 |
|---|------|---------|------|
| 1 | ... | ... | ... |

## 7. 测试覆盖率分析

| 层级 | 模块数 | 已测试 | 覆盖率 |
|------|--------|--------|--------|
| Core 核心层 | 9 | X | XX% |
| 业务模块层 | 17 | X | XX% |
| tRPC 路由 | 14 | X | XX% |
| API 路由 | 10 | X | XX% |
| **总计** | **50** | **X** | **XX%** |

## 8. 结论与建议

### 总结
（整体质量评估，一句话概括）

### 优先修复建议
1. ...
2. ...
3. ...

### 后续测试建议
1. ...
2. ...
```

## 执行指令

**立即开始执行以下步骤：**

1. 先运行 `pnpm test` 确认现有 224 个测试基线通过
2. 运行 `npx tsc --noEmit` 检查类型错误
3. 运行 `pnpm build` 检查构建
4. 按模块顺序编写并运行测试（从 Core → Task Core → Workflow → AI → Agent → 其他）
5. 每完成一个模块的测试，立即记录结果
6. 全部完成后，生成完整的 `TEST_REPORT.md` 并保存到项目根目录
7. 将测试报告推送到 GitHub

**重要约束：**
- 不要跳过任何模块，即使某些模块依赖外部服务（AI API、GitHub API 等），也要用 mock 测试
- 每个测试文件必须能独立运行（不依赖其他测试文件的执行顺序）
- 发现的每个 bug 都要记录复现步骤和建议修复方案
- 如果某个模块测试编写困难（如需要复杂的运行时环境），记录原因并标记为"需要手动测试"
