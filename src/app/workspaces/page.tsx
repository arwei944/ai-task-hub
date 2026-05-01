'use client';

import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/lib/trpc/client';

interface Workspace {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  icon: string | null;
  owner: string;
  isDefault: boolean;
  role: string;
  createdAt: Date;
}

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', icon: '' });
  const [error, setError] = useState('');
  const [selectedWs, setSelectedWs] = useState<string | null>(null);
  const [members, setMembers] = useState<any[]>([]);

  const fetchWorkspaces = useCallback(async () => {
    try {
      const result = await trpc.workspaces.list.query();
      setWorkspaces(result as unknown as Workspace[]);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    fetchWorkspaces().finally(() => setLoading(false));
  }, [fetchWorkspaces]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await trpc.workspaces.create.mutate(form);
      setShowCreate(false);
      setForm({ name: '', description: '', icon: '' });
      await fetchWorkspaces();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      await trpc.workspaces.delete.mutate({ id });
      await fetchWorkspaces();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSelect = async (id: string) => {
    setSelectedWs(selectedWs === id ? null : id);
    if (selectedWs !== id) {
      try {
        const result = await trpc.workspaces.members.query({ workspaceId: id });
        setMembers(result as unknown as any[]);
      } catch { setMembers([]); }
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6 flex items-center justify-center text-gray-400">加载中...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">🏢 工作区</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">管理团队工作空间</p>
          </div>
          <button onClick={() => setShowCreate(!showCreate)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            {showCreate ? '取消' : '+ 创建工作区'}
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
            {error}
            <button onClick={() => setError('')} className="ml-2 underline">关闭</button>
          </div>
        )}

        {showCreate && (
          <form onSubmit={handleCreate} className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-5 mb-6 space-y-4">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">创建新工作区</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">名称 *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="e.g., 产品团队" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">图标</label>
                <input type="text" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="e.g., 🚀" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">描述</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">创建</button>
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium">取消</button>
            </div>
          </form>
        )}

        <div className="space-y-3">
          {workspaces.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-8 text-center">
              <div className="text-4xl mb-3">🏢</div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">暂无工作区</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">点击上方按钮创建你的第一个工作区</p>
            </div>
          ) : workspaces.map((ws) => (
            <div key={ws.id} className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
              <button onClick={() => handleSelect(ws.id)} className="w-full text-left p-5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{ws.icon || '📁'}</span>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">{ws.name}</h3>
                      {ws.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{ws.description}</p>}
                      <div className="flex gap-3 mt-1 text-xs text-gray-400">
                        <span>/{ws.slug}</span>
                        <span>{ws.role === 'owner' ? '所有者' : ws.role === 'admin' ? '管理员' : '成员'}</span>
                        <span>{ws.createdAt && new Date(ws.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {ws.isDefault && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">默认</span>}
                    {ws.role === 'owner' && (
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(ws.id, ws.name); }} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-950 dark:text-red-300 transition-colors">删除</button>
                    )}
                  </div>
                </div>
              </button>

              {selectedWs === ws.id && members.length > 0 && (
                <div className="border-t border-gray-200 dark:border-gray-800 p-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">成员 ({members.length})</h4>
                  <div className="space-y-1">
                    {members.map((m: any) => (
                      <div key={m.id} className="flex items-center justify-between py-1.5 text-sm">
                        <span className="text-gray-900 dark:text-gray-100">{m.userId}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          m.role === 'owner' ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300' :
                          m.role === 'admin' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300' :
                          'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                        }`}>{m.role}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
