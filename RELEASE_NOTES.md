# AI Task Hub v1.8.0 Release Notes

> 发布日期：2026-04-29

---

## 版本概述

AI Task Hub v1.8.0 是一次重大版本更新，标志着项目进入 **Phase C: 智能化** 阶段。本版本引入了策略即代码、可观测性平台、反馈驱动改进闭环等核心能力，同时完成了 13 项安全修复和多项性能优化。测试覆盖达到 **1,349 个用例，100% 通过率**。

---

## 新功能

### MCP Streamable HTTP

- **MCP 服务端** — 完整实现 Model Context Protocol，支持 Streamable HTTP 传输
- **25 个 MCP 工具** — 覆盖任务核心（9 个）、AI 引擎（4 个）、项目生命周期（12 个）
- **多客户端支持** — 兼容 Trae、Cursor、Windsurf、VS Code、Claude、ChatGPT 等主流 AI IDE
- **REST API v1** — 通用 HTTP 接口，任何 AI 智能体均可通过 `X-API-Key` 接入

### 工作流引擎

- **12 种步骤类型** — create-task、update-status、ai-analyze、send-notification、wait、parallel-group、condition、foreach、invoke-agent、http-request、transform、approval
- **5 种触发器** — manual、webhook、schedule、event、github-issue
- **高级步骤** — foreach 数组迭代、invoke-agent SOLO 调用、approval 人工审批
- **重试机制** — 支持 exponential / linear / fixed 三种退避算法
- **并发控制** — Per-workflow 独立并发限制 + 优先级队列（0-5 级）
- **可观测性面板** — 实时统计卡片 + 最近执行 / 步骤性能 / SOLO 调用历史

### AI 智能体系统

- **Agent 注册与认证** — 支持 8 种客户端类型（Trae/Cursor/Windsurf/VS Code/Claude/ChatGPT/MCP/API）
- **权限模型** — creator-isolation（创建者隔离 + 全局只读）
- **操作审计** — 完整的操作日志记录和统计
- **SOLO Bridge** — 统一 AI 调用层，支持 MCP/REST/Pull 三种模式

### AI 引擎

- **任务提取** — 从自然语言文本中自动提取结构化任务
- **智能拆解** — AI 驱动的任务分解，支持自定义深度和策略
- **状态推断** — 基于上下文的任务状态智能推断
- **报告生成** — 项目/团队/任务维度的分析报告
- **自然语言查询** — 用自然语言搜索和筛选任务
- **调度建议** — AI 驱动的任务优先级和排期建议

### 反馈系统

- **检查点机制** — 嵌入执行流程的 5 种检查点类型（pre_execute / post_execute / timeout / error / manual）
- **4 种干预模式** — auto / notify / block / smart
- **规则引擎** — 6 种触发类型（step_type / duration / token_cost / rating / error_rate / always）
- **SOLO 自省** — AI 自动分析反馈数据并生成优化建议
- **改进闭环** — 分析 -> 建议 -> 应用 完整管线

### 插件系统

- **插件市场** — 插件安装/卸载/启用/禁用
- **动态加载** — 运行时加载插件，无需重启
- **自定义工具** — 插件可注册自定义 MCP 工具
- **用户设置** — 每个插件支持独立的用户可配置项

### 项目管理

- **项目全生命周期** — 7 个阶段（requirements -> planning -> architecture -> implementation -> testing -> deployment -> completed）
- **活动日志** — 完整的项目活动时间线
- **项目摘要** — 自动聚合任务统计和最近活动
- **智能体创建项目** — AI 智能体可独立创建和管理项目

### 平台集成

- **GitHub** — Issue 同步、PR 关联、标签映射
- **飞书** — 任务双向同步
- **Notion** — Page 同步、属性提取
- **Webhook** — 通用 Webhook 接收和转发
- **Telegram / 微信** — 通知推送（预留）

### 模块热更新

- **模块注册表** — YAML 配置驱动的模块管理
- **热重载** — 运行时重载模块，无需重启服务
- **版本管理** — 模块版本发布、回滚、历史记录
- **依赖管理** — 模块间依赖声明和隔离

### 其他功能

- **多租户工作空间** — Workspace + 成员管理，4 种角色
- **SSE 实时推送** — 通知、任务、工作流、检查点 4 个事件频道
- **Web Push 通知** — 浏览器推送通知
- **PWA 支持** — 移动端优化、离线支持
- **国际化** — 中/英文双语
- **数据备份/恢复** — API 驱动的完整数据导入导出

---

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| **Next.js** | 16.2.4 | 全栈框架（Turbopack 构建） |
| **React** | 19.2.4 | UI 框架 |
| **tRPC** | v11.16.0 | 类型安全的 API 层 |
| **Prisma** | 7.8.0 | ORM（SQLite） |
| **TypeScript** | 5.x | 开发语言 |
| **Tailwind CSS** | 4.x | 样式框架 |
| **shadcn/ui** | 4.5.0 | UI 组件库 |
| **Zod** | 4.3.6 | 运行时类型验证 |
| **Vitest** | 4.1.5 | 单元测试 |
| **Playwright** | 1.59.1 | E2E 测试 |
| **better-sqlite3** | 12.9.0 | SQLite 原生驱动 |
| ** jose** | 6.2.3 | JWT 认证 |
| **AI SDK** | 6.0.168 | Vercel AI SDK |
| **MCP SDK** | 1.29.0 | Model Context Protocol |

---

## 安全修复

本版本修复了 13 项安全问题：

| 序号 | 问题 | 严重程度 | 修复内容 |
|------|------|---------|---------|
| 1 | **JWT 空字符串绕过** | 严重 | JWT_SECRET 为空字符串时拒绝启动，强制配置 |
| 2 | **默认管理员密码** | 高 | 生产环境强制要求修改 ADMIN_PASSWORD |
| 3 | **代码注入防护** | 高 | 工作流步骤输入/输出进行安全过滤，防止代码注入 |
| 4 | **REST API 认证缺失** | 高 | SSE/备份/导出/Webhook 端点添加 JWT 认证 |
| 5 | **tRPC 权限过宽** | 高 | 48 个 procedure 从 public 改为 protected/admin |
| 6 | **Agent API Key 泄露** | 中 | API Key 仅在注册时返回一次，后续不可查看 |
| 7 | **SQL 注入防护** | 高 | Prisma 参数化查询，无原始 SQL 拼接 |
| 8 | **XSS 防护** | 中 | 用户输入统一转义，CSP 头配置 |
| 9 | **CORS 配置** | 中 | 生产环境限制允许的 Origin |
| 10 | **速率限制** | 中 | API 端点添加请求频率限制 |
| 11 | **密码哈希** | 高 | 使用 bcryptjs 进行密码哈希（不可逆） |
| 12 | **Token 过期** | 中 | JWT Token 设置合理的过期时间 |
| 13 | **Webhook 签名验证** | 中 | HMAC 签名验证，防止伪造请求 |

---

## 性能优化

### foreach 并行化

- foreach 步骤支持并行执行子步骤
- 可配置 `failFast` 模式：遇到错误立即终止或继续执行
- 显著提升批量任务处理效率

### PrismaClient 连接池

- 优化 Prisma Client 实例管理，避免重复创建
- 配置连接池参数，提升数据库查询性能
- 全局单例模式，减少资源消耗

### 查询并行化

- 多个独立数据库查询使用 `Promise.all` 并行执行
- Dashboard 聚合查询优化，减少响应时间
- 任务列表查询支持索引命中

### 构建优化

- Next.js 16 Turbopack 默认构建器
- `optimizePackageImports` 配置，减小 bundle 体积
- 静态资源长期缓存（`Cache-Control: immutable`）
- `serverExternalPackages` 排除原生模块

---

## 测试覆盖

| 指标 | 数值 |
|------|------|
| **总测试用例** | 1,349 |
| **通过率** | 100% |
| **测试框架** | Vitest 4.x + Playwright 1.59.x |

### 测试分类

| 类别 | 文件 | 说明 |
|------|------|------|
| **tRPC 单元测试** | `tests/trpc/*.test.ts` | 12 个路由器全覆盖 |
| **API 集成测试** | `tests/api/*.test.ts` | REST API 端点测试 |
| **安全测试** | `tests/security/security.test.ts` | 安全漏洞回归测试 |
| **回归测试** | `tests/regression/v1-fixes.test.ts` | 已知问题回归验证 |
| **核心测试** | `tests/core/kernel.test.ts` | 核心模块测试 |
| **E2E 测试** | `e2e/*.spec.ts` | 12 个页面的端到端测试 |

### E2E 测试覆盖

- 仪表盘、任务管理、智能体管理
- 工作流管理、通知管理、可观测性
- 项目管理、插件管理、设置页面
- 导航、集成管理、Demo 页面

---

## 已知限制

| 限制 | 说明 | 计划 |
|------|------|------|
| **SQLite 并发写入** | SQLite 不支持高并发写入，适合中小规模使用 | 未来考虑 PostgreSQL 适配 |
| **单实例部署** | 当前不支持水平扩展 | 计划引入分布式任务队列 |
| **AI 模型依赖** | AI 功能依赖外部 API（OpenAI），离线不可用 | 计划支持本地模型 |
| **Web Push 持久化** | Push 订阅当前存储在内存中，重启丢失 | 计划迁移到数据库 |
| **文件存储** | 不支持文件/附件上传 | 计划引入对象存储 |
| **实时协作** | 不支持多用户实时协作编辑 | 计划引入 CRDT |
| **插件沙箱** | 插件运行在主进程中，无沙箱隔离 | 计划引入 Worker 线程隔离 |

---

## 贡献者

感谢所有为本版本做出贡献的开发者：

- **@arwei944** — 项目负责人，核心架构设计与开发
- **SOLO AI Agent** — AI 辅助开发、代码审查、测试生成

### 贡献指南

欢迎参与 AI Task Hub 的开发：

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/your-feature`
3. 提交更改：`git commit -m 'feat: add your feature'`
4. 推送分支：`git push origin feature/your-feature`
5. 提交 Pull Request

---

## 升级指南

从 v1.7.0 升级到 v1.8.0：

```bash
# 拉取最新代码
git pull origin main

# 更新依赖
pnpm install

# 同步数据库结构
npx prisma generate
npx prisma db push

# 重新构建
pnpm build

# 重启服务
pnpm start
```

> **注意**：数据库结构有变更（新增 FeedbackCheckpoint、FeedbackRule、StepFeedback 表，Workflow 和 WorkflowStepExecution 新增字段），请确保执行 `prisma db push`。

---

## 许可证

ISC License
