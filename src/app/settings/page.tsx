'use client';

import { useState, useEffect, useCallback } from 'react';

interface ModuleInfo {
  name: string;
  enabled: boolean;
}

interface HealthInfo {
  database: string;
  api: string;
  ai: string;
  mcp: string;
}

export default function SettingsPage() {
  const [modules, setModules] = useState<ModuleInfo[]>([]);
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      setModules(data.modules ?? []);
      setHealth(data.health ?? null);
    } catch (err) {
      console.error('Failed to fetch status:', err);
    }
  }, []);

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  const handleExport = async (format: string) => {
    try {
      const res = await fetch(`/api/export/tasks?format=${format}`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tasks_${new Date().toISOString().slice(0, 10)}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`导出失败: ${err.message}`);
    }
  };

  const moduleDescriptions: Record<string, { label: string; desc: string }> = {
    'task-core': { label: '任务核心', desc: '任务 CRUD、状态管理、依赖关系' },
    'ai-engine': { label: 'AI 引擎', desc: '任务提取、状态推断、智能分析' },
    'mcp-server': { label: 'MCP 服务', desc: 'MCP 协议服务端' },
    'agent-collab': { label: '智能体协作', desc: '智能体注册、权限管理' },
    'integration-github': { label: 'GitHub 集成', desc: 'GitHub Issues 同步' },
    'integration-feishu': { label: '飞书集成', desc: '飞书任务同步' },
    'integration-notion': { label: 'Notion 集成', desc: 'Notion 数据库同步' },
    'integration-webhook': { label: '通用 Webhook', desc: 'Webhook 接收与规则引擎' },
    'integration-telegram': { label: 'Telegram 集成', desc: 'Telegram Bot 双向操作 + 通知推送' },
    'integration-wechat': { label: '企业微信集成', desc: '企业微信 Bot 双向操作 + 通知推送' },
    'notifications': { label: '通知', desc: '事件驱动通知系统 (TG/微信/Webhook/浏览器推送)' },
    'dashboard': { label: '数据可视化', desc: '仪表盘与统计' },
    'module-updater': { label: '模块热更新', desc: '运行时模块热更新、版本管理与回滚' },
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">系统设置</h1>
          <p className="text-gray-500 mt-1">模块管理、数据导出、系统状态</p>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-400">加载中...</div>
        ) : (
          <div className="space-y-6">
            {/* System Health */}
            {health && (
              <div className="bg-white rounded-lg shadow-sm border p-4">
                <h2 className="font-semibold text-gray-900 mb-4">🏥 系统健康</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(health).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${value === 'ok' || value === 'configured' || value === 'available' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                      <div>
                        <div className="text-sm font-medium text-gray-900 capitalize">{key}</div>
                        <div className="text-xs text-gray-500">{String(value)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Module Management */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <h2 className="font-semibold text-gray-900 mb-4">📦 模块管理</h2>
              <p className="text-sm text-gray-500 mb-4">通过 <code className="bg-gray-100 px-1 rounded">config/modules.yaml</code> 配置文件管理模块启停</p>
              <div className="divide-y divide-gray-100">
                {modules.map((mod) => {
                  const info = moduleDescriptions[mod.name];
                  return (
                    <div key={mod.name} className="py-3 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 text-sm">{info?.label ?? mod.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${mod.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {mod.enabled ? '已启用' : '已禁用'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">{info?.desc ?? mod.name}</div>
                      </div>
                      <code className="text-xs text-gray-400">{mod.name}</code>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Data Export */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <h2 className="font-semibold text-gray-900 mb-4">📤 数据导出</h2>
              <p className="text-sm text-gray-500 mb-4">导出所有任务数据</p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleExport('csv')}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                >
                  导出 CSV
                </button>
                <button
                  onClick={() => handleExport('json')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  导出 JSON
                </button>
              </div>
            </div>

            {/* Environment Info */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <h2 className="font-semibold text-gray-900 mb-4">ℹ️ 环境信息</h2>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-gray-500">版本</div><div className="text-gray-900">v1.0.0</div>
                <div className="text-gray-500">框架</div><div className="text-gray-900">Next.js 16 + tRPC</div>
                <div className="text-gray-500">数据库</div><div className="text-gray-900">SQLite (Prisma)</div>
                <div className="text-gray-500">AI SDK</div><div className="text-gray-900">Vercel AI SDK</div>
                <div className="text-gray-500">MCP</div><div className="text-gray-900">MCP SDK v1.29</div>
                <div className="text-gray-500">测试</div><div className="text-gray-900">118+ tests passing</div>
                <div className="text-gray-500">集成</div><div className="text-gray-900">GitHub/飞书/Notion/Webhook/TG/微信</div>
                <div className="text-gray-500">热更新</div><div className="text-gray-900">模块热更新 + 版本管理</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
