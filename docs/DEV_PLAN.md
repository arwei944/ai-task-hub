# AI Task Hub v2.0.0 — 详细开发计划

> **代号**: Project Nova
> **基线版本**: v1.9.0
> **编写日期**: 2026-04-30
> **关联文档**: [V2_ROADMAP.md](./V2_ROADMAP.md)
> **版本策略**: alpha → beta → rc → stable

---

## 总览

| 项目 | 说明 |
|------|------|
| 总阶段数 | 10 |
| 版本范围 | v2.0.0-alpha.1 ~ v2.0.0 |
| 每阶段流程 | 开发 → 测试 → 同步 → 推送 → 版本发布 → 版本管理 |
| 推送方式 | GitHub PAT（复用上次配置） |

### 阶段-版本映射

| 阶段 | 版本号 | 里程碑 | 优先级 |
|------|--------|--------|--------|
| 1 | v2.0.0-alpha.1 | M1: 中枢激活 — EventBus v2 | P0 |
| 2 | v2.0.0-alpha.2 | M1: 中枢激活 — 事件发射接入 | P0 |
| 3 | v2.0.0-alpha.3 | M2: AI 觉醒 — AI Engine v2 | P0 |
| 4 | v2.0.0-alpha.4 | M2: AI 觉醒 — 生命周期管理器 | P0 |
| 5 | v2.0.0-beta.1 | M3: 全流程贯通 — 需求分析 | P0 |
| 6 | v2.0.0-beta.2 | M3: 全流程贯通 — 工作流引擎补全 | P1 |
| 7 | v2.0.0-beta.3 | M4: 智能进化 — 知识管理 | P1 |
| 8 | v2.0.0-beta.4 | M5: 生态连接 — GitHub + 通知 | P1 |
| 9 | v2.0.0-rc.1 | M5: 生态连接 — 测试 + Agent | P1 |
| 10 | v2.0.0 | M6: 生产就绪 — 正式发布 | P0 |

### 每阶段标准流程

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  1. 开发  │───▶│  2. 测试  │───▶│  3. 同步  │───▶│  4. 推送  │───▶│  5. 发布  │───▶│  6. 管理  │
│          │    │          │    │          │    │          │    │          │    │          │
│ 编码实现  │    │ 单元测试  │    │ git add  │    │ git push │    │ git tag  │    │ 更新文档  │
│ 模块开发  │    │ 集成测试  │    │ git commit│    │          │    │ CHANGELOG│    │ 版本记录  │
│          │    │ 确认通过  │    │          │    │          │    │          │    │          │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
```

---

## 阶段 1: EventBus v2 — 事件溯源 + 事件 Schema

**版本**: v2.0.0-alpha.1
**里程碑**: M1 中枢激活（基础设施）
**优先级**: P0

### 1.1 目标

将 EventBus 从纯内存实现升级为支持事件溯源和类型安全的中枢神经系统。

### 1.2 任务清单

| # | 任务 | 文件 | 说明 |
|---|------|------|------|
| 1.1 | 创建事件 Schema 定义 | `src/lib/core/events/` | 定义所有事件的 Zod Schema 和 TypeScript 类型 |
| 1.2 | 创建事件目录常量 | `src/lib/core/events/event-catalog.ts` | 事件类型名称、描述、分类的统一目录 |
| 1.3 | 创建事件溯源存储 | `src/lib/core/events/event-store.ts` | SQLite 事件存储，支持写入和查询 |
| 1.4 | 升级 EventBus 类 | `src/lib/core/event-bus.ts` | 添加事件溯源写入、Schema 校验 |
| 1.5 | 创建事件类型导出 | `src/lib/core/events/index.ts` | 统一导出所有事件类型 |
| 1.6 | 更新 core types | `src/lib/core/types.ts` | 添加事件溯源相关接口 |
| 1.7 | 数据库迁移 | `prisma/schema.prisma` | 添加 EventStore 模型 |
| 1.8 | 编写测试 | `tests/core/events/` | 事件 Schema、EventStore、EventBus v2 测试 |

### 1.3 详细设计

#### 事件 Schema 文件结构

```
src/lib/core/events/
├── index.ts              # 统一导出
├── event-catalog.ts      # 事件目录常量
├── schemas.ts            # Zod Schema 定义
├── types.ts              # TypeScript 类型（从 Schema 推导）
└── event-store.ts        # 事件溯源存储
```

#### EventStore 数据模型

```prisma
model EventStore {
  id        String   @id @default(cuid())
  eventType String
  payload   String   // JSON
  source    String?
  timestamp DateTime @default(now())
  version   Int      @default(1)

  @@index([eventType, timestamp])
  @@index([source, timestamp])
}
```

#### EventBus v2 新增方法

```typescript
// 在现有 EventBus 基础上扩展
class EventBusV2 extends EventBus {
  // 事件溯源
  private eventStore?: EventStore;

  // 发射时自动写入事件存储
  emit(event: DomainEvent): void {
    this.validateEvent(event);    // Schema 校验
    super.emit(event);            // 原有逻辑
    this.persistEvent(event);     // 持久化
  }

  // 事件查询
  async queryEvents(filter: EventFilter): Promise<DomainEvent[]>;
  async replayEvents(eventType: string, from?: Date): Promise<void>;
}
```

### 1.4 验收标准

- [ ] 所有 30+ 事件类型有对应的 Zod Schema
- [ ] EventBus 发射事件时自动持久化到 EventStore
- [ ] 事件 Schema 校验生效，非法 payload 被拒绝
- [ ] 支持按类型、时间范围、来源查询历史事件
- [ ] 所有现有测试继续通过（向后兼容）
- [ ] 新增 40+ 测试用例覆盖新功能

### 1.5 完成后操作

```bash
# 测试
pnpm test

# 同步 & 推送
git add . && git commit -m "feat(core): EventBus v2 with event sourcing and schema validation

- Add EventStore model for event persistence
- Define 30+ event types with Zod schemas
- Upgrade EventBus with event validation and storage
- Add event query and replay capabilities
- Add 40+ tests for event system

BREAKING CHANGE: EventBus now validates event payloads against schemas"

# 版本发布
npm version 2.0.0-alpha.1
git tag v2.0.0-alpha.1
git push && git push --tags
```

---

## 阶段 2: 现有模块事件发射接入

**版本**: v2.0.0-alpha.2
**里程碑**: M1 中枢激活（模块连接）
**优先级**: P0

### 2.1 目标

让现有核心模块（task-core、project、version-mgmt）在关键操作时发射事件，激活 EventBus 中枢。

### 2.2 任务清单

| # | 任务 | 文件 | 说明 |
|---|------|------|------|
| 2.1 | task-core 事件发射 | `src/lib/modules/task-core/` | 任务创建/更新/状态变更/完成时发射事件 |
| 2.2 | project 事件发射 | `src/lib/modules/mcp-server/tools/project-handlers.ts` | 项目创建/阶段变更时发射事件 |
| 2.3 | version-mgmt 事件发射 | `src/lib/modules/version-mgmt/version-mgmt.service.ts` | 发布创建/状态变更/发布时发射事件 |
| 2.4 | workflow-engine 事件发射 | `src/lib/modules/workflow-engine/` | 工作流触发/步骤完成/完成时发射事件 |
| 2.5 | modules.yaml 注册 | `config/modules.yaml` | 注册 workflow-engine，更新 app.version |
| 2.6 | 通知规则引擎增强 | `src/lib/modules/notifications/` | 监听 project.*、task.*、release.* 事件 |
| 2.7 | 编写测试 | `tests/modules/` | 验证各模块正确发射事件 |

### 2.3 详细设计

#### task-core 事件接入

```typescript
// 在 TaskService 的关键方法中添加事件发射
async createTask(input) {
  const task = await prisma.task.create({ data: input });
  this.eventBus.emit({
    type: 'task.created',
    payload: { taskId: task.id, projectId: task.projectId, title: task.title },
    timestamp: new Date(),
    source: 'task-core',
  });
  return task;
}

async updateTaskStatus(taskId, newStatus) {
  const task = await prisma.task.update({ ... });
  this.eventBus.emit({
    type: 'task.status.changed',
    payload: { taskId, previousStatus: oldStatus, newStatus, projectId: task.projectId },
    timestamp: new Date(),
    source: 'task-core',
  });
  return task;
}
```

#### project 事件接入

```typescript
// project-handlers.ts advance_phase
async advance_phase(projectId, newPhase) {
  // ... 现有逻辑 ...
  this.eventBus.emit({
    type: 'project.phase.changed',
    payload: { projectId, previousPhase, newPhase },
    timestamp: new Date(),
    source: 'project',
  });
}
```

### 2.4 验收标准

- [ ] task-core 在 5+ 个关键操作点发射事件
- [ ] project 在创建和阶段变更时发射事件
- [ ] version-mgmt 在 4+ 个关键操作点发射事件
- [ ] workflow-engine 在触发和完成时发射事件
- [ ] workflow-engine 已在 modules.yaml 中注册
- [ ] 通知规则引擎响应新事件
- [ ] 所有现有测试继续通过
- [ ] 新增 30+ 测试用例

### 2.5 完成后操作

```bash
pnpm test
git add . && git commit -m "feat(events): connect all core modules to EventBus

- task-core emits events on create/update/status/complete
- project emits events on create/phase change
- version-mgmt emits events on release lifecycle
- workflow-engine emits events on trigger/step/complete
- Register workflow-engine in modules.yaml
- Notification rule engine listens to new events
- Add 30+ tests for event emissions"
npm version 2.0.0-alpha.2
git tag v2.0.0-alpha.2
git push && git push --tags
```

---

## 阶段 3: AI Engine v2 — 事件处理器实现

**版本**: v2.0.0-alpha.3
**里程碑**: M2 AI 觉醒
**优先级**: P0

### 3.1 目标

将 AI 引擎从被动工具升级为主动参与者，实现事件驱动的 AI 响应。

### 3.2 任务清单

| # | 任务 | 文件 | 说明 |
|---|------|------|------|
| 3.1 | AI 事件处理器框架 | `src/lib/modules/ai-engine/handlers/` | 创建事件处理器目录和基类 |
| 3.2 | task.created 处理器 | `handlers/task-created.handler.ts` | 自动分析任务复杂度，建议拆解 |
| 3.3 | task.status.changed 处理器 | `handlers/task-status.handler.ts` | 更新项目健康度，触发后续建议 |
| 3.4 | project.phase.changed 处理器 | `handlers/project-phase.handler.ts` | 阶段变更时自动生成模板/计划 |
| 3.5 | AI Orchestrator | `src/lib/modules/ai-engine/ai-orchestrator.ts` | 统一调度所有 AI 组件 |
| 3.6 | 更新 ai-engine.module.ts | `ai-engine.module.ts` | 注册所有事件处理器 |
| 3.7 | 编写测试 | `tests/modules/ai-engine/` | 验证事件处理器逻辑 |

### 3.3 详细设计

#### AI 事件处理器架构

```
src/lib/modules/ai-engine/
├── handlers/
│   ├── base.handler.ts          # 处理器基类
│   ├── task-created.handler.ts  # 任务创建响应
│   ├── task-status.handler.ts   # 任务状态变更响应
│   └── project-phase.handler.ts # 项目阶段变更响应
├── ai-orchestrator.ts           # AI 调度器
└── ai-engine.module.ts          # 模块注册（更新）
```

#### 处理器基类

```typescript
abstract class BaseAIHandler {
  constructor(
    protected eventBus: IEventBus,
    protected logger: ILogger,
  ) {}

  abstract get eventType(): string;

  abstract handle(event: DomainEvent): Promise<void>;

  // 安全执行，异常不影响其他处理器
  async safeHandle(event: DomainEvent) {
    try {
      await this.handle(event);
    } catch (error) {
      this.logger.error(`AI handler error for ${this.eventType}:`, error);
    }
  }
}
```

### 3.4 验收标准

- [ ] AI Engine 在模块启用时注册 3+ 个事件处理器
- [ ] task.created 事件触发 AI 复杂度分析
- [ ] task.status.changed 事件触发项目健康度更新
- [ ] project.phase.changed 事件触发阶段模板生成
- [ ] AI Orchestrator 统一管理所有处理器
- [ ] 处理器异常不影响其他模块
- [ ] 新增 25+ 测试用例

### 3.5 完成后操作

```bash
pnpm test
git add . && git commit -m "feat(ai): implement event-driven AI handlers

- Add BaseAIHandler with safe execution
- task.created triggers complexity analysis
- task.status.changed triggers health update
- project.phase.changed triggers template generation
- Add AI Orchestrator for unified dispatch
- Register all handlers in ai-engine module
- Add 25+ tests for AI event handlers"
npm version 2.0.0-alpha.3
git tag v2.0.0-alpha.3
git push && git push --tags
```

---

## 阶段 4: 项目生命周期管理器

**版本**: v2.0.0-alpha.4
**里程碑**: M2 AI 觉醒（流程驱动）
**优先级**: P0

### 4.1 目标

创建项目生命周期管理器，将项目阶段变更与工作流、AI、通知等模块联动。

### 4.2 任务清单

| # | 任务 | 文件 | 说明 |
|---|------|------|------|
| 4.1 | 生命周期管理器 | `src/lib/modules/lifecycle/` | 创建新模块 |
| 4.2 | 阶段转换规则 | `lifecycle/phase-rules.ts` | 定义每个阶段转换的条件和自动动作 |
| 4.3 | 阶段转换服务 | `lifecycle/lifecycle.service.ts` | 核心转换逻辑 |
| 4.4 | 生命周期模块 | `lifecycle/lifecycle.module.ts` | Module 接口实现 |
| 4.5 | MCP 工具 | `mcp-server/tools/lifecycle-tools.ts` | 生命周期相关 MCP 工具 |
| 4.6 | 数据库迁移 | `prisma/schema.prisma` | 添加 PhaseTransition 模型 |
| 4.7 | 编写测试 | `tests/modules/lifecycle/` | 验证阶段转换逻辑 |

### 4.3 详细设计

#### 阶段转换规则

```typescript
const PHASE_TRANSITIONS = {
  'requirements → planning': {
    conditions: ['至少 1 个已确认需求'],
    autoActions: ['AI 生成项目规划草案'],
    requireApproval: true,
  },
  'planning → architecture': {
    conditions: ['至少 1 个已批准规划'],
    autoActions: ['AI 生成架构设计建议'],
    requireApproval: true,
  },
  'architecture → implementation': {
    conditions: ['架构设计已批准', '任务已拆解'],
    autoActions: ['创建工作流模板', '分配任务'],
    requireApproval: true,
  },
  'implementation → testing': {
    conditions: ['所有任务已完成或跳过'],
    autoActions: ['生成测试计划', '触发测试工作流'],
    requireApproval: false,
  },
  'testing → deployment': {
    conditions: ['测试通过率 >= 80%'],
    autoActions: ['生成发布说明', '创建 Release 草稿'],
    requireApproval: true,
  },
  'deployment → completed': {
    conditions: ['部署成功'],
    autoActions: ['归档项目', '记录经验教训'],
    requireApproval: false,
  },
};
```

### 4.4 验收标准

- [ ] 生命周期管理器正确执行阶段转换
- [ ] 转换前验证前置条件
- [ ] 转换后执行自动动作
- [ ] 需要审批的转换正确请求人工确认
- [ ] 阶段转换历史记录到 PhaseTransition 表
- [ ] MCP 工具可查询和触发阶段转换
- [ ] 新增 35+ 测试用例

### 4.5 完成后操作

```bash
pnpm test
git add . && git commit -m "feat(lifecycle): project lifecycle manager with phase transitions

- Add PhaseTransition model for history tracking
- Define transition rules with conditions and auto-actions
- Implement LifecycleService with validation and approval
- Create lifecycle module with MCP tools
- Integrate with EventBus for cross-module coordination
- Add 35+ tests for lifecycle management"
npm version 2.0.0-alpha.4
git tag v2.0.0-alpha.4
git push && git push --tags
```

---

## 阶段 5: 需求分析模块

**版本**: v2.0.0-beta.1
**里程碑**: M3 全流程贯通
**优先级**: P0

### 5.1 目标

创建需求分析模块，填补"需求"阶段的空白，连接想法和任务。

### 5.2 任务清单

| # | 任务 | 文件 | 说明 |
|---|------|------|------|
| 5.1 | 数据模型 | `prisma/schema.prisma` | Requirement, RequirementTag 模型 |
| 5.2 | 需求服务 | `src/lib/modules/requirements/` | CRUD + 分析 + 拆解 + 映射 |
| 5.3 | AI 需求分析 | `requirements/ai-analyzer.ts` | AI 分析可行性、复杂度、影响范围 |
| 5.4 | 需求模块 | `requirements/requirements.module.ts` | Module 接口实现 |
| 5.5 | MCP 工具 | `mcp-server/tools/requirement-tools.ts` | 需求管理 MCP 工具 |
| 5.6 | 事件接入 | `requirements/` | 发射 requirement.* 事件 |
| 5.7 | 编写测试 | `tests/modules/requirements/` | 完整功能测试 |

### 5.3 详细设计

#### Requirement 数据模型

```prisma
model Requirement {
  id          String   @id @default(cuid())
  projectId   String
  title       String
  description String   @db.Text
  type        String   @default("feature") // feature, bug, improvement, epic
  priority    Int      @default(0)
  status      String   @default("draft")   // draft, reviewing, approved, implemented, verified
  complexity  String?  // low, medium, high, critical
  acceptance  String?  @db.Text
  source      String?
  parentReqId String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  project     Project  @relation(fields: [projectId], references: [id])
  parent      Requirement?  @relation("ReqHierarchy", fields: [parentReqId], references: [id])
  children    Requirement[] @relation("ReqHierarchy")
  tags        RequirementTag[]

  @@index([projectId, status])
}
```

### 5.4 验收标准

- [ ] 支持需求的完整 CRUD
- [ ] AI 自动分析需求复杂度和可行性
- [ ] 需求可拆解为子需求
- [ ] 需求可映射到任务（自动创建任务）
- [ ] 需求状态流转正确
- [ ] MCP 工具覆盖所有需求操作
- [ ] 事件正确发射
- [ ] 新增 40+ 测试用例

### 5.5 完成后操作

```bash
pnpm test
git add . && git commit -m "feat(requirements): requirement analysis module with AI

- Add Requirement and RequirementTag models
- Implement RequirementService with full CRUD
- AI-powered complexity and feasibility analysis
- Requirement decomposition and task mapping
- MCP tools for requirement management
- Event emissions for requirement lifecycle
- Add 40+ tests for requirements module"
npm version 2.0.0-beta.1
git tag v2.0.0-beta.1
git push && git push --tags
```

---

## 阶段 6: 工作流引擎补全 + 注册

**版本**: v2.0.0-beta.2
**里程碑**: M3 全流程贯通（工作流驱动）
**优先级**: P1

### 6.1 目标

补全工作流引擎的占位步骤，增强与项目生命周期的联动。

### 6.2 任务清单

| # | 任务 | 文件 | 说明 |
|---|------|------|------|
| 6.1 | http-request 步骤 | `workflow-engine/steps/http-request.ts` | 实现 HTTP 请求步骤 |
| 6.2 | transform 步骤 | `workflow-engine/steps/transform.ts` | 实现数据转换步骤 |
| 6.3 | 项目模板工作流 | `workflow-engine/templates/` | 为每个项目阶段创建工作流模板 |
| 6.4 | 事件触发增强 | `workflow-engine/triggers/` | 监听项目/任务事件自动触发工作流 |
| 6.5 | 工作流结果回写 | `workflow-engine/` | 工作流完成时更新项目状态 |
| 6.6 | 编写测试 | `tests/modules/workflow-engine/` | 验证新步骤和联动 |

### 6.3 验收标准

- [ ] http-request 步骤可执行 GET/POST/PUT/DELETE
- [ ] transform 步骤支持数据映射和过滤
- [ ] 项目创建时自动关联阶段工作流模板
- [ ] 阶段变更触发对应工作流
- [ ] 工作流完成可更新项目/任务状态
- [ ] 新增 30+ 测试用例

### 6.4 完成后操作

```bash
pnpm test
git add . && git commit -m "feat(workflow): complete engine with http-request, transform, and project integration

- Implement http-request step with full HTTP methods
- Implement transform step with data mapping
- Add project phase workflow templates
- Event-triggered workflow execution
- Workflow results write back to project/task state
- Add 30+ tests for workflow enhancements"
npm version 2.0.0-beta.2
git tag v2.0.0-beta.2
git push && git push --tags
```

---

## 阶段 7: 知识管理模块

**版本**: v2.0.0-beta.3
**里程碑**: M4 智能进化
**优先级**: P1

### 7.1 目标

构建项目知识库，让 AI 从历史经验中学习，持续优化建议质量。

### 7.2 任务清单

| # | 任务 | 文件 | 说明 |
|---|------|------|------|
| 7.1 | 数据模型 | `prisma/schema.prisma` | KnowledgeEntry 模型 |
| 7.2 | 知识服务 | `src/lib/modules/knowledge/` | CRUD + 搜索 + 关联 |
| 7.3 | AI 知识提取 | `knowledge/ai-extractor.ts` | 从项目完成事件中自动提取经验 |
| 7.4 | 知识模块 | `knowledge/knowledge.module.ts` | Module 接口实现 |
| 7.5 | MCP 工具 | `mcp-server/tools/knowledge-tools.ts` | 知识管理 MCP 工具 |
| 7.6 | 编写测试 | `tests/modules/knowledge/` | 完整功能测试 |

### 7.3 验收标准

- [ ] 支持知识条目的 CRUD
- [ ] 项目完成时自动生成经验教训
- [ ] 支持按标签、类型、项目搜索知识
- [ ] AI 可引用知识库提供建议
- [ ] MCP 工具覆盖所有知识操作
- [ ] 新增 30+ 测试用例

### 7.4 完成后操作

```bash
pnpm test
git add . && git commit -m "feat(knowledge): knowledge base module with AI-powered extraction

- Add KnowledgeEntry model
- Implement KnowledgeService with CRUD and search
- AI auto-extracts lessons from completed projects
- Knowledge-aware AI suggestions
- MCP tools for knowledge management
- Add 30+ tests for knowledge module"
npm version 2.0.0-beta.3
git tag v2.0.0-beta.3
git push && git push --tags
```

---

## 阶段 8: GitHub 集成 v2 + 通知增强

**版本**: v2.0.0-beta.4
**里程碑**: M5 生态连接
**优先级**: P1

### 8.1 目标

将 GitHub 集成从日志记录器升级为双向桥梁，增强通知系统的事件覆盖。

### 8.2 任务清单

| # | 任务 | 文件 | 说明 |
|---|------|------|------|
| 8.1 | GitHub webhook 处理 | `integration-github/github.adapter.ts` | 处理 push/pr/issue 事件 |
| 8.2 | GitHub 事件转系统事件 | `integration-github/` | GitHub webhook → EventBus 事件 |
| 8.3 | 通知规则扩展 | `notifications/` | 添加 release.*、workflow.*、requirement.* 规则 |
| 8.4 | 通知模板 | `notifications/templates/` | 各类事件的通知模板 |
| 8.5 | 编写测试 | `tests/modules/integration-github/` | 验证 webhook 处理 |

### 8.3 验收标准

- [ ] GitHub push 事件触发内部系统事件
- [ ] GitHub PR 创建/合并触发工作流
- [ ] GitHub Issue 创建同步为任务
- [ ] 通知规则覆盖所有新事件类型
- [ ] 通知模板格式化正确
- [ ] 新增 25+ 测试用例

### 8.4 完成后操作

```bash
pnpm test
git add . && git commit -m "feat(integration): GitHub v2 webhook processing and notification enhancement

- Process GitHub push/PR/issue webhooks
- Bridge GitHub events to internal EventBus
- Extend notification rules for all event types
- Add notification templates for new events
- Add 25+ tests for GitHub integration"
npm version 2.0.0-beta.4
git tag v2.0.0-beta.4
git push && git push --tags
```

---

## 阶段 9: 测试管理 + Agent 协作 v2

**版本**: v2.0.0-rc.1
**里程碑**: M5 生态连接（质量保证）
**优先级**: P1

### 9.1 目标

创建测试管理模块，增强 Agent 协作的角色和能力系统。

### 9.2 任务清单

| # | 任务 | 文件 | 说明 |
|---|------|------|------|
| 9.1 | 测试数据模型 | `prisma/schema.prisma` | TestCase, TestExecution, TestSuite |
| 9.2 | 测试服务 | `src/lib/modules/test-management/` | 测试用例/执行/套件管理 |
| 9.3 | AI 测试生成 | `test-management/ai-generator.ts` | AI 自动生成测试用例 |
| 9.4 | Agent 角色系统 | `agent-collab/roles.ts` | 定义 Agent 角色（PM/开发/测试/运维） |
| 9.5 | Agent 能力声明 | `agent-collab/capabilities.ts` | Agent 声明能力范围 |
| 9.6 | MCP 工具 | `mcp-server/tools/` | 测试管理和 Agent 角色工具 |
| 9.7 | 编写测试 | `tests/modules/` | 完整功能测试 |

### 9.3 验收标准

- [ ] 测试用例 CRUD 完整
- [ ] AI 可根据需求自动生成测试用例
- [ ] 测试执行结果与任务关联
- [ ] Agent 角色定义清晰
- [ ] Agent 可声明和查询能力
- [ ] 新增 35+ 测试用例

### 9.4 完成后操作

```bash
pnpm test
git add . && git commit -m "feat(testing,agents): test management module and agent roles v2

- Add TestCase, TestExecution, TestSuite models
- AI-powered test case generation
- Agent role system (PM/Dev/Test/Ops)
- Agent capability declaration and discovery
- MCP tools for test management and agent roles
- Add 35+ tests"
npm version 2.0.0-rc.1
git tag v2.0.0-rc.1
git push && git push --tags
```

---

## 阶段 10: 集成测试 + 性能优化 + v2.0.0 正式发布

**版本**: v2.0.0
**里程碑**: M6 生产就绪
**优先级**: P0

### 10.1 目标

全面集成测试、性能优化、文档更新，发布 v2.0.0 正式版。

### 10.2 任务清单

| # | 任务 | 文件 | 说明 |
|---|------|------|------|
| 10.1 | 端到端集成测试 | `tests/integration/` | 全流程贯通测试 |
| 10.2 | 性能基准测试 | `tests/performance/` | EventBus 吞吐量、事件处理延迟 |
| 10.3 | 修复所有已知问题 | 全项目 | 修复测试中发现的问题 |
| 10.4 | 文档更新 | `docs/` | API.md, DEPLOYMENT.md, README.md |
| 10.5 | CHANGELOG 更新 | `CHANGELOG.md` | v2.0.0 完整变更日志 |
| 10.6 | 版本号更新 | 多文件 | 所有版本号更新为 2.0.0 |
| 10.7 | modules.yaml 同步 | `config/modules.yaml` | app.version = 2.0.0 |
| 10.8 | 最终验证 | - | 全量测试通过 |

### 10.3 验收标准

- [ ] 所有 1500+ 测试通过
- [ ] 端到端流程（需求→任务→测试→发布）可走通
- [ ] EventBus 事件处理延迟 P99 < 100ms
- [ ] 所有文档更新到 v2.0.0
- [ ] CHANGELOG 包含所有变更
- [ ] 零已知 P0/P1 问题

### 10.4 完成后操作

```bash
# 最终测试
pnpm test

# 同步 & 推送
git add . && git commit -m "release: v2.0.0 - AI-native full-lifecycle development platform

Major changes:
- EventBus v2 with event sourcing and schema validation
- AI Engine v2 with event-driven handlers
- Project lifecycle manager with phase transitions
- Requirement analysis module with AI
- Knowledge base module
- Test management module
- Agent collaboration v2 with roles
- GitHub integration v2 with webhook processing
- Workflow engine completion (http-request, transform)
- Notification system enhancement

BREAKING CHANGE: EventBus now validates event payloads.
See CHANGELOG.md for full details."

# 正式版本
npm version 2.0.0
git tag v2.0.0
git push && git push --tags
```

---

## 附录

### A. 文件变更总览

| 阶段 | 新增文件 | 修改文件 | 新增模型 | 新增测试 |
|------|---------|---------|---------|---------|
| 1 | 6 | 3 | 1 | 40+ |
| 2 | 2 | 6 | 0 | 30+ |
| 3 | 5 | 1 | 0 | 25+ |
| 4 | 5 | 2 | 1 | 35+ |
| 5 | 5 | 3 | 2 | 40+ |
| 6 | 4 | 3 | 0 | 30+ |
| 7 | 4 | 2 | 1 | 30+ |
| 8 | 3 | 4 | 0 | 25+ |
| 9 | 6 | 3 | 3 | 35+ |
| 10 | 3 | 8 | 0 | 20+ |
| **合计** | **43** | **35** | **8** | **310+** |

### B. 新增模块清单

| 模块 | 阶段 | 依赖 |
|------|------|------|
| events (core) | 1 | 无 |
| lifecycle | 4 | task-core, events |
| requirements | 5 | task-core, ai-engine, events |
| knowledge | 7 | events |
| test-management | 9 | task-core, ai-engine, events |

### C. 风险缓解

| 风险 | 缓解措施 |
|------|---------|
| EventBus 重构破坏现有功能 | 保持向后兼容，新功能通过扩展方法添加 |
| AI 事件处理器影响性能 | 异步处理 + 超时控制 + 错误隔离 |
| 数据库迁移失败 | 每阶段独立迁移，支持回滚 |
| 测试覆盖不足 | 每阶段强制 25+ 新测试 |
| GitHub PAT 过期 | 每阶段开始前验证推送能力 |
