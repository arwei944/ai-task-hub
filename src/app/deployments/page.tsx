'use client';

import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/lib/trpc/client';

interface Environment {
  id: string;
  name: string;
  displayName: string;
  baseUrl: string;
  isActive: boolean;
  healthStatus: string;
  lastDeploymentAt: Date | null;
  order: number;
}

interface Deployment {
  id: string;
  environmentId: string;
  environmentName: string;
  version: string;
  strategy: string;
  status: string;
  description: string | null;
  triggeredBy: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  duration: number | null;
  createdAt: Date;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  queued: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  building: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  deploying: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  verifying: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  running: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  rolled_back: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};

const HEALTH_COLORS: Record<string, string> = {
  healthy: 'bg-green-500',
  degraded: 'bg-yellow-500',
  unhealthy: 'bg-red-500',
  unknown: 'bg-gray-400',
};

const STRATEGY_LABELS: Record<string, string> = {
  rolling: '滚动更新',
  blue_green: '蓝绿部署',
  canary: '金丝雀',
  recreate: '重建部署',
};

export default function DeploymentsPage() {
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [selectedEnv, setSelectedEnv] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'deployments' | 'environments'>('overview');

  const fetchData = useCallback(async () => {
    try {
      const [envRes, depRes] = await Promise.all([
        fetch('/api/trpc/deployments.listEnvironments'),
        fetch('/api/trpc/deployments.listDeployments?input=' + encodeURIComponent(JSON.stringify({
          environmentId: selectedEnv || undefined,
          limit: 50,
        }))),
      ]);
      const envData = await envRes.json();
      const depData = await depRes.json();
      setEnvironments(envData?.result?.data ?? []);
      setDeployments(depData?.result?.data ?? []);
    } catch (err) {
      console.error('Failed to fetch deployment data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedEnv]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const summary = {
    total: deployments.length,
    running: deployments.filter(d => d.status === 'running').length,
    failed: deployments.filter(d => d.status === 'failed').length,
    healthy: environments.filter(e => e.healthStatus === 'healthy').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-500 dark:text-gray-400">加载中...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">部署管理</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">多环境部署、健康监控、回滚管理</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
        {(['overview', 'deployments', 'environments'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm rounded-md transition-colors ${
              activeTab === tab
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {tab === 'overview' ? '概览' : tab === 'deployments' ? '部署记录' : '环境管理'}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-5">
              <div className="text-sm text-gray-500 dark:text-gray-400">总部署数</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{summary.total}</div>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-5">
              <div className="text-sm text-gray-500 dark:text-gray-400">运行中</div>
              <div className="text-2xl font-bold text-green-600 mt-1">{summary.running}</div>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-5">
              <div className="text-sm text-gray-500 dark:text-gray-400">失败</div>
              <div className="text-2xl font-bold text-red-600 mt-1">{summary.failed}</div>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-5">
              <div className="text-sm text-gray-500 dark:text-gray-400">健康环境</div>
              <div className="text-2xl font-bold text-green-600 mt-1">{summary.healthy}/{environments.length}</div>
            </div>
          </div>

          {/* Environments Overview */}
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">环境状态</h2>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {environments.map(env => (
                <div key={env.id} className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${HEALTH_COLORS[env.healthStatus]}`} />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{env.displayName}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{env.baseUrl}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      env.isActive
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    }`}>
                      {env.isActive ? '活跃' : '停用'}
                    </span>
                    {env.lastDeploymentAt && (
                      <span className="text-gray-400 dark:text-gray-500 text-xs">
                        最后部署: {new Date(env.lastDeploymentAt).toLocaleString('zh-CN')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {environments.length === 0 && (
                <div className="px-6 py-8 text-center text-gray-400 dark:text-gray-500">
                  暂无环境配置，请通过 MCP 工具创建
                </div>
              )}
            </div>
          </div>

          {/* Recent Deployments */}
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">最近部署</h2>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {deployments.slice(0, 10).map(dep => (
                <div key={dep.id} className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[dep.status] || 'bg-gray-100 text-gray-600'}`}>
                      {dep.status}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        v{dep.version}
                        <span className="text-gray-400 dark:text-gray-500 font-normal ml-2">→ {dep.environmentName}</span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {STRATEGY_LABELS[dep.strategy] || dep.strategy}
                        {dep.triggeredBy && ` · ${dep.triggeredBy}`}
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-sm text-gray-500 dark:text-gray-400">
                    {dep.duration ? `${(dep.duration / 1000).toFixed(1)}s` : '-'}
                    <div className="text-xs">{new Date(dep.createdAt).toLocaleString('zh-CN')}</div>
                  </div>
                </div>
              ))}
              {deployments.length === 0 && (
                <div className="px-6 py-8 text-center text-gray-400 dark:text-gray-500">
                  暂无部署记录
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Deployments Tab */}
      {activeTab === 'deployments' && (
        <div className="space-y-4">
          {/* Filter */}
          <div className="flex gap-3">
            <select
              value={selectedEnv}
              onChange={e => setSelectedEnv(e.target.value)}
              className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white"
            >
              <option value="">全部环境</option>
              {environments.map(env => (
                <option key={env.id} value={env.id}>{env.displayName}</option>
              ))}
            </select>
          </div>

          {/* Deployment List */}
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {deployments.map(dep => (
                <div key={dep.id} className="px-6 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[dep.status] || ''}`}>
                        {dep.status}
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">v{dep.version}</span>
                      <span className="text-gray-400 dark:text-gray-500">→</span>
                      <span className="text-gray-600 dark:text-gray-400">{dep.environmentName}</span>
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {new Date(dep.createdAt).toLocaleString('zh-CN')}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                    <span>策略: {STRATEGY_LABELS[dep.strategy] || dep.strategy}</span>
                    {dep.duration && <span>耗时: {(dep.duration / 1000).toFixed(1)}s</span>}
                    {dep.triggeredBy && <span>触发者: {dep.triggeredBy}</span>}
                    {dep.description && <span className="truncate max-w-[200px]">{dep.description}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Environments Tab */}
      {activeTab === 'environments' && (
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">环境列表</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              通过 MCP 工具 <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs">create_environment</code> 创建新环境
            </p>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {environments.map(env => (
              <div key={env.id} className="px-6 py-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${HEALTH_COLORS[env.healthStatus]}`} />
                    <h3 className="font-semibold text-gray-900 dark:text-white">{env.displayName}</h3>
                    <span className="text-xs text-gray-400 dark:text-gray-500">({env.name})</span>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    env.isActive
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  }`}>
                    {env.isActive ? '活跃' : '停用'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-gray-400 dark:text-gray-500 text-xs">基础 URL</div>
                    <div className="text-gray-700 dark:text-gray-300 font-mono text-xs mt-1">{env.baseUrl}</div>
                  </div>
                  <div>
                    <div className="text-gray-400 dark:text-gray-500 text-xs">健康状态</div>
                    <div className="text-gray-700 dark:text-gray-300 mt-1 capitalize">{env.healthStatus}</div>
                  </div>
                  <div>
                    <div className="text-gray-400 dark:text-gray-500 text-xs">最后部署</div>
                    <div className="text-gray-700 dark:text-gray-300 mt-1">
                      {env.lastDeploymentAt ? new Date(env.lastDeploymentAt).toLocaleString('zh-CN') : '-'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
