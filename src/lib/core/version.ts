// ============================================================
// AI Task Hub - Centralized Version Management
// ============================================================
// 单一版本源 (Single Source of Truth)
// 所有版本号必须从此文件导入，禁止硬编码
// 更新版本时只需修改此文件 + package.json
// ============================================================

// ---- 应用版本 ----
// 主版本号 (与 package.json 保持同步)
// 注意: 不能使用 fs 读取 package.json，因为此文件会被客户端组件导入
export const APP_VERSION: string = '3.1.0';

/** 应用名称 */
export const APP_NAME: string = 'AI Task Hub';

/** 应用代号 */
export const APP_CODENAME: string = 'Kernel Reborn';

// ---- 模块版本 ----
// 所有模块统一使用应用版本号，不再单独维护
// 模块版本跟随应用版本发布
export function getModuleVersion(): string {
  return APP_VERSION;
}

// ---- 版本信息工具函数 ----

/** 获取完整版本字符串 */
export function getFullVersionString(): string {
  return `${APP_NAME} v${APP_VERSION} (${APP_CODENAME})`;
}

/** 获取版本信息对象 */
export function getVersionInfo(): {
  name: string;
  version: string;
  codename: string;
  fullString: string;
} {
  return {
    name: APP_NAME,
    version: APP_VERSION,
    codename: APP_CODENAME,
    fullString: getFullVersionString(),
  };
}

/** 语义化版本解析 */
export function parseSemver(version: string): {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
  build?: string;
} | null {
  const match = version.match(
    /^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9.]+))?(?:\+([a-zA-Z0-9.]+))?$/
  );
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4],
    build: match[5],
  };
}

/** 比较两个语义化版本，返回 -1 / 0 / 1 */
export function compareVersions(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return 0;

  if (pa.major !== pb.major) return pa.major > pb.major ? 1 : -1;
  if (pa.minor !== pb.minor) return pa.minor > pb.minor ? 1 : -1;
  if (pa.patch !== pb.patch) return pa.patch > pb.patch ? 1 : -1;

  // prerelease: 有 prerelease 的版本低于没有的
  if (pa.prerelease && !pb.prerelease) return -1;
  if (!pa.prerelease && pb.prerelease) return 1;
  if (pa.prerelease && pb.prerelease) {
    return pa.prerelease < pb.prerelease ? -1 : pa.prerelease > pb.prerelease ? 1 : 0;
  }

  return 0;
}

/** 检查是否为预发布版本 */
export function isPrerelease(version: string): boolean {
  const parsed = parseSemver(version);
  return parsed !== null && !!parsed.prerelease;
}

/** 检查是否为稳定版本 */
export function isStable(version: string): boolean {
  return !isPrerelease(version);
}

// ---- 版本历史（用于关于页面等展示） ----
// 此列表在每次版本发布时更新
export const VERSION_HISTORY: ReadonlyArray<{
  version: string;
  date: string;
  highlights: string[];
}> = [
  { version: '3.1.0', date: '2026-05-03', highlights: ['修复 5 个 P0 页面崩溃/错误', 'Ops 总览 null 安全保护', 'Settings 健康数据正确渲染', 'Integrations 服务正确注入', 'MCP 路由 GET/POST 导出', 'Dashboard 趋势图空数据提示', '登录密码可见性切换', '任务看板颜色区分', '项目空状态创建按钮'] },
  { version: '3.0.1', date: '2026-05-02', highlights: ['核心服务注册修复', 'JWT 全链路认证 (SSE + tRPC)', '骨架屏 + 自动刷新', '0 TS 错误 + 0 测试失败', '健康日志去重', 'HF 部署优化'] },
  { version: '3.0.0', date: '2026-05-02', highlights: ['v3 内核架构重构', 'AppKernel + 7 Capability', 'DI Container + 32 typed services', '运维面板 8 视图', '自愈系统 + 熔断器 + 死信队列', 'SSE 实时推送', 'JWT 全链路认证', '0 TS 错误 + 1936 测试通过'] },
  { version: '2.7.0', date: '2026-05-02', highlights: ['智能闭环', '可观测性真实数据', '反馈审批事件链', 'workflow.completed 载荷补全', 'ImprovementLoop 激活', 'SOLO 自省 Handler', 'Dashboard 全局视野', '5 个 AI Handler'] },
  { version: '2.6.0', date: '2026-05-02', highlights: ['taskId 别名', '通知规则持久化', 'BrowserPush 渠道', 'AI Handler 实例化', 'ruleEngine.start()'] },
  { version: '2.4.0-beta.1', date: '2026-04-30', highlights: ['出站 Webhook 重试机制', 'GitHub Issue 触发器', '通知管理前端页面', '通知历史 tRPC', '5 个新 MCP 工具', '162+ MCP 工具'] },
  { version: '2.4.0-alpha.2', date: '2026-04-30', highlights: ['7 个 AI 事件处理器', 'Email 通知渠道', 'Web Push 真实推送', '10 个新 MCP 工具', '157+ MCP 工具'] },
  { version: '2.4.0-alpha.1', date: '2026-04-30', highlights: ['SOLO Bridge Phase B', 'MCP/REST/Pull 真实客户端', '熔断器 + 健康检查', 'ai-analyze 优雅降级', '7 个 SOLO Bridge MCP 工具', '147+ MCP 工具'] },
  { version: '2.3.0', date: '2026-04-30', highlights: ['Workflow Evolution', '子工作流 + 动态步骤', '断点恢复', '通知偏好 + 去重', '部署管理页面', '120+ MCP 工具'] },
  { version: '2.2.0', date: '2026-04-30', highlights: ['Platform Pulse', '仪表盘增强', '通知规则持久化', 'EventBus DLQ', '出站 Webhook', '110+ MCP 工具'] },
  { version: '2.1.0', date: '2026-04-30', highlights: ['MCP 工具智能增强', 'Agent 提示模板系统', '部署管理模块', '87+ MCP 工具'] },
  { version: '2.0.0', date: '2026-04-30', highlights: ['AI 原生全流程平台', 'EventBus v2 事件驱动', '6 个新模块', '60+ MCP 工具'] },
  { version: '1.9.0', date: '2026-04-30', highlights: ['版本管理模块', 'Bug 修复', '文档'] },
  { version: '1.8.0', date: '2026-04-29', highlights: ['策略即代码', '可观测性', '反馈闭环'] },
  { version: '1.7.0', date: '2026-04-29', highlights: ['触发器系统', '高级步骤', '通知集成'] },
  { version: '1.6.0', date: '2026-04-29', highlights: ['SOLO 统一 AI 层', '反馈模块'] },
  { version: '1.5.0', date: '2026-04-29', highlights: ['单管理员免登录模式'] },
  { version: '1.4.0', date: '2026-04-29', highlights: ['关于页面', 'HF 持久化存储'] },
  { version: '1.3.0', date: '2026-04-28', highlights: ['工作流引擎', 'Web Push 通知'] },
  { version: '1.2.0', date: '2026-04-28', highlights: ['集成数据写入', '测试 schema 同步'] },
  { version: '1.1.0', date: '2026-04-28', highlights: ['安全加固', '48 个 API 权限管控'] },
  { version: '1.0.0', date: '2026-04-28', highlights: ['首次发布', '全功能上线'] },
];
