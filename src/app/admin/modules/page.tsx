'use client';

import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/lib/trpc/client';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import {
  Box,
  RefreshCw,
  Power,
  PowerOff,
  RotateCcw,
  Search,
  Lock,
  Unlock,
  Boxes,
} from 'lucide-react';

interface ModuleRecord {
  id: string;
  name: string;
  version: string;
  description?: string;
  enabled: boolean;
  locked?: boolean;
  lastUpdated?: string;
}

export default function AdminModulesPage() {
  const [modules, setModules] = useState<ModuleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchModules = useCallback(async () => {
    try {
      setLoading(true);
      const data = await trpc.updater.listModules.query();
      const items = (data as Record<string, unknown>)?.modules ?? data;
      setModules((Array.isArray(items) ? items : []) as ModuleRecord[]);
    } catch (err) {
      console.error('Failed to fetch modules:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchModules(); }, [fetchModules]);

  const filteredModules = modules.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    (m.description ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const handleToggle = async (moduleId: string, currentState: boolean) => {
    setActionLoading(moduleId);
    try {
      if (currentState) {
        await trpc.updater.disableModule.mutate({ moduleId });
      } else {
        await trpc.updater.enableModule.mutate({ moduleId });
      }
      await fetchModules();
    } catch (err) {
      console.error('Failed to toggle module:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleHotReload = async (moduleId: string) => {
    setActionLoading(moduleId);
    try {
      await trpc.updater.hotReload.mutate({ moduleId });
      await fetchModules();
    } catch (err) {
      console.error('Failed to reload module:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const enabledCount = modules.filter((m) => m.enabled).length;
  const lockedCount = modules.filter((m) => m.locked).length;

  return (
    <div className="space-y-6">
      <Breadcrumb />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-950">
            <Boxes className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">模块管理</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              管理系统模块的启用、禁用和热重载
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {enabledCount}/{modules.length} 已启用 · {lockedCount} 锁定
          </span>
          <button
            onClick={fetchModules}
            disabled={loading}
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            title="刷新"
          >
            <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索模块..."
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      {/* Module Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full flex items-center justify-center py-12 text-gray-400">
            <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
            加载中...
          </div>
        ) : filteredModules.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-12 text-gray-400">
            <Box className="w-8 h-8 mb-2 opacity-50" />
            {search ? '未找到匹配模块' : '暂无模块'}
          </div>
        ) : (
          filteredModules.map((mod) => (
            <div
              key={mod.id}
              className={`border rounded-xl p-4 transition-colors ${
                mod.enabled
                  ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'
                  : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${mod.enabled ? 'bg-green-100 dark:bg-green-950' : 'bg-gray-100 dark:bg-gray-800'}`}>
                    <Box className={`w-4 h-4 ${mod.enabled ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`} />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm text-gray-900 dark:text-gray-100">{mod.name}</h3>
                    <span className="text-xs text-gray-400">v{mod.version}</span>
                  </div>
                </div>
                {mod.locked ? (
                  <Lock className="w-4 h-4 text-amber-500" title="核心模块（锁定）" />
                ) : (
                  <Unlock className="w-4 h-4 text-gray-300 dark:text-gray-600" />
                )}
              </div>

              {mod.description && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">
                  {mod.description}
                </p>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => !mod.locked && handleToggle(mod.id, mod.enabled)}
                  disabled={mod.locked || actionLoading === mod.id}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    mod.enabled
                      ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-950'
                      : 'text-green-600 hover:bg-green-50 dark:hover:bg-green-950'
                  } ${mod.locked ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {mod.enabled ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                  {mod.enabled ? '禁用' : '启用'}
                </button>
                <button
                  onClick={() => handleHotReload(mod.id)}
                  disabled={!mod.enabled || actionLoading === mod.id}
                  className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors ${
                    !mod.enabled ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  title="热重载"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${actionLoading === mod.id ? 'animate-spin' : ''}`} />
                  重载
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
