'use client';

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc/client';

// Built-in plugin registry (simulated marketplace)
const MARKETPLACE_PLUGINS = [
  {
    name: 'hello-world',
    displayName: 'Hello World',
    description: '示例插件 - 注册一个问候工具',
    version: '1.0.0',
    author: 'AI Task Hub',
    entryPoint: './plugins/hello-world/index.ts',
    capabilities: ['task-tool'],
    category: '示例',
    downloads: 128,
    rating: 5.0,
  },
  {
    name: 'github-sync',
    displayName: 'GitHub 同步',
    description: '自动同步 GitHub Issues 到任务列表',
    version: '1.2.0',
    author: 'Community',
    entryPoint: './plugins/github-sync/index.ts',
    capabilities: ['data-source', 'task-tool'],
    category: '集成',
    downloads: 456,
    rating: 4.5,
  },
  {
    name: 'slack-notify',
    displayName: 'Slack 通知',
    description: '将任务变更推送到 Slack 频道',
    version: '1.0.1',
    author: 'Community',
    entryPoint: './plugins/slack-notify/index.ts',
    capabilities: ['notification'],
    category: '通知',
    downloads: 312,
    rating: 4.2,
  },
  {
    name: 'time-tracker',
    displayName: '时间追踪',
    description: '记录任务耗时，生成时间报告',
    version: '0.9.0',
    author: 'Community',
    entryPoint: './plugins/time-tracker/index.ts',
    capabilities: ['task-tool', 'export'],
    category: '效率',
    downloads: 89,
    rating: 4.0,
  },
  {
    name: 'calendar-view',
    displayName: '日历视图',
    description: '在仪表盘添加日历小组件',
    version: '1.1.0',
    author: 'Community',
    entryPoint: './plugins/calendar-view/index.ts',
    capabilities: ['dashboard-widget', 'ui-extension'],
    category: 'UI',
    downloads: 234,
    rating: 4.7,
  },
  {
    name: 'csv-export',
    displayName: 'CSV 导出',
    description: '将任务数据导出为 CSV 格式',
    version: '1.0.0',
    author: 'AI Task Hub',
    entryPoint: './plugins/csv-export/index.ts',
    capabilities: ['export'],
    category: '工具',
    downloads: 567,
    rating: 4.3,
  },
  {
    name: 'task-stats',
    displayName: 'Task Statistics',
    description: '提供任务统计工具，快速获取任务概览数据',
    version: '1.0.0',
    author: 'AI Task Hub',
    entryPoint: './plugins/task-stats/index.ts',
    capabilities: ['task-tool', 'data-source'],
    category: '工具',
    downloads: 234,
    rating: 4.5,
  },
  {
    name: 'event-logger',
    displayName: 'Event Logger',
    description: '记录和查询事件日志，用于调试和审计',
    version: '1.0.0',
    author: 'AI Task Hub',
    entryPoint: './plugins/event-logger/index.ts',
    capabilities: ['task-tool'],
    category: '工具',
    downloads: 178,
    rating: 4.3,
  },
];

const CATEGORIES = ['全部', '示例', '集成', '通知', '效率', 'UI', '工具'];

export default function PluginMarketPage() {
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState('全部');
  const [search, setSearch] = useState('');
  const [installing, setInstalling] = useState<string | null>(null);

  useEffect(() => {
    trpc.plugins.list.query().then((plugins: any) => {
      setInstalled(new Set(plugins.map((p: any) => p.name)));
    }).catch(() => {});
  }, []);

  const filtered = MARKETPLACE_PLUGINS.filter((p) => {
    if (category !== '全部' && p.category !== category) return false;
    if (search && !p.displayName.toLowerCase().includes(search.toLowerCase()) && !p.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleInstall = async (plugin: typeof MARKETPLACE_PLUGINS[0]) => {
    setInstalling(plugin.name);
    try {
      await trpc.plugins.install.mutate({
        name: plugin.name,
        displayName: plugin.displayName,
        description: plugin.description,
        version: plugin.version,
        author: plugin.author,
        entryPoint: plugin.entryPoint,
      });
      setInstalled((prev) => new Set([...prev, plugin.name]));
    } catch (err: any) {
      alert(err.message);
    }
    setInstalling(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">🏪 插件市场</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">发现和安装扩展功能</p>
        </div>

        {/* Search + Categories */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索插件..."
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <div className="flex gap-1.5 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  category === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Plugin Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((plugin) => {
            const isInstalled = installed.has(plugin.name);
            const isInstalling = installing === plugin.name;

            return (
              <div key={plugin.name} className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-5 flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{plugin.displayName}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">v{plugin.version} · {plugin.author}</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                    {plugin.category}
                  </span>
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 flex-1">{plugin.description}</p>

                <div className="flex gap-1.5 mb-3 flex-wrap">
                  {plugin.capabilities.map((cap) => (
                    <span key={cap} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                      {cap}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>⬇ {plugin.downloads}</span>
                    <span>⭐ {plugin.rating}</span>
                  </div>
                  <button
                    onClick={() => !isInstalled && handleInstall(plugin)}
                    disabled={isInstalled || isInstalling}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      isInstalled
                        ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300 cursor-default'
                        : isInstalling
                        ? 'bg-gray-100 text-gray-400 dark:bg-gray-800 cursor-wait'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {isInstalled ? '已安装' : isInstalling ? '安装中...' : '安装'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-2">🔍</div>
            <p>没有找到匹配的插件</p>
          </div>
        )}
      </div>
    </div>
  );
}
