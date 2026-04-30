'use client';

import { useState } from 'react';
import { APP_VERSION } from '@/lib/core/version';

interface ApiEndpoint {
  method: 'query' | 'mutation';
  path: string;
  description: string;
  auth: 'public' | 'protected' | 'admin';
  input?: string;
}

const API_DOCS: Record<string, { description: string; endpoints: ApiEndpoint[] }> = {
  auth: {
    description: '用户认证与授权管理',
    endpoints: [
      { method: 'mutation', path: 'auth.register', description: '注册新用户', auth: 'public', input: '{ username, password, email, displayName }' },
      { method: 'mutation', path: 'auth.login', description: '用户登录', auth: 'public', input: '{ username, password }' },
      { method: 'mutation', path: 'auth.changePassword', description: '修改密码', auth: 'protected', input: '{ oldPassword, newPassword }' },
      { method: 'query', path: 'auth.me', description: '获取当前用户信息', auth: 'protected' },
      { method: 'query', path: 'auth.users', description: '获取用户列表', auth: 'admin' },
      { method: 'mutation', path: 'auth.updateRole', description: '更新用户角色', auth: 'admin', input: '{ userId, role }' },
    ],
  },
  tasks: {
    description: '任务 CRUD 与管理',
    endpoints: [
      { method: 'query', path: 'tasks.list', description: '获取任务列表', auth: 'public', input: '{ status?, priority?, type?, page?, limit? }' },
      { method: 'query', path: 'tasks.get', description: '获取单个任务详情', auth: 'public', input: '{ id }' },
      { method: 'mutation', path: 'tasks.create', description: '创建任务', auth: 'protected', input: '{ title, description?, priority?, type?, dueDate?, assignee?, parentTaskId? }' },
      { method: 'mutation', path: 'tasks.update', description: '更新任务', auth: 'protected', input: '{ id, ...updates }' },
      { method: 'mutation', path: 'tasks.delete', description: '删除任务', auth: 'protected', input: '{ id }' },
      { method: 'mutation', path: 'tasks.advanceStatus', description: '推进任务状态', auth: 'protected', input: '{ id, status }' },
      { method: 'mutation', path: 'tasks.addDependency', description: '添加任务依赖', auth: 'protected', input: '{ taskId, dependsOnId }' },
      { method: 'query', path: 'tasks.getHistory', description: '获取任务历史记录', auth: 'public', input: '{ taskId }' },
    ],
  },
  ai: {
    description: 'AI 智能分析引擎',
    endpoints: [
      { method: 'mutation', path: 'ai.extractTasks', description: '从文本提取任务', auth: 'protected', input: '{ text }' },
      { method: 'mutation', path: 'ai.analyze', description: 'AI 智能分析', auth: 'protected', input: '{ query }' },
      { method: 'mutation', path: 'ai.suggestSchedule', description: '排期建议', auth: 'protected', input: '{ taskIds?, dateRange? }' },
      { method: 'mutation', path: 'ai.autoDecompose', description: '自动拆解任务', auth: 'protected', input: '{ taskId }' },
      { method: 'query', path: 'ai.getAuditLogs', description: '获取 AI 调用日志', auth: 'admin', input: '{ page?, limit? }' },
    ],
  },
  agents: {
    description: '智能体协作管理',
    endpoints: [
      { method: 'query', path: 'agents.list', description: '获取智能体列表', auth: 'public' },
      { method: 'query', path: 'agents.get', description: '获取智能体详情', auth: 'public', input: '{ id }' },
      { method: 'mutation', path: 'agents.create', description: '创建智能体', auth: 'protected', input: '{ name, description?, capabilities?, config? }' },
      { method: 'mutation', path: 'agents.execute', description: '执行智能体操作', auth: 'protected', input: '{ agentId, action, params? }' },
      { method: 'query', path: 'agents.getOperationLogs', description: '获取操作日志', auth: 'admin', input: '{ agentId?, page?, limit? }' },
    ],
  },
  integrations: {
    description: '外部平台集成管理',
    endpoints: [
      { method: 'query', path: 'integrations.list', description: '获取集成列表', auth: 'public' },
      { method: 'query', path: 'integrations.get', description: '获取集成详情', auth: 'public', input: '{ type }' },
      { method: 'mutation', path: 'integrations.configure', description: '配置集成', auth: 'admin', input: '{ type, config }' },
      { method: 'mutation', path: 'integrations.test', description: '测试集成连接', auth: 'admin', input: '{ type }' },
      { method: 'mutation', path: 'integrations.toggle', description: '启用/禁用集成', auth: 'admin', input: '{ type, isActive }' },
    ],
  },
  notifications: {
    description: '通知系统管理',
    endpoints: [
      { method: 'query', path: 'notifications.list', description: '获取通知列表', auth: 'protected', input: '{ page?, limit?, isRead? }' },
      { method: 'mutation', path: 'notifications.markRead', description: '标记已读', auth: 'protected', input: '{ id }' },
      { method: 'mutation', path: 'notifications.markAllRead', description: '全部标记已读', auth: 'protected' },
      { method: 'query', path: 'notifications.unreadCount', description: '获取未读数量', auth: 'protected' },
      { method: 'query', path: 'notifications.channels', description: '获取通知渠道列表', auth: 'protected' },
    ],
  },
  stats: {
    description: '数据统计与分析',
    endpoints: [
      { method: 'query', path: 'stats.taskStats', description: '任务统计概览', auth: 'public' },
      { method: 'query', path: 'stats.dailyTrends', description: '每日趋势数据', auth: 'public', input: '{ days? }' },
      { method: 'query', path: 'stats.aiStats', description: 'AI 调用统计', auth: 'public' },
      { method: 'query', path: 'stats.systemStats', description: '系统概览', auth: 'public' },
      { method: 'query', path: 'stats.dashboard', description: '仪表盘综合数据', auth: 'public' },
    ],
  },
  plugins: {
    description: '插件生态管理',
    endpoints: [
      { method: 'query', path: 'plugins.list', description: '获取插件列表', auth: 'public' },
      { method: 'query', path: 'plugins.get', description: '获取插件详情', auth: 'public', input: '{ name }' },
      { method: 'mutation', path: 'plugins.install', description: '安装插件', auth: 'admin', input: '{ name, displayName, entryPoint, version?, author? }' },
      { method: 'mutation', path: 'plugins.enable', description: '启用插件', auth: 'admin', input: '{ name }' },
      { method: 'mutation', path: 'plugins.disable', description: '禁用插件', auth: 'admin', input: '{ name }' },
      { method: 'mutation', path: 'plugins.uninstall', description: '卸载插件', auth: 'admin', input: '{ name }' },
      { method: 'mutation', path: 'plugins.updateSettings', description: '更新插件设置', auth: 'admin', input: '{ name, settings }' },
      { method: 'query', path: 'plugins.getCustomTools', description: '获取插件自定义工具', auth: 'public' },
    ],
  },
  updater: {
    description: '系统热更新管理',
    endpoints: [
      { method: 'query', path: 'updater.status', description: '获取更新状态', auth: 'public' },
      { method: 'mutation', path: 'updater.checkForUpdate', description: '检查更新', auth: 'admin' },
      { method: 'mutation', path: 'updater.applyUpdate', description: '应用更新', auth: 'admin' },
    ],
  },
};

const authColors: Record<string, string> = {
  public: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  protected: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300',
  admin: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
};

const methodColors: Record<string, string> = {
  query: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  mutation: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
};

export default function ApiDocsPage() {
  const [search, setSearch] = useState('');
  const [expandedGroup, setExpandedGroup] = useState<string | null>('tasks');

  const filteredDocs = Object.entries(API_DOCS).map(([group, data]) => ({
    group,
    ...data,
    endpoints: data.endpoints.filter(
      (e) =>
        e.path.toLowerCase().includes(search.toLowerCase()) ||
        e.description.toLowerCase().includes(search.toLowerCase()),
    ),
  })).filter((g) => g.endpoints.length > 0);

  const totalEndpoints = Object.values(API_DOCS).reduce((sum, d) => sum + d.endpoints.length, 0);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">📖 API 文档</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            tRPC API 参考 · {totalEndpoints} 个端点 · 9 个路由组
          </p>
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索 API 端点..."
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>

        {/* Auth Legend */}
        <div className="flex gap-3 mb-6 text-xs">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Public</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" /> Protected</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Admin</span>
        </div>

        {/* API Groups */}
        <div className="space-y-4">
          {filteredDocs.map(({ group, description, endpoints }) => (
            <div key={group} className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
              <button
                onClick={() => setExpandedGroup(expandedGroup === group ? null : group)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-gray-100">
                    <span className="text-blue-600 dark:text-blue-400 mr-2">{group}</span>
                    {description}
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">{endpoints.length} 个端点</p>
                </div>
                <svg
                  className={`h-5 w-5 text-gray-400 transition-transform ${expandedGroup === group ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              {expandedGroup === group && (
                <div className="border-t border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
                  {endpoints.map((ep, i) => (
                    <div key={i} className="p-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-mono font-medium ${methodColors[ep.method]}`}>
                          {ep.method}
                        </span>
                        <code className="text-sm font-mono text-gray-900 dark:text-gray-100">{ep.path}</code>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${authColors[ep.auth]}`}>
                          {ep.auth}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1.5">{ep.description}</p>
                      {ep.input && (
                        <pre className="mt-2 p-2.5 bg-gray-50 dark:bg-gray-800 rounded-lg text-xs font-mono text-gray-700 dark:text-gray-300 overflow-x-auto">
                          {ep.input}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* REST API v1 - Universal AI API */}
        <div className="mt-8 bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-5">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">🌐 REST API v1 — 通用 AI 接口</h2>
          <p className="text-xs text-gray-400 mb-4">任何能发 HTTP 请求的 AI 都能用 · X-API-Key 认证 · 单端点多 action</p>

          <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3 mb-4 text-xs font-mono text-blue-700 dark:text-blue-300">
            <div className="font-bold mb-1"># 1. 注册 Agent（无需 API Key）</div>
            <div>POST /api/v1</div>
            <pre className="mt-1 bg-white dark:bg-gray-900 p-2 rounded text-gray-700 dark:text-gray-300 overflow-x-auto">
{`{
  "action": "register",
  "name": "My AI Agent",
  "clientType": "trae",  // trae/cursor/windsurf/vscode/claude/chatgpt/api
  "clientVersion": ${JSON.stringify(APP_VERSION)}
}`}
            </pre>
            <div className="mt-1 text-gray-500">{'→ 返回 apiKey，后续请求带上 X-API-Key: <your-key>'}</div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 mb-4 text-xs font-mono text-gray-700 dark:text-gray-300">
            <div className="font-bold mb-1"># 2. 创建项目</div>
            <div>POST /api/v1 &nbsp; Header: X-API-Key: ath_trae_xxx</div>
            <pre className="mt-1 bg-white dark:bg-gray-900 p-2 rounded overflow-x-auto">
{`{ "action": "create_project", "name": "任务管理面板", "techStack": ["Next.js", "Prisma"] }`}
            </pre>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 mb-4 text-xs font-mono text-gray-700 dark:text-gray-300">
            <div className="font-bold mb-1"># 3. 创建任务</div>
            <pre className="mt-1 bg-white dark:bg-gray-900 p-2 rounded overflow-x-auto">
{`{ "action": "create_task", "projectId": "xxx", "title": "实现用户认证",
  "phase": "implementation", "priority": "high" }`}
            </pre>
          </div>

          <div className="text-xs text-gray-500 font-medium mb-2">全部 action 列表：</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 text-xs">
            {[
              { a: 'register', d: '注册 Agent' },
              { a: 'create_project', d: '创建项目' },
              { a: 'update_project', d: '更新项目' },
              { a: 'get_project', d: '项目详情' },
              { a: 'list_projects', d: '列出项目' },
              { a: 'create_task', d: '创建任务' },
              { a: 'update_task', d: '更新任务' },
              { a: 'list_tasks', d: '列出任务' },
              { a: 'advance_phase', d: '推进阶段' },
              { a: 'log_activity', d: '记录活动' },
              { a: 'get_activities', d: '活动时间线' },
              { a: 'get_summary', d: '项目概览' },
            ].map(({ a, d }) => (
              <div key={a} className="flex gap-1.5 py-0.5">
                <code className="text-blue-600 dark:text-blue-400">{a}</code>
                <span className="text-gray-400">{d}</span>
              </div>
            ))}
          </div>
        </div>

        {/* System REST API */}
        <div className="mt-4 bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-5">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">🔌 系统 REST API</h2>
          <div className="space-y-2 text-sm">
            {[
              { method: 'GET', path: '/api/status', desc: '系统健康检查' },
              { method: 'GET', path: '/api/sse', desc: 'SSE 实时事件流' },
              { method: 'GET', path: '/api/mcp', desc: 'MCP 服务端（Streamable HTTP）' },
              { method: 'POST', path: '/api/webhook/[type]', desc: 'Webhook 接收器' },
              { method: 'GET', path: '/api/export/tasks', desc: '导出任务数据' },
              { method: 'GET', path: '/api/backup', desc: '全量数据备份' },
              { method: 'POST', path: '/api/backup', desc: '数据导入恢复' },
            ].map((ep, i) => (
              <div key={i} className="flex items-center gap-3 py-1.5">
                <span className="text-xs font-mono font-bold text-green-600 dark:text-green-400 w-12">{ep.method}</span>
                <code className="font-mono text-gray-900 dark:text-gray-100 flex-1">{ep.path}</code>
                <span className="text-gray-500 dark:text-gray-400 text-xs">{ep.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
