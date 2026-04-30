# AI Task Hub v2.0.0 — 重大版本变迁规划书

> **代号**: Project Nova
> **基线版本**: v1.9.0
> **目标版本**: v2.0.0
> **编写日期**: 2026-04-30
> **文档性质**: 架构重设计 + 全流程产品愿景 + 实施路线图

---

## 目录

1. [执行摘要](#1-执行摘要)
2. [现状分析：v1.9.0 全景扫描](#2-现状分析v199-全景扫描)
3. [行业洞察：AI 时代的软件开发范式](#3-行业洞察ai-时代的软件开发范式)
4. [核心问题诊断](#4-核心问题诊断)
5. [v2.0.0 产品愿景](#5-v200-产品愿景)
6. [架构重设计](#6-架构重设计)
7. [模块详细规划](#7-模块详细规划)
8. [人机协作模型](#8-人机协作模型)
9. [数据架构演进](#9-数据架构演进)
10. [安全与合规](#10-安全与合规)
11. [迁移策略](#11-迁移策略)
12. [实施路线图](#12-实施路线图)
13. [成功指标](#13-成功指标)
14. [风险与缓解](#14-风险与缓解)
15. [附录](#15-附录)

---

## 1. 执行摘要

### 1.1 为什么要做 v2.0.0？

AI Task Hub 在 72 小时内从 v1.0.0 迭代到 v1.9.0，完成了 19 个模块、30 个数据模型、1329 个测试用例的构建。然而，快速迭代带来了一个根本性问题：**系统是一个功能集合，而非一个有机整体**。

当前系统存在六大断裂：

| # | 断裂点 | 影响 |
|---|--------|------|
| 1 | AI 引擎事件处理器为空壳 | AI 能力无法被系统自动触发 |
| 2 | EventBus 几乎未被使用 | 模块间零协作，各自为战 |
| 3 | 工作流引擎与项目生命周期脱节 | 工作流无法驱动项目推进 |
| 4 | GitHub 集成仅记录日志 | 外部事件无法触发内部流程 |
| 5 | 版本管理零事件发射 | 发布流程无法联动其他模块 |
| 6 | 通知规则引擎不监听关键事件 | 用户无法感知系统变化 |

### 1.2 v2.0.0 的核心目标

**将 AI Task Hub 从"AI 辅助的项目管理工具"升级为"AI 原生的全流程开发协作平台"**。

具体来说：

- **全流程覆盖**: 从需求分析 → 架构设计 → 编码实现 → 测试验证 → 版本发布 → 运维监控，每个阶段都有 AI 深度参与
- **事件驱动**: EventBus 作为中枢神经系统，连接所有模块，实现真正的模块协作
- **人机共生**: 人类做决策，AI 做执行；人类设目标，AI 做规划；人类做审核，AI 做优化
- **智能自适应**: 系统通过学习用户习惯和项目模式，持续优化工作流和建议

### 1.3 一句话愿景

> **让 AI 成为每个开发者的全天候搭档，让项目管理从"跟踪进度"进化为"驱动进步"。**

---

## 2. 现状分析：v1.9.0 全景扫描

### 2.1 技术栈概览

| 层级 | 技术选型 | 版本 |
|------|---------|------|
| 框架 | Next.js (Turbopack) | 16.2.4 |
| 前端 | React + Tailwind + shadcn/ui | 19.2.4 / v4 / v4.5.0 |
| API | tRPC + TanStack React Query | v11 / v5 |
| 数据库 | Prisma + SQLite (better-sqlite3) | 7.8.0 / 12.9.0 |
| AI | Vercel AI SDK + OpenAI | 6.0.168 / gpt-4o |
| MCP | @modelcontextprotocol/sdk | 1.29.0 |
| 认证 | jose (JWT) + bcryptjs | 6.2.3 |
| 校验 | Zod | 4.3.6 |
| 测试 | Vitest + Playwright | 4.1.5 / 1.59.1 |

### 2.2 模块全景（19 个模块）

```
src/lib/modules/
├── task-core/          # 🔒 核心任务管理（CRUD、状态机、依赖、标签）
├── ai-engine/          # AI 任务提取/推断/拆解/分析
├── agent-collab/       # 智能体注册、权限、操作日志
├── auth/               # 认证服务（JWT）
├── dashboard/          # 仪表盘统计
├── mcp-server/         # MCP 服务端（Streamable HTTP）
├── notifications/      # 通知系统（多渠道 + 规则引擎）
├── plugins/            # 插件加载系统
├── realtime/           # 实时通信（SSE + EventBridge）
├── module-updater/     # 模块热更新
├── workflow-engine/    # 🔒 SOLO 驱动工作流引擎
├── version-mgmt/       # 版本发布管理
├── integration-core/   # 集成核心抽象层
├── integration-github/ # GitHub 集成
├── integration-feishu/ # 飞书集成
├── integration-notion/ # Notion 集成
├── integration-webhook/# Webhook 集成
├── integration-telegram/# Telegram 集成
└── integration-wechat/ # 微信集成
```

### 2.3 数据模型全景（30 个模型）

| 领域 | 模型 | 数量 |
|------|------|------|
| 任务 | Task, TaskDependency, TaskHistory, Tag, TaskTag | 5 |
| AI | AIAuditLog | 1 |
| 智能体 | Agent, AgentOperation | 2 |
| 集成 | Integration, Webhook | 2 |
| 通知 | Notification | 1 |
| 版本 | AppVersion, ModuleVersion, Plugin | 3 |
| 工作空间 | Workspace, WorkspaceMember | 2 |
| 项目 | Project, ActivityLog | 2 |
| 工作流 | Workflow, WorkflowExecution, WorkflowStepExecution, FeedbackCheckpoint, FeedbackRule, StepFeedback | 6 |
| 发布 | Release, ReleaseChangelog, ReleaseTag, ReleaseApproval, ReleaseMilestone | 5 |
| 用户 | User | 1 |

### 2.4 EventBus 能力矩阵

| 能力 | 状态 | 说明 |
|------|------|------|
| 同步发射 | ✅ | `emit()` |
| 异步发射 | ✅ | `emitAsync()` |
| 通配符订阅 | ✅ | `*` 匹配所有事件 |
| 优先级排序 | ✅ | 数字越大越先执行 |
| 单次监听 | ✅ | `once()` |
| 错误隔离 | ✅ | 单处理器异常不影响其他 |
| 事件溯源 | ❌ | 无持久化，进程重启丢失 |
| 跨进程 | ❌ | 纯内存实现 |
| 死信队列 | ❌ | 处理失败无重试机制 |
| 事件 Schema | ❌ | 无类型约束 |

### 2.5 工作流引擎能力矩阵

| 能力 | 状态 | 说明 |
|------|------|------|
| 步骤类型 | 10/12 | `http-request` 和 `transform` 为占位符 |
| 触发器 | 6 种 | manual, webhook, schedule, event, github-issue, approval |
| SOLO Bridge | ✅ | MCP/REST/Pull 三种调用模式 |
| 反馈系统 | ✅ | 4 种模式 + 改进循环 |
| 可观测性 | ✅ | 执行追踪 + 指标收集 |
| 策略即代码 | ✅ | WORKFLOW.md 定义工作流 |
| 条件分支 | ✅ | condition 步骤 |
| 并行执行 | ✅ | parallel-group 步骤 |
| 迭代循环 | ✅ | foreach 步骤 |
| 持久化执行 | ❌ | 进程重启丢失运行中的工作流 |
| 子工作流 | ❌ | 不支持工作流嵌套 |
| 动态步骤 | ❌ | 不支持运行时添加步骤 |

### 2.6 AI 引擎能力矩阵

| 组件 | 状态 | 说明 |
|------|------|------|
| TaskExtractor | ✅ | 从文本提取任务 |
| AutoTaskDecomposer | ✅ | 自动任务拆解 |
| TaskDecomposer | ✅ | 手动任务拆解 |
| StatusInferencer | ✅ | 状态推断 |
| TaskAnalyzer | ✅ | 智能分析 |
| NlTaskQuery | ✅ | 自然语言查询 |
| ScheduleAdvisor | ✅ | 调度建议 |
| AuditLogRepository | ✅ | AI 调用审计 |
| 事件响应 | ❌ | 所有事件处理器为空壳 |
| 主动建议 | ❌ | 无定时分析/建议机制 |
| 学习优化 | ❌ | 无用户习惯学习 |

---

## 3. 行业洞察：AI 时代的软件开发范式

### 3.1 Agentic AI SDLC 三阶段演进

行业正在经历从"AI 辅助"到"AI 驱动"的范式转移：

```
阶段 1: Task-Assigned (当前主流)
┌─────────┐    ┌─────────┐    ┌─────────┐
│ 人类    │───▶│ AI 工具  │───▶│ 人类审核 │
│ 写需求  │    │ 生成代码 │    │ 提交    │
└─────────┘    └─────────┘    └─────────┘
AI 是被动工具，等待人类指令

阶段 2: Goal-Assigned (正在兴起)
┌─────────┐    ┌─────────┐    ┌─────────┐
│ 人类    │───▶│ AI Agent│───▶│ 人类确认 │
│ 设目标  │    │ 自主规划 │    │ 最终结果 │
└─────────┘    │ + 执行  │    └─────────┘
               └─────────┘
AI 自主规划路径，人类只确认关键节点

阶段 3: Outcome-Assigned (未来愿景)
┌─────────┐    ┌─────────┐
│ 人类    │───▶│ AI 系统  │
│ 描述期望 │    │ 全自主   │
│ 结果    │    │ 交付    │
└─────────┘    └─────────┘
AI 理解业务意图，端到端自主交付
```

**AI Task Hub v2.0.0 的定位**: 立足阶段 1，全面支持阶段 2，为阶段 3 奠定基础。

### 3.2 AI 项目管理工具能力分层

| 层级 | 能力 | 市场占比 | 代表产品 |
|------|------|---------|---------|
| Tier 1 | 基础任务管理 | 100% | Jira, Linear, Asana |
| Tier 2 | AI 辅助（摘要、建议） | 68% | Notion AI, ClickUp AI |
| Tier 3 | AI 自动化（自动分类、分配） | 35% | Shortcut, Motion |
| Tier 4 | 自然语言接口 | 24% | Devika, AutoGPT |
| Tier 5 | Agentic（自主规划+执行） | 0% | **暂无成熟产品** |

**AI Task Hub v2.0.0 的目标**: 达到 Tier 4+，向 Tier 5 探索。

### 3.3 MCP 生态现状

| 指标 | 数据 |
|------|------|
| 月 SDK 下载量 | 9700 万 |
| 公开 MCP 服务器 | 10,000+ |
| Tasks 原语 | 2025 年 11 月新增 |
| A2A 协议 | Google 发布，用于水平 Agent 通信 |
| 安全问题 | 22% 的 MCP 服务器存在路径遍历漏洞 |

**关键启示**: MCP 已成为 AI 工具调用的标准协议，v2.0.0 应深度拥抱 MCP 生态。

### 3.4 Spec-Driven Development（规格驱动开发）

行业趋势表明，AI 时代的开发流程正在从"代码驱动"转向"规格驱动"：

```
传统流程:
需求文档 → 技术设计 → 编码 → 测试 → 部署
   ↓
规格驱动流程:
规格文档(Spec) → AI 生成代码 → AI 生成测试 → AI 部署
     ↑              ↑              ↑
   人类审核       人类审核       人类确认
```

**核心思想**: 人类专注于"做什么"（What），AI 负责"怎么做"（How）。

### 3.5 多智能体协作模式

| 模式 | 说明 | 适用场景 |
|------|------|---------|
| Orchestrator-Worker | 中心调度器分配任务给专业 Agent | 复杂项目 |
| Peer-to-Peer | Agent 之间平等协作 | 创意类任务 |
| Hierarchical | 多层级的 Agent 组织 | 大型项目 |
| Blackboard | 共享状态空间，Agent 自主认领 | 开放式问题 |

**AI Task Hub v2.0.0 的选择**: 以 Orchestrator-Worker 为主，支持 Peer-to-Peer 扩展。

---

## 4. 核心问题诊断

### 4.1 问题一：模块孤岛 — EventBus 未被激活

**现状**: EventBus 拥有完整的能力（同步/异步、通配符、优先级、错误隔离），但整个系统中几乎没有模块使用它。

**具体表现**:
- `advance_phase` 不发射 `project.phase_changed` 事件
- 版本管理模块零事件发射
- AI 引擎事件处理器全部为空壳
- 通知规则引擎不监听 `project.*`、`release.*`、`workflow.*` 事件
- GitHub webhook 只记录日志，不触发任何内部流程

**影响**: 模块间零协作，每个模块都是信息孤岛。

### 4.2 问题二：AI 能力与业务流程脱节

**现状**: AI 引擎拥有 8 个功能组件，但它们都是被动调用的工具，无法被系统事件自动触发。

**具体表现**:
```typescript
// ai-engine.module.ts:64-72 — 所有事件处理器都是空壳
async onTaskCreated(event: EventBusEvent) {
  // TODO: Auto-analyze new task complexity
},
async onTaskStatusChanged(event: EventBusEvent) {
  // TODO: Update project health metrics
},
```

**影响**: AI 无法主动参与项目管理，只能等待人类手动调用。

### 4.3 问题三：工作流引擎与项目生命周期断裂

**现状**: 工作流引擎功能强大（12 种步骤、6 种触发器、SOLO Bridge），但与项目生命周期完全脱节。

**具体表现**:
- 项目阶段变更不会触发任何工作流
- 工作流执行结果不会影响项目状态
- 没有"项目模板工作流"概念
- 工作流引擎甚至未在 `modules.yaml` 中注册

**影响**: 工作流是一个独立工具，而非项目管理的有机组成部分。

### 4.4 问题四：缺乏结构化需求分析

**现状**: 项目从"需求"阶段直接跳到"规划"阶段，没有结构化的需求分析过程。

**具体表现**:
- 无需求文档管理
- 无需求优先级排序
- 无需求到任务的自动映射
- 无需求变更追踪

**影响**: 项目启动缺乏坚实基础，后续返工率高。

### 4.5 问题五：测试阶段空洞

**现状**: 项目有"测试"阶段，但没有任何测试自动化能力。

**具体表现**:
- 无测试用例管理
- 无测试覆盖率追踪
- 无自动化测试触发
- 无测试结果与任务关联

**影响**: 质量保证完全依赖人工。

### 4.6 问题六：部署阶段空白

**现状**: 项目有"部署"阶段，但只是一个标签，没有任何实际功能。

**具体表现**:
- 无部署流水线
- 无环境管理（dev/staging/prod）
- 无部署回滚
- 无部署状态追踪

**影响**: 发布流程在最后一步断裂。

---

## 5. v2.0.0 产品愿景

### 5.1 产品定位

```
┌─────────────────────────────────────────────────────────┐
│                    AI Task Hub v2.0.0                    │
│                                                         │
│    AI 原生的全流程开发协作平台                            │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ 需求分析  │→│ 架构设计  │→│ 编码实现  │              │
│  │ AI 辅助  │  │ AI 生成  │  │ AI 协作  │              │
│  └──────────┘  └──────────┘  └──────────┘              │
│       ↓             ↓             ↓                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ 测试验证  │→│ 版本发布  │→│ 运维监控  │              │
│  │ AI 自动化 │  │ AI 管理  │  │ AI 洞察  │              │
│  └──────────┘  └──────────┘  └──────────┘              │
│                                                         │
│  ───────────── EventBus 中枢神经系统 ─────────────       │
│                                                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐      │
│  │ MCP 生态 │ │ 多Agent │ │ CI/CD   │ │ 知识图谱 │      │
│  │ 深度集成 │ │ 协作    │ │ 集成    │ │ 持续学习 │      │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘      │
└─────────────────────────────────────────────────────────┘
```

### 5.2 核心设计原则

| 原则 | 说明 |
|------|------|
| **AI-First** | 每个功能首先考虑 AI 如何参与，而非事后添加 |
| **Event-Driven** | EventBus 是系统的中枢神经，所有模块通过事件协作 |
| **Human-in-the-Loop** | 关键决策点必须有人类确认，AI 不越权 |
| **Spec-Driven** | 以规格文档为源头，AI 从规格生成代码、测试、文档 |
| **Observable** | 所有操作可追踪、可审计、可回溯 |
| **Extensible** | 模块化架构，支持插件和第三方扩展 |
| **Progressive** | 渐进式增强，不破坏现有功能 |

### 5.3 用户体验愿景

**场景：开发者小明的一天（v2.0.0）**

```
08:30  AI 通知："昨天的 PR #42 有 2 个评论需要处理"
       → 小明点击通知，直接跳转到相关任务

09:00  小明在聊天框输入："用户反馈登录页加载太慢，需要优化"
       → AI 自动创建需求条目
       → AI 分析影响范围，拆解为 3 个子任务
       → AI 建议优先级和排期
       → 小明确认后，任务自动进入规划阶段

09:15  AI 主动建议："根据历史数据，这个优化可能影响认证模块，
       建议同步检查 JWT token 刷新逻辑"
       → 小明采纳建议，AI 自动添加关联任务

10:00  小明开始编码，AI 实时提供代码建议
       → AI 监控 commit 活动，自动更新任务进度

14:00  小明提交 PR
       → AI 自动运行测试套件
       → AI 生成变更日志
       → AI 通知相关团队成员 review

15:00  Review 通过
       → AI 自动合并到 staging
       → AI 触发部署工作流
       → AI 监控部署指标

16:00  部署完成
       → AI 生成发布说明
       → AI 更新项目文档
       → AI 记录本次优化的经验教训到知识库

17:00  AI 日报："今天完成了 3 个任务，项目进度从 45% → 52%，
       预计还需 5 个工作日完成当前迭代"
```

---

## 6. 架构重设计

### 6.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        表现层 (Presentation)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ Web UI   │  │ MCP 客户端│  │ CLI 工具  │  │ 移动端   │       │
│  │ (Next.js)│  │          │  │          │  │ (未来)   │       │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘       │
│       └──────────────┴──────────────┴──────────────┘            │
│                           │ tRPC / MCP                          │
├───────────────────────────┼─────────────────────────────────────┤
│                        API 网关层 (Gateway)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ tRPC     │  │ MCP      │  │ REST     │  │ GraphQL  │       │
│  │ Router   │  │ Server   │  │ API      │  │ (未来)   │       │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘       │
│       └──────────────┴──────────────┴──────────────┘            │
├───────────────────────────┼─────────────────────────────────────┤
│                     核心服务层 (Core Services)                    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────┐       │
│  │              EventBus v2 (中枢神经系统)               │       │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐           │       │
│  │  │ 事件溯源  │ │ 跨进程   │ │ 死信队列  │           │       │
│  │  │ 持久化   │ │ 广播     │ │ 重试机制  │           │       │
│  │  └──────────┘ └──────────┘ └──────────┘           │       │
│  └─────────────────────────────────────────────────────┘       │
│                           │                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ 项目     │  │ 任务     │  │ 工作流   │  │ AI 引擎  │       │
│  │ 生命周期  │  │ 核心     │  │ 引擎     │  │ v2      │       │
│  │ 管理器   │  │ 服务     │  │ v2       │  │         │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ 需求     │  │ 版本     │  │ 知识     │  │ Agent    │       │
│  │ 分析     │  │ 管理 v2  │  │ 管理     │  │ 协作 v2  │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                     集成层 (Integrations)                        │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐       │
│  │GitHub│ │飞书  │ │Notion│ │Telegram│ │微信  │ │CI/CD │       │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘       │
├─────────────────────────────────────────────────────────────────┤
│                     基础设施层 (Infrastructure)                  │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐               │
│  │Prisma│ │Redis │ │Tempo-│ │对象  │ │搜索  │               │
│  │+SQLite│ │(可选)│ │ral   │ │存储  │ │引擎  │               │
│  │+PG   │ │      │ │(可选)│ │(可选)│ │(可选)│               │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘               │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 EventBus v2 — 中枢神经系统

EventBus 是 v2.0.0 架构的核心。它从当前的"空转引擎"升级为真正的"中枢神经系统"。

#### 6.2.1 事件分类体系

```typescript
// 事件命名规范: {domain}.{entity}.{action}
// 示例: project.phase.changed, task.status.updated, release.published

enum EventDomain {
  PROJECT = 'project',
  TASK = 'task',
  WORKFLOW = 'workflow',
  RELEASE = 'release',
  REQUIREMENT = 'requirement',
  AGENT = 'agent',
  NOTIFICATION = 'notification',
  INTEGRATION = 'integration',
  SYSTEM = 'system',
}

// 完整事件清单
const EVENT_CATALOG = {
  // 项目事件
  'project.created': '项目创建',
  'project.phase.changed': '项目阶段变更',
  'project.archived': '项目归档',
  'project.deleted': '项目删除',
  'project.health.updated': '项目健康度更新',

  // 任务事件
  'task.created': '任务创建',
  'task.status.changed': '任务状态变更',
  'task.assigned': '任务分配',
  'task.priority.changed': '优先级变更',
  'task.completed': '任务完成',
  'task.blocked': '任务阻塞',
  'task.dependency.added': '依赖添加',
  'task.comment.added': '评论添加',

  // 工作流事件
  'workflow.triggered': '工作流触发',
  'workflow.step.completed': '步骤完成',
  'workflow.step.failed': '步骤失败',
  'workflow.completed': '工作流完成',
  'workflow.failed': '工作流失败',
  'workflow.approval.requested': '审批请求',
  'workflow.approval.decided': '审批决定',

  // 发布事件
  'release.created': '发布创建',
  'release.status.changed': '发布状态变更',
  'release.published': '发布完成',
  'release.rolled.back': '发布回滚',

  // 需求事件
  'requirement.created': '需求创建',
  'requirement.status.changed': '需求状态变更',
  'requirement.mapped.to.task': '需求映射到任务',

  // Agent 事件
  'agent.registered': 'Agent 注册',
  'agent.task.claimed': 'Agent 认领任务',
  'agent.task.completed': 'Agent 完成任务',

  // 集成事件
  'integration.github.push': 'GitHub Push',
  'integration.github.pr.opened': 'GitHub PR 创建',
  'integration.github.pr.merged': 'GitHub PR 合并',
  'integration.github.issue.created': 'GitHub Issue 创建',

  // 系统事件
  'system.module.loaded': '模块加载',
  'system.module.unloaded': '模块卸载',
  'system.config.changed': '配置变更',
} as const;
```

#### 6.2.2 EventBus v2 新增能力

| 能力 | 实现方案 | 优先级 |
|------|---------|--------|
| 事件溯源 | SQLite 表存储事件流，支持回放 | P0 |
| 事件 Schema | Zod 定义每个事件的 payload 类型 | P0 |
| 死信队列 | 处理失败的事件进入重试队列 | P1 |
| 跨进程 | Redis Pub/Sub（可选依赖） | P2 |
| 事件聚合 | 支持按时间窗口聚合事件 | P2 |
| 事件审计 | 所有关键事件记录到审计日志 | P1 |

#### 6.2.3 事件流示例

```
用户通过 MCP 创建任务
    │
    ▼
task.created 事件发射
    │
    ├──→ AI Engine: 自动分析任务复杂度
    │       └──→ task.complexity.analyzed 事件
    │             └──→ Notification: 通知项目负责人
    │
    ├──→ Workflow Engine: 检查是否有匹配的工作流模板
    │       └──→ workflow.triggered 事件
    │
    ├──→ Dashboard: 更新项目统计
    │
    └──→ Activity Log: 记录活动日志
```

### 6.3 项目生命周期管理器

新增一个核心组件，将项目阶段变更与整个系统联动：

```typescript
class ProjectLifecycleManager {
  // 阶段定义
  phases = [
    'requirements',  // 需求分析
    'planning',      // 规划
    'architecture',  // 架构设计
    'implementation',// 编码实现
    'testing',       // 测试验证
    'deployment',    // 部署发布
    'completed',     // 已完成
  ] as const;

  // 阶段转换规则
  transitions: Record<string, PhaseTransitionRule> = {
    'requirements → planning': {
      conditions: ['至少 1 个已确认的需求'],
      autoActions: ['AI 生成项目规划草案'],
      requiredApproval: true,
    },
    'planning → architecture': {
      conditions: ['至少 1 个已批准的规划'],
      autoActions: ['AI 生成架构设计建议'],
      requiredApproval: true,
    },
    'architecture → implementation': {
      conditions: ['架构设计已批准', '任务已拆解'],
      autoActions: ['创建工作流模板', '分配任务给 Agent'],
      requiredApproval: true,
    },
    'implementation → testing': {
      conditions: ['所有任务已完成或跳过'],
      autoActions: ['生成测试计划', '触发测试工作流'],
      requiredApproval: false,
    },
    'testing → deployment': {
      conditions: ['测试通过率 >= 80%'],
      autoActions: ['生成发布说明', '创建 Release 草稿'],
      requiredApproval: true,
    },
    'deployment → completed': {
      conditions: ['部署成功'],
      autoActions: ['归档项目', '记录经验教训'],
      requiredApproval: false,
    },
  };

  async advancePhase(projectId: string, targetPhase: string) {
    // 1. 验证转换合法性
    // 2. 检查前置条件
    // 3. 执行自动动作
    // 4. 请求人工审批（如需要）
    // 5. 更新项目阶段
    // 6. 发射 project.phase.changed 事件
    // 7. 触发后续工作流
  }
}
```

---

## 7. 模块详细规划

### 7.1 新增模块

#### 7.1.1 需求分析模块 (requirements-engine)

**目标**: 提供结构化的需求管理能力，连接"想法"和"任务"。

| 功能 | 说明 | AI 参与 |
|------|------|---------|
| 需求录入 | 支持文本/语音/图片多种输入 | AI 自动结构化 |
| 需求分析 | AI 分析需求可行性、复杂度、影响范围 | ✅ 核心 |
| 需求拆解 | 将大需求拆解为子需求 | ✅ 核心 |
| 需求到任务映射 | 自动生成对应的开发任务 | ✅ 核心 |
| 需求优先级 | 基于价值和紧急度排序 | ✅ 辅助 |
| 需求追踪 | 需求 → 任务 → 代码 → 测试 全链路追踪 | ✅ 自动 |
| 需求变更 | 变更影响分析 | ✅ 核心 |
| 需求模板 | 常见需求模板（用户故事、Bug、优化等） | ❌ 人工 |

**数据模型**:
```prisma
model Requirement {
  id          String   @id @default(cuid())
  projectId   String
  title       String
  description String
  type        String   // feature, bug, improvement, epic
  priority    Int      @default(0)
  status      String   @default("draft") // draft, reviewing, approved, implemented, verified
  complexity  String?  // low, medium, high, critical
  acceptance  String?  // 验收标准
  source      String?  // 来源（用户反馈、内部决策等）
  parentReqId String?  // 父需求
  tasks       Task[]
  tags        RequirementTag[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  project     Project  @relation(fields: [projectId], references: [id])
  parent      Requirement?  @relation("ReqHierarchy", fields: [parentReqId], references: [id])
  children    Requirement[] @relation("ReqHierarchy")

  @@index([projectId, status])
}
```

#### 7.1.2 知识管理模块 (knowledge-base)

**目标**: 构建项目知识图谱，让 AI 从历史经验中学习。

| 功能 | 说明 |
|------|------|
| 经验教训 | 项目完成后自动总结经验 |
| 决策记录 | 记录重要技术决策及理由 |
| 代码模式 | 识别和记录常用的代码模式 |
| 问题解决方案 | 记录 Bug 的根因和解决方案 |
| 项目模板 | 从成功项目中提取可复用模板 |
| AI 上下文 | 为 AI 提供项目相关的历史上下文 |

**数据模型**:
```prisma
model KnowledgeEntry {
  id          String   @id @default(cuid())
  projectId   String?
  type        String   // lesson_learned, decision, pattern, solution, template
  title       String
  content     String
  tags        String[]
  sourceEvent String?  // 触发此知识的事件
  aiGenerated Boolean  @default(false)
  usefulness  Int      @default(0) // 被引用次数
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  project     Project? @relation(fields: [projectId], references: [id])
}
```

#### 7.1.3 测试管理模块 (test-management)

**目标**: 将测试从"空洞的阶段标签"变为可执行的质量保证体系。

| 功能 | 说明 | AI 参与 |
|------|------|---------|
| 测试计划 | 自动生成测试计划 | ✅ 核心 |
| 测试用例 | 管理测试用例 | ✅ 辅助生成 |
| 测试执行 | 触发和追踪测试执行 | ✅ 自动 |
| 覆盖率 | 代码覆盖率追踪 | ❌ 工具 |
| 缺陷管理 | 测试发现缺陷自动创建任务 | ✅ 自动 |
| 回归测试 | 代码变更时自动触发回归 | ✅ 自动 |

#### 7.1.4 部署管理模块 (deployment-manager)

**目标**: 填补部署阶段的空白，实现从代码到生产的自动化。

| 功能 | 说明 | AI 参与 |
|------|------|---------|
| 环境管理 | dev/staging/prod 环境配置 | ❌ 配置 |
| 部署流水线 | 定义部署步骤和审批 | ✅ 辅助 |
| 部署执行 | 触发和监控部署 | ✅ 自动 |
| 回滚 | 一键回滚到任意版本 | ✅ 辅助 |
| 部署状态 | 实时部署状态追踪 | ✅ 自动 |
| 健康检查 | 部署后自动健康检查 | ✅ 自动 |

### 7.2 现有模块升级

#### 7.2.1 AI Engine v2

**从"被动工具"升级为"主动参与者"**:

```
当前 AI Engine:
┌──────────────────┐
│  8 个独立组件     │ ← 等待人类手动调用
│  (被动工具)       │
└──────────────────┘

v2.0.0 AI Engine:
┌──────────────────────────────────────┐
│           AI Orchestrator            │ ← 统一调度
│  ┌────────┐  ┌────────┐  ┌────────┐ │
│  │事件响应 │  │主动分析 │  │学习优化 │ │
│  │Handler │  │Advisor │  │Learner │ │
│  └────────┘  └────────┘  └────────┘ │
│  ┌────────┐  ┌────────┐  ┌────────┐ │
│  │任务提取 │  │任务拆解 │  │状态推断 │ │
│  │(保留)  │  │(保留)  │  │(保留)  │ │
│  └────────┘  └────────┘  └────────┘ │
│  ┌────────┐  ┌────────┐  ┌────────┐ │
│  │智能分析 │  │NL查询  │  │调度建议 │ │
│  │(保留)  │  │(保留)  │  │(保留)  │ │
│  └────────┘  └────────┘  └────────┘ │
└──────────────────────────────────────┘
```

**新增组件**:

| 组件 | 职责 | 触发方式 |
|------|------|---------|
| AIEventHandler | 监听 EventBus 事件，自动响应 | 事件驱动 |
| AIAdvisor | 定时分析项目状态，主动提供建议 | 定时 + 事件 |
| AILearner | 从历史数据中学习，优化建议质量 | 批处理 |
| AIOrchestrator | 统一调度所有 AI 组件 | 中心控制器 |

**事件响应示例**:
```typescript
// AI Engine v2 事件处理器
class AIEventHandler {
  @OnEvent('task.created')
  async onTaskCreated(event: TaskCreatedEvent) {
    // 1. 分析任务复杂度
    const complexity = await this.analyzer.analyzeComplexity(event.task);
    // 2. 建议拆解方案（如果复杂度高）
    if (complexity > THRESHOLD) {
      const decomposition = await this.decomposer.suggest(event.task);
      await this.emit('ai.suggestion.task.decomposition', { ... });
    }
    // 3. 预估工时
    const estimate = await this.advisor.estimateEffort(event.task);
    await this.emit('ai.suggestion.effort', { ... });
  }

  @OnEvent('project.phase.changed')
  async onPhaseChanged(event: PhaseChangedEvent) {
    if (event.newPhase === 'requirements') {
      // 自动生成需求分析模板
      await this.generateRequirementTemplate(event.project);
    } else if (event.newPhase === 'testing') {
      // 自动生成测试计划
      await this.generateTestPlan(event.project);
    }
  }

  @OnEvent('integration.github.pr.opened')
  async onPROpened(event: GitHubPREvent) {
    // 分析 PR 影响范围
    const impact = await this.analyzer.analyzePRImpact(event.pr);
    // 建议 reviewer
    const reviewers = await this.advisor.suggestReviewers(event.pr);
    // 检查是否需要更新相关任务
    await this.linkPRToTasks(event.pr, impact);
  }
}
```

#### 7.2.2 Workflow Engine v2

**从"独立工具"升级为"项目驱动引擎"**:

| 升级项 | 说明 |
|--------|------|
| 项目模板工作流 | 每个项目阶段自动关联工作流模板 |
| 事件触发增强 | 监听所有项目/任务事件，自动触发工作流 |
| 持久化执行 | 基于 Temporal 模式，支持长时间运行 |
| 子工作流 | 支持工作流嵌套调用 |
| 动态步骤 | 运行时根据条件动态添加步骤 |
| 人工节点增强 | 支持多人审批、会签、或签 |
| 补全占位步骤 | 实现 `http-request` 和 `transform` |

#### 7.2.3 Agent 协作 v2

**从"注册系统"升级为"多智能体协作平台"**:

| 升级项 | 说明 |
|--------|------|
| 角色系统 | 定义 Agent 角色（PM、开发、测试、运维等） |
| 任务认领 | Agent 根据能力自动认领任务 |
| 协作协议 | Agent 间通过 EventBus 通信 |
| 能力声明 | Agent 声明自己的能力范围 |
| 绩效追踪 | 追踪 Agent 的工作效率和质量 |
| A2A 协议 | 支持 Google A2A 协议进行跨平台 Agent 通信 |

#### 7.2.4 GitHub 集成 v2

**从"日志记录器"升级为"双向桥梁"**:

| 升级项 | 说明 |
|--------|------|
| Push 处理 | 分析 commit 消息，自动更新任务状态 |
| PR 管理 | PR 创建/更新/合并触发工作流 |
| Issue 同步 | GitHub Issue ↔ 任务双向同步 |
| Release 联动 | GitHub Release ↔ 内部版本管理同步 |
| Webhook 安全 | HMAC 签名验证 |

#### 7.2.5 版本管理 v2

**从"独立模块"升级为"发布流水线"**:

| 升级项 | 说明 |
|--------|------|
| 事件发射 | 所有操作发射事件，联动其他模块 |
| 自动版本号 | 基于语义化版本 + Conventional Commits 自动建议版本号 |
| 变更日志自动生成 | 从 ActivityLog 和 commit 消息自动生成 |
| 发布流水线 | 与工作流引擎集成，自动化发布流程 |
| 回滚增强 | 支持部分回滚和热修复 |

---

## 8. 人机协作模型

### 8.1 协作矩阵

| 活动类型 | 人类角色 | AI 角色 | 协作模式 |
|---------|---------|---------|---------|
| 需求定义 | 提出需求、确认优先级 | 结构化、分析可行性、拆解 | Human → AI → Human |
| 架构设计 | 审核方案、做技术决策 | 生成方案、评估权衡 | AI → Human |
| 任务拆解 | 确认拆解结果 | 自动拆解、预估工时 | AI → Human |
| 编码实现 | 编写核心逻辑、审核代码 | 生成样板代码、建议优化 | Human + AI |
| 代码审查 | 审查逻辑正确性 | 检查规范、安全漏洞 | Human + AI |
| 测试 | 定义验收标准 | 生成测试用例、执行测试 | Human → AI |
| 部署 | 确认部署、处理异常 | 自动化部署、监控 | AI → Human |
| 运维 | 处理复杂问题 | 监控告警、自动修复 | AI → Human |

### 8.2 信任等级模型

AI 的自主性根据信任等级动态调整：

```
Level 0: 观察 (Observe)
  AI 只观察，不执行任何操作
  所有建议以"提示"形式展示

Level 1: 建议 (Suggest)
  AI 可以提供建议，但需要人类确认才能执行
  适用于: 新项目初期、新团队成员

Level 2: 执行 (Execute)
  AI 可以自动执行低风险操作
  高风险操作仍需人类确认
  适用于: 熟悉的项目、信任的 AI

Level 3: 自治 (Autonomous)
  AI 可以自主执行大部分操作
  仅关键决策点需要人类确认
  适用于: 高度信任、成熟的工作流

Level 4: 代理 (Delegate)
  AI 全权代理某个领域
  人类只看结果报告
  适用于: 特定领域的专家 AI
```

### 8.3 审批门控

关键节点必须有人类审批，不可跳过：

| 门控 | 触发条件 | 审批内容 |
|------|---------|---------|
| 需求确认 | 需求分析完成 | 需求范围和优先级 |
| 规划批准 | 项目规划完成 | 排期和资源分配 |
| 架构评审 | 架构设计完成 | 技术方案 |
| 代码合并 | PR 创建 | 代码质量 |
| 发布批准 | 测试通过 | 发布内容和时间 |
| 紧急回滚 | 生产事故 | 回滚方案 |

---

## 9. 数据架构演进

### 9.1 新增数据模型

| 模型 | 说明 | 优先级 |
|------|------|--------|
| Requirement | 需求条目 | P0 |
| RequirementTag | 需求标签 | P0 |
| RequirementChange | 需求变更记录 | P1 |
| KnowledgeEntry | 知识条目 | P1 |
| TestCase | 测试用例 | P1 |
| TestExecution | 测试执行记录 | P1 |
| TestSuite | 测试套件 | P1 |
| Deployment | 部署记录 | P2 |
| DeploymentEnvironment | 部署环境 | P2 |
| AgentRole | Agent 角色 | P1 |
| AgentCapability | Agent 能力声明 | P1 |
| EventStore | 事件溯源存储 | P0 |
| DeadLetterQueue | 死信队列 | P1 |

### 9.2 数据库演进策略

```
v1.x: SQLite (单文件，零配置)
  ↓
v2.0: SQLite (保持兼容) + 可选 PostgreSQL
  ↓
v2.x: PostgreSQL (推荐) + SQLite (轻量部署)
```

**迁移方案**:
- 使用 Prisma Migrate 管理数据库迁移
- v2.0.0 保持 SQLite 作为默认选项
- 提供 PostgreSQL 适配器作为可选依赖
- 数据迁移脚本支持 v1.x → v2.0.0 无损升级

### 9.3 事件存储设计

```prisma
model EventStore {
  id        String   @id @default(cuid())
  eventType String   // 事件类型
  payload   String   // JSON 序列化的事件数据
  source    String?  // 事件来源
  timestamp DateTime @default(now())
  version   Int      @default(1) // 事件 Schema 版本

  @@index([eventType, timestamp])
  @@index([source, timestamp])
}
```

---

## 10. 安全与合规

### 10.1 AI 安全

| 措施 | 说明 |
|------|------|
| AI 操作审计 | 所有 AI 操作记录到 AIAuditLog |
| 权限控制 | AI 操作受角色权限约束 |
| 人工确认 | 高风险操作必须人类确认 |
| Prompt 注入防护 | 对用户输入进行清洗和验证 |
| 输出验证 | AI 生成的代码/配置经过安全扫描 |

### 10.2 数据安全

| 措施 | 说明 |
|------|------|
| 传输加密 | HTTPS/TLS 强制 |
| 存储加密 | 敏感数据加密存储 |
| 访问控制 | 基于角色的细粒度权限 |
| 数据脱敏 | AI 调用时不传输敏感信息 |
| 审计日志 | 所有数据访问记录审计 |

### 10.3 MCP 安全

| 措施 | 说明 |
|------|------|
| 工具权限 | MCP 工具调用受权限控制 |
| 输入验证 | 所有 MCP 工具输入经过 Zod 校验 |
| 路径遍历防护 | 文件操作限制在安全目录内 |
| 速率限制 | 防止 MCP 工具滥用 |

---

## 11. 迁移策略

### 11.1 兼容性承诺

| 维度 | 策略 |
|------|------|
| API | tRPC API 保持向后兼容，废弃 API 标记 deprecated |
| 数据 | Prisma Migrate 管理数据库迁移，支持回滚 |
| MCP | MCP 工具保持向后兼容，新增工具不影响现有工具 |
| 配置 | modules.yaml 向后兼容，新配置项有默认值 |
| 前端 | 渐进式升级，旧功能不受影响 |

### 11.2 迁移步骤

```
Phase 1: 基础设施 (1-2 天)
  ├── EventBus v2 升级（事件溯源 + Schema）
  ├── 事件存储表创建
  └── 现有模块事件发射接入

Phase 2: 核心模块 (3-5 天)
  ├── AI Engine v2 事件处理器实现
  ├── 项目生命周期管理器
  ├── 需求分析模块
  └── 工作流引擎 v2 升级

Phase 3: 扩展模块 (3-5 天)
  ├── 知识管理模块
  ├── 测试管理模块
  ├── 部署管理模块
  └── Agent 协作 v2

Phase 4: 集成增强 (2-3 天)
  ├── GitHub 集成 v2
  ├── 版本管理 v2
  └── 通知规则引擎增强

Phase 5: 优化打磨 (2-3 天)
  ├── 性能优化
  ├── 文档更新
  ├── 测试补充
  └── 发布准备
```

---

## 12. 实施路线图

### 12.1 版本规划

```
v2.0.0-alpha.1  ── EventBus v2 + 事件发射接入
v2.0.0-alpha.2  ── AI Engine v2 + 项目生命周期管理器
v2.0.0-alpha.3  ── 需求分析模块 + 工作流引擎 v2
v2.0.0-beta.1   ── 知识管理 + 测试管理 + Agent 协作 v2
v2.0.0-beta.2   ── GitHub 集成 v2 + 版本管理 v2 + 部署管理
v2.0.0-rc.1     ── 全功能集成测试 + 性能优化
v2.0.0          ── 正式发布
```

### 12.2 优先级矩阵

| 功能 | 优先级 | 工作量 | 影响范围 | 依赖 |
|------|--------|--------|---------|------|
| EventBus v2 事件溯源 | P0 | 中 | 全局 | 无 |
| 现有模块事件发射 | P0 | 中 | 全局 | EventBus v2 |
| AI 事件处理器实现 | P0 | 大 | AI 全局 | EventBus v2 |
| 项目生命周期管理器 | P0 | 中 | 项目 | EventBus v2 |
| 需求分析模块 | P0 | 大 | 项目 | EventBus v2 |
| 工作流引擎注册 | P0 | 小 | 工作流 | 无 |
| http-request 步骤实现 | P1 | 小 | 工作流 | 无 |
| transform 步骤实现 | P1 | 小 | 工作流 | 无 |
| 知识管理模块 | P1 | 中 | 项目 | EventBus v2 |
| 测试管理模块 | P1 | 中 | 项目 | EventBus v2 |
| Agent 角色系统 | P1 | 中 | Agent | EventBus v2 |
| GitHub 集成增强 | P1 | 中 | 集成 | EventBus v2 |
| 版本管理事件发射 | P1 | 小 | 版本 | EventBus v2 |
| 通知规则引擎增强 | P1 | 小 | 通知 | EventBus v2 |
| 部署管理模块 | P2 | 大 | 项目 | 工作流 v2 |
| 死信队列 | P2 | 中 | EventBus | EventBus v2 |
| 跨进程 EventBus | P2 | 大 | 全局 | Redis |
| A2A 协议支持 | P2 | 大 | Agent | Agent v2 |
| PostgreSQL 适配 | P2 | 中 | 数据库 | 无 |
| 移动端适配 | P3 | 大 | 前端 | 无 |

### 12.3 里程碑定义

| 里程碑 | 版本 | 目标 | 验收标准 |
|--------|------|------|---------|
| M1: 中枢激活 | alpha.1 | EventBus 成为系统中枢 | 所有模块通过事件通信 |
| M2: AI 觉醒 | alpha.2 | AI 从被动变主动 | AI 自动响应 80%+ 系统事件 |
| M3: 全流程贯通 | alpha.3 | 需求→发布全流程 | 端到端流程可走通 |
| M4: 智能进化 | beta.1 | 知识积累和学习 | AI 建议质量可量化提升 |
| M5: 生态连接 | beta.2 | 外部集成增强 | GitHub 双向同步 |
| M6: 生产就绪 | rc.1 | 性能、安全、稳定性 | 所有测试通过，性能达标 |

---

## 13. 成功指标

### 13.1 技术指标

| 指标 | 当前值 | v2.0.0 目标 | 测量方式 |
|------|--------|------------|---------|
| 模块间事件通信覆盖率 | ~5% | 90%+ | 事件发射点统计 |
| AI 自动响应事件数 | 0 | 50+ | 事件处理器统计 |
| 工作流自动触发率 | 0% | 70%+ | 工作流触发日志 |
| 端到端流程自动化 | 0% | 60%+ | 流程完成率 |
| 测试覆盖率 | 未知 | 80%+ | Vitest 覆盖率报告 |
| 事件处理延迟 P99 | N/A | <100ms | 可观测性指标 |

### 13.2 产品指标

| 指标 | 说明 |
|------|------|
| 需求到任务的转化时间 | 从需求确认到任务创建的平均时间 |
| 项目阶段推进速度 | 平均每个阶段的耗时 |
| AI 建议采纳率 | 用户采纳 AI 建议的比例 |
| 人工干预频率 | 每个项目需要人工干预的次数 |
| 发布周期 | 从代码完成到发布的平均时间 |

### 13.3 用户体验指标

| 指标 | 说明 |
|------|------|
| MCP 工具使用满意度 | 用户对 MCP 工具的评分 |
| 自然语言交互成功率 | NL 命令一次执行成功率 |
| 新手上手时间 | 新用户完成第一个项目的时间 |

---

## 14. 风险与缓解

### 14.1 技术风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| EventBus 重构影响稳定性 | 高 | 高 | 渐进式迁移，保留旧接口 |
| AI 响应质量不稳定 | 中 | 中 | 人工确认 + A/B 测试 |
| 数据库迁移失败 | 低 | 高 | 完整的迁移回滚方案 |
| 性能下降 | 中 | 中 | 性能基准测试 + 持续监控 |
| MCP 协议变更 | 低 | 中 | 抽象适配层，隔离协议变更 |

### 14.2 产品风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 功能过于复杂 | 中 | 高 | 渐进式发布，核心功能优先 |
| 用户不信任 AI 建议 | 中 | 中 | 信任等级模型 + 透明度 |
| 与现有工作流冲突 | 中 | 中 | 可配置的工作流模板 |
| 过度自动化 | 低 | 高 | 关键节点人工审批 |

### 14.3 资源风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 开发周期过长 | 中 | 中 | 严格优先级管理，MVP 先行 |
| AI API 成本过高 | 中 | 中 | 缓存 + 本地模型备选 |
| 测试覆盖不足 | 中 | 中 | 测试驱动开发 |

---

## 15. 附录

### 15.1 术语表

| 术语 | 定义 |
|------|------|
| EventBus | 事件总线，模块间通信的核心机制 |
| MCP | Model Context Protocol，AI 模型与工具的通信协议 |
| A2A | Agent-to-Agent，Agent 间通信协议 |
| Spec-Driven | 规格驱动开发，以规格文档为源头 |
| Temporal | 持久化执行引擎，用于长时间运行的工作流 |
| SOLO Bridge | AI Task Hub 与 SOLO AI 的桥接层 |
| Phase | 项目阶段（需求/规划/架构/实现/测试/部署/完成） |
| Dead Letter Queue | 死信队列，存储处理失败的事件 |

### 15.2 参考资源

| 资源 | 链接 |
|------|------|
| MCP 官方规范 | https://modelcontextprotocol.io |
| A2A 协议 | https://developers.google.com/protocol-a2a |
| Temporal 文档 | https://docs.temporal.io |
| Vercel AI SDK | https://sdk.vercel.ai |
| Prisma 文档 | https://www.prisma.io/docs |
| Conventional Commits | https://www.conventionalcommits.org |

### 15.3 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0.0 | 2026-04-28 | 首次发布 |
| v1.1.0 | 2026-04-28 | 安全加固 |
| v1.2.0 | 2026-04-28 | 集成适配器 |
| v1.3.0 | 2026-04-28 | 工作流引擎初版 |
| v1.4.0 | 2026-04-29 | HF Spaces 持久化 |
| v1.5.0 | 2026-04-29 | 免登录模式 |
| v1.6.0 | 2026-04-29 | SOLO AI 层 + 反馈模块 |
| v1.7.0 | 2026-04-29 | 触发器 + 高级步骤 |
| v1.8.0 | 2026-04-29 | 策略即代码 + 可观测性 |
| v1.9.0 | 2026-04-30 | 版本管理 + Bug 修复 |

### 15.4 文档变更记录

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0 | 2026-04-30 | 初始版本 |

---

> **本文档是 AI Task Hub v2.0.0 "Project Nova" 的总体规划书。**
> **所有设计和规划都可能根据实施过程中的发现进行调整。**
> **核心原则不变：AI-First、Event-Driven、Human-in-the-Loop。**
