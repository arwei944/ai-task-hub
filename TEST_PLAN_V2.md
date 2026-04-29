# AI Task Hub v1.8.0 — 全面测试计划 v2

**版本**: 2.0
**日期**: 2026-04-29
**基于**: TEST_REPORT.md (v1) + GAME_DEV_REPORT.md + 全源码静态扫描 (90 issues)
**目标**: 覆盖所有已知问题，指导后续测试和修复工作

---

## 一、问题全景总览

### 1.1 问题来源汇总

| 来源 | 发现数 | Critical | Warning | Suggestion |
|------|--------|----------|---------|------------|
| v1 单元测试 (TEST_REPORT) | 5 | 2 | 3 | 0 |
| MCP 实战测试 (GAME_DEV_REPORT) | 5 | 0 | 3 | 2 |
| 全源码静态扫描 | 90 | 5 | 34 | 25 |
| **去重合并后** | **82** | **5** | **32** | **25** |

### 1.2 按模块分布

| 模块 | Critical | Warning | Suggestion | 合计 |
|------|----------|---------|------------|------|
| 安全 (Auth/Backup/SSE/MCP) | 5 | 0 | 3 | 8 |
| Workflow Engine | 0 | 12 | 10 | 22 |
| MCP Server | 0 | 2 | 1 | 3 |
| Task Core | 0 | 1 | 0 | 1 |
| AI Engine | 0 | 1 | 3 | 4 |
| Integration | 0 | 1 | 0 | 1 |
| Notifications | 0 | 1 | 0 | 1 |
| Plugins | 0 | 1 | 0 | 1 |
| Core (Kernel/Registry) | 0 | 2 | 0 | 2 |
| 前端页面 | 0 | 2 | 3 | 5 |
| tRPC 路由 | 0 | 2 | 2 | 4 |
| 类型安全 (全局) | 0 | 7 | 5 | 12 |
| 性能 (全局) | 0 | 7 | 3 | 10 |
| 硬编码 (全局) | 0 | 0 | 12 | 12 |
| 边界条件 (全局) | 0 | 0 | 8 | 8 |

---

## 二、🔴 Critical 问题测试计划（5 项）

### C-01: JWT 密钥硬编码默认值

- **文件**: `src/lib/modules/auth/auth.service.ts:28`
- **问题**: JWT_SECRET 未设置时使用 `'ai-task-hub-default-secret-change-in-production'`，攻击者可伪造 token
- **测试文件**: `tests/modules/auth/auth.test.ts`
- **测试用例**:

| ID | 用例 | 输入 | 预期 |
|----|------|------|------|
| C-01-1 | 未设置 JWT_SECRET 时使用默认密钥 | `process.env.JWT_SECRET = undefined` | verifyToken 应能验证默认密钥签发的 token |
| C-01-2 | 默认密钥签发的 token 可被任意复现 | 用默认密钥生成 token | 任何人知道默认密钥都能生成合法 token |
| C-01-3 | 设置自定义 JWT_SECRET 后使用自定义密钥 | `process.env.JWT_SECRET = 'my-secret'` | 应使用 'my-secret' 签发和验证 |
| C-01-4 | 自定义密钥签发的 token 不能被默认密钥验证 | 用 'my-secret' 签发，用默认密钥验证 | 验证应失败返回 null |
| C-01-5 | JWT_SECRET 为空字符串时的行为 | `process.env.JWT_SECRET = ''` | 应视为未设置，使用默认值或抛错 |

- **修复建议**: 未设置 JWT_SECRET 时启动报错退出，不使用默认值

---

### C-02: 默认管理员硬编码密码

- **文件**: `src/lib/trpc/server.ts:53`
- **问题**: 自动创建管理员 `admin/admin`，任何人都可登录
- **测试文件**: `tests/trpc/tasks.test.ts` (扩展)
- **测试用例**:

| ID | 用例 | 输入 | 预期 |
|----|------|------|------|
| C-02-1 | 首次启动自动创建 admin 用户 | 空数据库启动 | 应创建 admin 用户 |
| C-02-2 | admin 默认密码为 'admin' | `login('admin', 'admin')` | 应返回有效 token |
| C-02-3 | 可通过环境变量覆盖默认密码 | 设置 `ADMIN_PASSWORD=xxx` | 应使用 xxx 作为密码 |
| C-02-4 | 重复启动不重复创建 admin | 已有 admin 用户时重启 | 不应抛错，不重复创建 |
| C-02-5 | 默认密码登录后应提示修改密码 | admin 首次登录 | 响应应包含 `mustChangePassword: true` |

- **修复建议**: 首次启动生成随机密码并打印到日志，或强制通过环境变量设置

---

### C-03: new Function() 代码注入风险

- **文件**: `src/lib/modules/workflow-engine/steps/condition.ts:49`
- **问题**: `new Function()` 动态执行代码，白名单过滤不够严格
- **测试文件**: `tests/modules/workflow/step-handlers.test.ts` (扩展)
- **测试用例**:

| ID | 用例 | 输入 | 预期 |
|----|------|------|------|
| C-03-1 | 正常比较表达式 | `'{{status}} === "active"'`, `{status: 'active'}` | 返回 true |
| C-03-2 | 包含函数调用的表达式被过滤 | `'process.exit(1)'` | 返回 false（被白名单过滤） |
| C-03-3 | 包含对象属性访问的表达式 | `'this.constructor'` | 返回 false（被白名单过滤） |
| C-03-4 | 包含方括号访问的表达式 | `'this["constructor"]'` | 返回 false（被白名单过滤） |
| C-03-5 | 超长表达式 | 10000 字符的表达式 | 应有长度限制或返回 false |
| C-03-6 | 空表达式 | `''` | 返回 false |
| C-03-7 | 包含模板字面量的表达式 | '`${process.env.PATH}`' | 返回 false（被白名单过滤） |
| C-03-8 | Unicode 欺骗 | 包含零宽字符的表达式 | 返回 false |

- **修复建议**: 使用严格白名单（只允许数字、比较运算符、逻辑运算符、字符串字面量），或改用安全的表达式解析库

---

### C-04: 备份 API 无认证

- **文件**: `src/app/api/backup/route.ts:16`
- **问题**: GET 导出全部数据、POST 覆盖数据库均无鉴权
- **测试文件**: `tests/api/backup.test.ts` (扩展)
- **测试用例**:

| ID | 用例 | 输入 | 预期 |
|----|------|------|------|
| C-04-1 | 无认证 GET 请求导出数据 | 无 Authorization header | 应返回 401 |
| C-04-2 | 无认证 POST 请求导入数据 | 无 Authorization header | 应返回 401 |
| C-04-3 | 有效 token GET 请求 | 有效 admin token | 应返回 200 + 备份数据 |
| C-04-4 | 有效 token POST 请求 | 有效 admin token + 备份数据 | 应返回 200 + 导入结果 |
| C-04-5 | 无效 token GET 请求 | 无效/过期 token | 应返回 401 |
| C-04-6 | 非 admin 用户 GET 请求 | 普通 user token | 应返回 403 |

- **修复建议**: 添加 JWT 认证中间件，限制仅 admin 角色可访问

---

### C-05: SSE 端点无认证

- **文件**: `src/app/api/sse/route.ts:14`
- **问题**: 任何人可连接 SSE 流接收所有实时事件
- **测试文件**: `tests/api/sse.test.ts` (扩展)
- **测试用例**:

| ID | 用例 | 输入 | 预期 |
|----|------|------|------|
| C-05-1 | 无认证 SSE 连接 | 无 Authorization header | 应返回 401 或限制可用 channel |
| C-05-2 | 有效 token SSE 连接 | 有效 token | 应返回 200 + SSE 流 |
| C-05-3 | 无效 token SSE 连接 | 无效 token | 应返回 401 |
| C-05-4 | 公开 channel 无需认证 | 连接 public channel | 应允许（公开信息） |
| C-05-5 | 私有 channel 需要认证 | 连接 task-updates channel | 应验证权限 |

- **修复建议**: 公开 channel（如 system-status）无需认证，私有 channel 需要有效 token

---

## 三、🟡 Warning 问题测试计划（32 项）

### 3.1 类型安全（7 项）

| ID | 文件 | 问题 | 测试策略 |
|----|------|------|---------|
| W-TS-01 | `project-handlers.ts:14` | 13 处 `args as any` | 为每个 handler 添加输入类型验证测试，传入错误类型参数验证行为 |
| W-TS-02 | `workflow-engine.module.ts:38,56` | `as any` 绕过 ModuleContext | 测试传入非预期类型时的运行时行为 |
| W-TS-03 | `workflows-router.ts:79,111` | `dto as any` 绕过 Zod 验证 | 测试 Zod schema 能否正确拒绝非法输入 |
| W-TS-04 | `backup/route.ts:38,98` | `(prisma as any)[table]` 动态访问 | 测试传入不存在的表名时的行为 |
| W-TS-05 | `auth.service.ts:178` | `as any` 绕过密码哈希类型 | 测试 changePassword 的边界条件 |
| W-TS-06 | `kernel.ts:109` | `db: {} as any` 占位符 | 测试 kernel.db 为空对象时的所有调用路径 |
| W-TS-07 | `registry.ts:198` | createContext 三个 `as any` | 测试 createContext 返回的对象是否符合预期接口 |

**统一测试文件**: `tests/modules/type-safety/type-assertions.test.ts`

### 3.2 错误处理（16 项）

| ID | 文件:行 | 问题 | 测试策略 |
|----|---------|------|---------|
| W-EH-01 | `use-sse.ts:85` | onmessage JSON.parse 空 catch | 发送非法 JSON SSE 消息，验证无崩溃但应有日志 |
| W-EH-02 | `use-sse.ts:105` | 自定义事件 JSON.parse 空 catch | 发送非法 JSON 自定义事件 |
| W-EH-03 | `backup/route.ts:43` | findMany 空 catch | Mock Prisma 抛错，验证返回空数组 |
| W-EH-04 | `send-notification.ts:27` | SSE 广播空 catch | Mock SSE service 抛错 |
| W-EH-05 | `condition.ts:51` | 表达式求值空 catch | 传入导致异常的表达式 |
| W-EH-06 | `workflow-parser.ts:258,353,366,397,409,523` | 6 处 JSON.parse 空 catch | 传入非法 JSON 配置 |
| W-EH-07 | `rule-engine.ts:56,119,181` | 3 处规则评估空 catch | Mock 规则评估抛错 |
| W-EH-08 | `notification-integration.ts:82` | unsubscribe 空 catch | Mock unsubscribe 抛错 |
| W-EH-09 | `feedback-module.ts:249` | SOLO Bridge 空 catch | Mock SOLO Bridge 抛错 |
| W-EH-10 | `feedback-module.ts:497` | SSE 广播空 catch | Mock SSE 抛错 |
| W-EH-11 | `plugin-loader.ts:120` | 插件加载空 catch | Mock 插件加载抛错 |
| W-EH-12 | `webhook.adapter.ts:124` | Webhook 处理空 catch | Mock webhook 处理抛错 |
| W-EH-13 | `projects/page.tsx:82` | 前端 catch 空 ignore | Mock API 失败，验证用户看到错误提示 |
| W-EH-14 | `api/v1/route.ts:38` | readBody JSON.parse 空 catch | 发送非法 JSON body |
| W-EH-15 | `auth.service.ts:129` | verifyToken 空 catch | 传入格式错误的 token |
| W-EH-16 | `sse.service.ts:233` | destroy controller.close 空 catch | Mock controller 抛错 |

**统一测试策略**: 对每个空 catch，验证：(1) 不会抛出未捕获异常 (2) 有日志记录（或应添加）(3) 返回合理的 fallback 值

### 3.3 内存泄漏（5 项）

| ID | 文件:行 | 问题 | 测试策略 |
|----|---------|------|---------|
| W-ML-01 | `sse/route.ts:30` | abort 监听器未 removeEventListener | 创建并销毁 1000 个 SSE 连接，检查内存增长 |
| W-ML-02 | `trigger-dispatcher.ts:72` | unregisterWorkflowTrigger 清理逻辑缺陷 | 注册 3 个 workflow 的触发器，注销第 2 个，验证第 1 和 3 仍正常 |
| W-ML-03 | `notifications/rule-engine.ts:84` | start() 注册 8 个监听器无 stop() | 创建并销毁 RuleEngine 10 次，检查监听器数量 |
| W-ML-04 | `mcp/route.ts:86` | MCP sessions Map 无过期清理 | 创建 1000 个 session，验证内存不被释放 |
| W-ML-05 | `workflow-engine.module.ts:86` | disable() 为空实现 | 调用 disable 后验证资源被清理 |

**统一测试文件**: `tests/modules/memory-leaks/leak-detection.test.ts`

### 3.4 性能问题（7 项）

| ID | 文件:行 | 问题 | 测试策略 |
|----|---------|------|---------|
| W-PF-01 | `foreach.ts:31` | 串行 for 循环 await | 传入 100 元素数组，测量执行时间，对比 Promise.all |
| W-PF-02 | `improvement-loop.ts:54` | 无 limit 的数据库查询 | 创建 10000 条 FeedbackCheckpoint，验证查询性能 |
| W-PF-03 | `observability.ts:75,90,118` | Array.shift() O(n) | 连续调用 10000 次 recordStepMetric，测量耗时 |
| W-PF-04 | `project-handlers.ts:131` | get_project 无分页查询 | 创建 5000 个任务，验证 get_project 响应时间 |
| W-PF-05 | `project-handlers.ts:196` | tag 串行 upsert | 创建 20 个 tag，测量总耗时 |
| W-PF-06 | `approval.ts:17` | 每次创建新 PrismaClient | 连续执行 100 次 approval 步骤，检查连接数 |
| W-PF-07 | `workflows-router.ts:15` | PrismaClient 实例无复用 | 多次调用 getWorkflowService，验证实例数量 |

**统一测试文件**: `tests/modules/performance/performance-benchmarks.test.ts`

---

## 四、🔵 Suggestion 问题测试计划（25 项）

### 4.1 硬编码常量（12 项）

| ID | 文件:行 | 硬编码值 | 测试策略 |
|----|---------|---------|---------|
| S-HC-01 | `workflow-engine.module.ts:44` | 超时 30000ms | 验证超时值可通过配置覆盖 |
| S-HC-02 | `improvement-loop.ts:308` | SOLO 超时 60000ms | 同上 |
| S-HC-03 | `feedback-module.ts:401` | 审批超时 300000ms + 轮询 2000ms | 同上 |
| S-HC-04 | `approval.ts:13` | 审批超时 300000ms + 轮询 3000ms | 验证与 feedback-module 一致性 |
| S-HC-05 | `invoke-agent.ts:19` | Agent 超时 120000ms | 验证超时值可配置 |
| S-HC-06 | `solo-bridge.ts:22` | maxRecords 1000 | 验证限制生效 |
| S-HC-07 | `solo-bridge.ts:158` | 过期阈值 30min | 验证过期清理 |
| S-HC-08 | `observability.ts:19` | maxEntries 10000 | 验证上限截断 |
| S-HC-09 | `trigger-dispatcher.ts:176` | Cron 间隔 60000ms | 验证间隔可配置 |
| S-HC-10 | `schedule-advisor.ts:93` | 硬编码日期 '2026-04-28' | 验证日期使用动态值 |
| S-HC-11 | `rate-limiter.ts:112` | 速率限制配置 | 验证可通过环境变量覆盖 |
| S-HC-12 | `headers.ts:39` + `cors.ts:27` | HSTS/CORS maxAge | 验证可通过配置覆盖 |

**统一测试文件**: `tests/modules/config/hardcoded-values.test.ts`

### 4.2 边界条件（8 项）

| ID | 文件:行 | 问题 | 测试策略 |
|----|---------|------|---------|
| S-BC-01 | `workflow-parser.ts:327` | phase 不在 phaseOrder 中时 indexOf 返回 -1 | 传入 phase='unknown'，验证 overallProgress 不为负数 |
| S-BC-02 | `improvement-loop.ts:87` | rating 为 0 被过滤 | 创建 rating=0 的 checkpoint，验证统计准确性 |
| S-BC-03 | `concurrency.ts:140` | per-workflow 限制阻塞全局队列 | 注册 workflow A（限制 1），workflow B（无限制），验证 B 不被阻塞 |
| S-BC-04 | `foreach.ts:43` | 只执行 subSteps[0] | 配置 3 个子步骤，验证全部执行 |
| S-BC-05 | `approval.ts:69` | intervention 非 JSON 时 JSON.parse 抛错 | 设置 intervention 为非 JSON 字符串 |
| S-BC-06 | `context.ts:106` | get('') 空路径 | 调用 get('')，验证返回值 |
| S-BC-07 | `project-handlers.ts:370` | limit=0 时返回空 | 调用 get_activity_log({limit: 0}) |
| S-BC-08 | `observability.ts:288` + `improvement-loop.ts:331` | generateId 碰撞风险 | 并发生成 10000 个 ID，验证唯一性 |

**统一测试文件**: `tests/modules/boundary-conditions/edge-cases.test.ts`

### 4.3 MCP 使用问题（5 项）

| ID | 问题 | 测试策略 |
|----|------|---------|
| S-MCP-01 | 任务状态未自动更新 | 通过 MCP 创建任务 → 完成 → 验证 completionRate |
| S-MCP-02 | 重复任务创建 | 同名创建两次，验证行为 |
| S-MCP-03 | log_activity 响应格式不一致 | 批量调用 log_activity，验证响应格式 |
| S-MCP-04 | 活动日志未关联 taskId | 记录活动时传入 taskId，验证关联 |
| S-MCP-05 | 进度计算矛盾 | 推进阶段但不更新任务，验证 overallProgress vs completionRate |

**统一测试文件**: `tests/modules/mcp-server/mcp-workflow.test.ts`

---

## 五、已修复问题回归测试计划

### 5.1 v1 已修复的 5 个问题

| ID | 原问题 | 回归测试 |
|----|--------|---------|
| R-01 | task.repository findMany 状态过滤 | `findMany({status: ['in_progress']})` 应只返回 in_progress 状态的任务 |
| R-02 | ConditionStep with()+strict mode | 条件表达式 `'true'` 应返回 true |
| R-03 | WorkflowValidator 空值守卫 | `validate({steps: undefined})` 应返回错误而非崩溃 |
| R-04 | PluginManifest 缺 version | 所有测试文件中 PluginManifest 都包含 version 字段 |
| R-05 | 测试文件类型错误 | `npx tsc --noEmit` 应返回 0 个错误 |

### 5.2 MCP 工具名冲突修复

| ID | 原问题 | 回归测试 |
|----|--------|---------|
| R-06 | create_task 重复注册 | MCP initialize 后 tools/list 应包含 create_task 和 project_create_task |

---

## 六、新增测试文件清单

| # | 测试文件 | 覆盖问题 | 预估用例数 |
|---|---------|---------|-----------|
| 1 | `tests/modules/security/jwt-secret.test.ts` | C-01 | 5 |
| 2 | `tests/modules/security/default-admin.test.ts` | C-02 | 5 |
| 3 | `tests/modules/security/code-injection.test.ts` | C-03 | 8 |
| 4 | `tests/api/backup-auth.test.ts` | C-04 | 6 |
| 5 | `tests/api/sse-auth.test.ts` | C-05 | 5 |
| 6 | `tests/modules/type-safety/type-assertions.test.ts` | W-TS-01~07 | 14 |
| 7 | `tests/modules/error-handling/empty-catch.test.ts` | W-EH-01~16 | 32 |
| 8 | `tests/modules/memory-leaks/leak-detection.test.ts` | W-ML-01~05 | 15 |
| 9 | `tests/modules/performance/performance-benchmarks.test.ts` | W-PF-01~07 | 14 |
| 10 | `tests/modules/config/hardcoded-values.test.ts` | S-HC-01~12 | 24 |
| 11 | `tests/modules/boundary-conditions/edge-cases.test.ts` | S-BC-01~08 | 16 |
| 12 | `tests/modules/mcp-server/mcp-workflow.test.ts` | S-MCP-01~05 | 10 |
| 13 | `tests/regression/v1-fixes.test.ts` | R-01~06 | 12 |
| **合计** | | | **166** |

---

## 七、执行优先级

### Phase 1: Critical 安全测试（最高优先级）

```
C-01 → C-02 → C-03 → C-04 → C-05
```
预计新增 29 个测试用例，5 个测试文件

### Phase 2: Warning 回归 + 错误处理

```
R-01~06 → W-EH-01~16 → W-TS-01~07
```
预计新增 62 个测试用例，4 个测试文件

### Phase 3: 内存泄漏 + 性能

```
W-ML-01~05 → W-PF-01~07
```
预计新增 29 个测试用例，2 个测试文件

### Phase 4: Suggestion 优化

```
S-HC-01~12 → S-BC-01~08 → S-MCP-01~05
```
预计新增 50 个测试用例，3 个测试文件

### 总计

- 新增测试文件: 13 个
- 新增测试用例: ~166 个
- 加上现有 1107 个 = **总计 ~1273 个测试用例**

---

## 八、测试报告模板

每个 Phase 完成后，生成如下格式的测试报告：

```markdown
## Phase X 测试报告

### 测试环境
- Node.js: vXX
- 数据库: SQLite (in-memory)
- 测试框架: Vitest

### 测试结果
| 文件 | 用例数 | 通过 | 失败 | 跳过 |
|------|--------|------|------|------|
| ... | ... | ... | ... | ... |

### 发现的新问题
| ID | 严重度 | 文件 | 描述 |
|----|--------|------|------|
| ... | ... | ... | ... |

### 修复验证
| 原问题 ID | 修复状态 | 验证结果 |
|-----------|---------|---------|
| ... | ✅/❌ | ... |

### 代码覆盖率
- 行覆盖率: XX%
- 分支覆盖率: XX%
- 函数覆盖率: XX%
```

---

## 九、验收标准

### 通过标准

- [ ] 所有 Critical 问题有对应测试用例
- [ ] 所有 Warning 问题有对应测试用例
- [ ] 所有 Suggestion 问题有对应测试用例
- [ ] 全量测试通过率 100%
- [ ] TypeScript 类型错误 0 个
- [ ] Next.js 构建成功
- [ ] HF Spaces 部署成功

### 修复优先级

1. **Phase 1 完成后立即修复** Critical 安全问题
2. **Phase 2 完成后修复** Warning 级别的错误处理和类型安全问题
3. **Phase 3 完成后修复** 内存泄漏和性能问题
4. **Phase 4 完成后评估** Suggestion 是否需要修复

---

## 十、附录：完整问题索引

### Critical (5)

| ID | 模块 | 文件 | 行 | 问题 |
|----|------|------|----|------|
| C-01 | Auth | auth.service.ts | 28 | JWT 密钥硬编码默认值 |
| C-02 | tRPC | server.ts | 53 | 默认管理员 admin/admin |
| C-03 | Workflow | condition.ts | 49 | new Function() 代码注入 |
| C-04 | API | backup/route.ts | 16 | 备份 API 无认证 |
| C-05 | API | sse/route.ts | 14 | SSE 端点无认证 |

### Warning - 类型安全 (7)

| ID | 文件 | 行 | 问题 |
|----|------|----|------|
| W-TS-01 | project-handlers.ts | 14 | 13 处 args as any |
| W-TS-02 | workflow-engine.module.ts | 38,56 | ModuleContext as any |
| W-TS-03 | workflows-router.ts | 79,111 | dto as any |
| W-TS-04 | backup/route.ts | 38,98 | prisma as any 动态访问 |
| W-TS-05 | auth.service.ts | 178 | passwordHash as any |
| W-TS-06 | kernel.ts | 109 | db: {} as any 占位符 |
| W-TS-07 | registry.ts | 198 | createContext as any |

### Warning - 错误处理 (16)

| ID | 文件 | 行 | 问题 |
|----|------|----|------|
| W-EH-01 | use-sse.ts | 85 | onmessage JSON.parse 空 catch |
| W-EH-02 | use-sse.ts | 105 | 自定义事件 JSON.parse 空 catch |
| W-EH-03 | backup/route.ts | 43 | findMany 空 catch |
| W-EH-04 | send-notification.ts | 27 | SSE 广播空 catch |
| W-EH-05 | condition.ts | 51 | 表达式求值空 catch |
| W-EH-06 | workflow-parser.ts | 258+ | 6 处 JSON.parse 空 catch |
| W-EH-07 | rule-engine.ts | 56,119,181 | 3 处规则评估空 catch |
| W-EH-08 | notification-integration.ts | 82 | unsubscribe 空 catch |
| W-EH-09 | feedback-module.ts | 249 | SOLO Bridge 空 catch |
| W-EH-10 | feedback-module.ts | 497 | SSE 广播空 catch |
| W-EH-11 | plugin-loader.ts | 120 | 插件加载空 catch |
| W-EH-12 | webhook.adapter.ts | 124 | Webhook 处理空 catch |
| W-EH-13 | projects/page.tsx | 82 | 前端 catch 空 ignore |
| W-EH-14 | api/v1/route.ts | 38 | readBody JSON.parse 空 catch |
| W-EH-15 | auth.service.ts | 129 | verifyToken 空 catch |
| W-EH-16 | sse.service.ts | 233 | destroy 空 catch |

### Warning - 内存泄漏 (5)

| ID | 文件 | 行 | 问题 |
|----|------|----|------|
| W-ML-01 | sse/route.ts | 30 | abort 监听器未清理 |
| W-ML-02 | trigger-dispatcher.ts | 72 | unregister 清理逻辑缺陷 |
| W-ML-03 | notifications/rule-engine.ts | 84 | start() 无 stop() |
| W-ML-04 | mcp/route.ts | 86 | sessions Map 无过期清理 |
| W-ML-05 | workflow-engine.module.ts | 86 | disable() 空实现 |

### Warning - 性能 (7)

| ID | 文件 | 行 | 问题 |
|----|------|----|------|
| W-PF-01 | foreach.ts | 31 | 串行 await 循环 |
| W-PF-02 | improvement-loop.ts | 54 | 无 limit 查询 |
| W-PF-03 | observability.ts | 75,90,118 | Array.shift() O(n) |
| W-PF-04 | project-handlers.ts | 131 | 无分页查询 |
| W-PF-05 | project-handlers.ts | 196 | tag 串行 upsert |
| W-PF-06 | approval.ts | 17 | 重复创建 PrismaClient |
| W-PF-07 | workflows-router.ts | 15 | PrismaClient 无复用 |

### Suggestion - 硬编码 (12)

| ID | 文件 | 行 | 硬编码值 |
|----|------|----|---------|
| S-HC-01 | workflow-engine.module.ts | 44 | 超时 30000ms |
| S-HC-02 | improvement-loop.ts | 308 | SOLO 超时 60000ms |
| S-HC-03 | feedback-module.ts | 401 | 审批超时 300000ms + 轮询 2000ms |
| S-HC-04 | approval.ts | 13 | 审批超时 300000ms + 轮询 3000ms |
| S-HC-05 | invoke-agent.ts | 19 | Agent 超时 120000ms |
| S-HC-06 | solo-bridge.ts | 22 | maxRecords 1000 |
| S-HC-07 | solo-bridge.ts | 158 | 过期阈值 30min |
| S-HC-08 | observability.ts | 19 | maxEntries 10000 |
| S-HC-09 | trigger-dispatcher.ts | 176 | Cron 间隔 60000ms |
| S-HC-10 | schedule-advisor.ts | 93 | 日期 '2026-04-28' |
| S-HC-11 | rate-limiter.ts | 112 | 速率限制配置 |
| S-HC-12 | headers.ts:39 + cors.ts:27 | HSTS/CORS maxAge |

### Suggestion - 边界条件 (8)

| ID | 文件 | 行 | 问题 |
|----|------|----|------|
| S-BC-01 | workflow-parser.ts | 327 | phase 不在 phaseOrder 中 |
| S-BC-02 | improvement-loop.ts | 87 | rating=0 被过滤 |
| S-BC-03 | concurrency.ts | 140 | per-workflow 限制阻塞全局 |
| S-BC-04 | foreach.ts | 43 | 只执行 subSteps[0] |
| S-BC-05 | approval.ts | 69 | intervention 非 JSON |
| S-BC-06 | context.ts | 106 | get('') 空路径 |
| S-BC-07 | project-handlers.ts | 370 | limit=0 返回空 |
| S-BC-08 | observability.ts:288 + improvement-loop.ts:331 | ID 碰撞风险 |

### Suggestion - MCP 使用 (5)

| ID | 问题 | 详情 |
|----|------|------|
| S-MCP-01 | 任务状态未自动更新 | completionRate 为 0% |
| S-MCP-02 | 重复任务创建 | 同名任务可重复创建 |
| S-MCP-03 | log_activity 响应格式不一致 | 有时返回非 JSON |
| S-MCP-04 | 活动日志未关联 taskId | taskId 为 null |
| S-MCP-05 | 进度计算矛盾 | overallProgress vs completionRate |

### 回归测试 (6)

| ID | 原问题 | 验证点 |
|----|--------|--------|
| R-01 | findMany 状态过滤 | status 过滤不被覆盖 |
| R-02 | ConditionStep with() | 表达式正常求值 |
| R-03 | WorkflowValidator 空值守卫 | undefined steps 不崩溃 |
| R-04 | PluginManifest version | 测试文件类型正确 |
| R-05 | 测试文件类型错误 | tsc 0 错误 |
| R-06 | MCP 工具名冲突 | tools/list 包含两个工具 |
