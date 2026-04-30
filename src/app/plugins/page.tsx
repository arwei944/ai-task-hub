'use client';

import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/lib/trpc/client';
import { APP_VERSION } from '@/lib/core/version';

interface Plugin {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  version: string;
  author: string | null;
  isEnabled: boolean;
  installedAt: string;
  settings: Record<string, unknown> | null;
}

export default function PluginsPage() {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInstall, setShowInstall] = useState(false);
  const [installForm, setInstallForm] = useState({
    name: '',
    displayName: '',
    description: '',
    version: APP_VERSION,
    author: '',
    entryPoint: '',
  });
  const [error, setError] = useState('');

  const fetchPlugins = useCallback(async () => {
    try {
      const result = await trpc.plugins.list.query();
      setPlugins(result as unknown as Plugin[]);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    fetchPlugins().finally(() => setLoading(false));
  }, [fetchPlugins]);

  const handleToggle = async (plugin: Plugin) => {
    try {
      if (plugin.isEnabled) {
        await trpc.plugins.disable.mutate({ name: plugin.name });
      } else {
        await trpc.plugins.enable.mutate({ name: plugin.name });
      }
      await fetchPlugins();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUninstall = async (name: string) => {
    try {
      await trpc.plugins.uninstall.mutate({ name });
      await fetchPlugins();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleInstall = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await trpc.plugins.install.mutate(installForm);
      setShowInstall(false);
      setInstallForm({ name: '', displayName: '', description: '', version: APP_VERSION, author: '', entryPoint: '' });
      await fetchPlugins();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6 flex items-center justify-center text-gray-400">加载中...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">🔌 插件管理</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">管理和扩展系统功能</p>
          </div>
          <button
            onClick={() => setShowInstall(!showInstall)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            {showInstall ? '取消' : '+ 安装插件'}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
            {error}
            <button onClick={() => setError('')} className="ml-2 underline">关闭</button>
          </div>
        )}

        {/* Install Form */}
        {showInstall && (
          <form onSubmit={handleInstall} className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-5 mb-6 space-y-4">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">安装新插件</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">插件名称 *</label>
                <input
                  type="text"
                  value={installForm.name}
                  onChange={(e) => setInstallForm({ ...installForm, name: e.target.value })}
                  required
                  placeholder="e.g., hello-world"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">显示名称 *</label>
                <input
                  type="text"
                  value={installForm.displayName}
                  onChange={(e) => setInstallForm({ ...installForm, displayName: e.target.value })}
                  required
                  placeholder="e.g., Hello World"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">入口文件 *</label>
                <input
                  type="text"
                  value={installForm.entryPoint}
                  onChange={(e) => setInstallForm({ ...installForm, entryPoint: e.target.value })}
                  required
                  placeholder="e.g., ./plugins/hello-world/index.ts"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">作者</label>
                <input
                  type="text"
                  value={installForm.author}
                  onChange={(e) => setInstallForm({ ...installForm, author: e.target.value })}
                  placeholder="e.g., Your Name"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">描述</label>
              <textarea
                value={installForm.description}
                onChange={(e) => setInstallForm({ ...installForm, description: e.target.value })}
                rows={2}
                placeholder="插件功能描述..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                安装
              </button>
              <button type="button" onClick={() => setShowInstall(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                取消
              </button>
            </div>
          </form>
        )}

        {/* Plugin List */}
        <div className="space-y-3">
          {plugins.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-8 text-center">
              <div className="text-4xl mb-3">🔌</div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">暂无插件</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">点击上方"安装插件"按钮来添加新插件</p>
            </div>
          ) : (
            plugins.map((plugin) => (
              <div
                key={plugin.id}
                className={`bg-white dark:bg-gray-900 rounded-xl shadow-sm border p-5 transition-opacity ${
                  plugin.isEnabled
                    ? 'border-gray-200 dark:border-gray-800'
                    : 'border-gray-200 dark:border-gray-800 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">{plugin.displayName}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                        v{plugin.version}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        plugin.isEnabled
                          ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                      }`}>
                        {plugin.isEnabled ? '已启用' : '已禁用'}
                      </span>
                    </div>
                    {plugin.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{plugin.description}</p>
                    )}
                    <div className="flex gap-4 mt-2 text-xs text-gray-400">
                      <span>包名: {plugin.name}</span>
                      {plugin.author && <span>作者: {plugin.author}</span>}
                      <span>安装于: {new Date(plugin.installedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleToggle(plugin)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        plugin.isEnabled
                          ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:hover:bg-yellow-900'
                          : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-950 dark:text-green-300 dark:hover:bg-green-900'
                      }`}
                    >
                      {plugin.isEnabled ? '禁用' : '启用'}
                    </button>
                    <button
                      onClick={() => handleUninstall(plugin.name)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900 transition-colors"
                    >
                      卸载
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
