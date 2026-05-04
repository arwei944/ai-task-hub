# 更新日志

格式基于 [Keep a Changelog](https://keepachangelog.com/)，版本号遵循 [语义化版本](https://semver.org/)。

## [6.2.0] - 2026-05-04

### Changed
- **类型安全**：消除 ~86 处 `as any` 类型断言
  - 修复 PrismaClient 类型别名根源问题
  - 修复 IntegrationService ServiceRegistry 类型
  - 迁移所有 `container.resolve(token) as any` → `resolveService(container, token)`
  - 修复 tRPC 路由、工作流引擎、通知规则引擎等核心模块类型

### Fixed
- 认证失败静默降级为 admin 现在会记录警告日志
- URL 解析失败现在会记录警告日志
- 条件表达式求值失败现在会记录表达式内容和错误
- 工作流事件发射失败现在会记录事件类型
- 无效正则表达式现在会记录 pattern 内容
- REST/MCP 客户端健康检查失败现在会记录 debug 日志

## [6.1.0] - 2026-05-04

### Removed
- 删除脚手架残留模块 `src/lib/modules/example/`

### Added
- 侧边栏新增「反馈中心」导航入口

### Changed
- **导航修复**：移除死链 `/workspaces` 和未使用的 `morePages` 导出
- **tRPC 迁移**：feedback、notifications、ops 页面从 raw fetch 迁移到 tRPC client
- **CI 加固**：ESLint 失败不再被忽略；测试前自动初始化数据库

## [6.0.0] - 2026-05-04

### Added
- JWT 密钥持久化（重启后 token 不失效）
- adminProcedure 角色检查（非 admin 用户无法调用管理接口）
- CORS 白名单（默认仅允许 localhost）
- CSP 策略加固（移除 unsafe-eval）
- Webhook HMAC-SHA256 签名验证
- SSE 连接 Token 验证
- 安全 API Key 生成（使用 crypto.randomUUID）
- `.env.example` 环境变量文档
- `LICENSE` (MIT)
- 备份 API 输入验证（表名白名单 + 大小限制）

### Changed
- package.json license 字段从 ISC 更正为 MIT

## [5.6.0] - 2026-05-02

### Added
- v3 内核架构重构
  - AppKernel + 7 Capability 模块
  - DI Container + ServiceRegistry (32 个类型化服务)
  - EventBus (38+ 事件类型)
- 自愈系统（熔断器、死信队列、30s 周期健康检查）
- 8 视图运维面板
- MCP 工具 162+

## [2.7.0] - 2026-05-02

### Added
- 基础任务管理 CRUD
- tRPC API 路由
- Prisma ORM + SQLite
- 基础工作流引擎
- SSE 实时推送
- 插件系统框架
- Docker 部署支持

[6.2.0]: https://github.com/arwei944/ai-task-hub/compare/v6.1.0...v6.2.0
[6.1.0]: https://github.com/arwei944/ai-task-hub/compare/v6.0.0...v6.1.0
[6.0.0]: https://github.com/arwei944/ai-task-hub/compare/v5.6.0...v6.0.0
[5.6.0]: https://github.com/arwei944/ai-task-hub/compare/v2.7.0...v5.6.0
[2.7.0]: https://github.com/arwei944/ai-task-hub/releases/tag/v2.7.0
