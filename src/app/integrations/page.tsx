'use client';

import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/lib/trpc/client';

interface Integration {
  id: string;
  type: string;
  name: string;
  description: string | null;
  config: Record<string, unknown>;
  isActive: boolean;
  lastSyncAt: string | null;
  syncStatus: string;
  lastError: string | null;
  createdAt: string;
}

interface AdapterType {
  type: string;
  name: string;
}

export default function IntegrationsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [newIntegration, setNewIntegration] = useState({ type: '', name: '', description: '' });
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [adapterTypes, setAdapterTypes] = useState<AdapterType[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchIntegrations = useCallback(async () => {
    try {
      const data = await trpc.integrations.list.query();
      setIntegrations(data);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  }, []);

  const fetchAdapterTypes = useCallback(async () => {
    try {
      const types = await trpc.integrations.adapterTypes.query();
      setAdapterTypes(types);
    } catch (err: any) {
      console.error('Failed to fetch adapter types:', err);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchIntegrations(), fetchAdapterTypes()]).finally(() => setLoading(false));
  }, [fetchIntegrations, fetchAdapterTypes]);

  const handleCreate = async () => {
    if (!newIntegration.type || !newIntegration.name) return;
    try {
      await trpc.integrations.create.mutate({
        type: newIntegration.type,
        name: newIntegration.name,
        description: newIntegration.description || undefined,
        config: {},
      });
      setShowCreate(false);
      setNewIntegration({ type: '', name: '', description: '' });
      setMessage({ type: 'success', text: '集成创建成功' });
      await fetchIntegrations();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleToggle = async (integration: Integration) => {
    try {
      await trpc.integrations.update.mutate({ id: integration.id, isActive: !integration.isActive });
      await fetchIntegrations();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleTest = async (id: string) => {
    setTesting(id);
    try {
      const result = await trpc.integrations.testConnection.mutate({ id });
      setMessage({ type: result.success ? 'success' : 'error', text: result.success ? '连接成功！' : `连接失败: ${result.error}` });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setTesting(null);
    }
  };

  const handleSync = async (id: string) => {
    setSyncing(id);
    try {
      const result = await trpc.integrations.sync.mutate({ id });
      setMessage({ type: result.success ? 'success' : 'error', text: `同步完成: ${result.synced} 个任务 (${result.created} 新建, ${result.updated} 更新)` });
      await fetchIntegrations();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSyncing(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此集成？')) return;
    try {
      await trpc.integrations.delete.mutate({ id });
      await fetchIntegrations();
      setMessage({ type: 'success', text: '集成已删除' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const typeLabels: Record<string, string> = {
    github: '🐙 GitHub',
    feishu: '💬 飞书',
    notion: '📝 Notion',
    webhook: '🔗 通用 Webhook',
    telegram: '✈️ Telegram',
    wechat: '💚 企业微信',
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">平台集成</h1>
            <p className="text-gray-500 mt-1">管理第三方平台集成，同步任务数据</p>
          </div>
          <button
            onClick={() => { setShowCreate(true); setMessage(null); }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            + 添加集成
          </button>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
            {message.text}
            <button onClick={() => setMessage(null)} className="float-right font-bold">×</button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-8 text-gray-400">加载中...</div>
        ) : integrations.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border p-8 text-center text-gray-400">
            <p>暂无集成</p>
            <p className="text-sm mt-1">点击"添加集成"连接第三方平台</p>
          </div>
        ) : (
          <div className="space-y-4">
            {integrations.map((integration) => (
              <div key={integration.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{typeLabels[integration.type] || '🔗'}</span>
                    <div>
                      <div className="font-medium text-gray-900">{integration.name}</div>
                      <div className="text-sm text-gray-500">
                        {integration.description || typeLabels[integration.type] || integration.type}
                        {integration.lastSyncAt && ` · 上次同步: ${new Date(integration.lastSyncAt).toLocaleString()}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${integration.syncStatus === 'idle' ? 'bg-green-100 text-green-700' : integration.syncStatus === 'syncing' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                      {integration.syncStatus === 'idle' ? '正常' : integration.syncStatus === 'syncing' ? '同步中' : '错误'}
                    </span>
                    <button
                      onClick={() => handleTest(integration.id)}
                      disabled={testing === integration.id}
                      className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {testing === integration.id ? '测试中...' : '测试连接'}
                    </button>
                    <button
                      onClick={() => handleSync(integration.id)}
                      disabled={syncing === integration.id || !integration.isActive}
                      className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {syncing === integration.id ? '同步中...' : '立即同步'}
                    </button>
                    <button
                      onClick={() => handleToggle(integration)}
                      className={`text-xs px-3 py-1.5 rounded-lg ${integration.isActive ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}
                    >
                      {integration.isActive ? '停用' : '启用'}
                    </button>
                    <button
                      onClick={() => handleDelete(integration.id)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200"
                    >
                      删除
                    </button>
                  </div>
                </div>
                {integration.lastError && (
                  <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                    错误: {integration.lastError}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Create Dialog */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
              <h3 className="text-lg font-semibold mb-4">添加集成</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">集成类型 *</label>
                  <select
                    value={newIntegration.type}
                    onChange={(e) => setNewIntegration({ ...newIntegration, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">请选择</option>
                    {adapterTypes.map((t) => (
                      <option key={t.type} value={t.type}>{typeLabels[t.type] || t.name} ({t.type})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">名称 *</label>
                  <input
                    type="text"
                    value={newIntegration.name}
                    onChange={(e) => setNewIntegration({ ...newIntegration, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="例如: 我的 GitHub 仓库"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                  <input
                    type="text"
                    value={newIntegration.description}
                    onChange={(e) => setNewIntegration({ ...newIntegration, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="集成用途说明"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => { setShowCreate(false); setNewIntegration({ type: '', name: '', description: '' }); }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={!newIntegration.type || !newIntegration.name}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    创建
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
