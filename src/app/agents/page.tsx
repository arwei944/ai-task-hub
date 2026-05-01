'use client';

import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/lib/trpc/client';

interface Agent {
  id: string;
  name: string;
  description: string | null;
  apiKey: string;
  capabilities: string[] | null;
  permissionLevel: string;
  isActive: boolean;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface AgentOp {
  id: string;
  agentId: string;
  agentName?: string;
  action: string;
  target: string | null;
  success: boolean;
  createdAt: Date;
}

export default function AgentsPage() {
  const [showRegister, setShowRegister] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [newAgent, setNewAgent] = useState({ name: '', description: '', permissionLevel: 'agent' as 'user' | 'agent' });
  const [agents, setAgents] = useState<Agent[]>([]);
  const [recentOps, setRecentOps] = useState<AgentOp[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [registeredKey, setRegisteredKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      const data = await trpc.agents.list.query();
      setAgents(data.agents);
    } catch (err: any) {
      console.error('Failed to fetch agents:', err);
    }
  }, []);

  const fetchOps = useCallback(async () => {
    try {
      const ops = await trpc.agents.recentOperations.query();
      setRecentOps(ops);
    } catch (err: any) {
      console.error('Failed to fetch operations:', err);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchAgents(), fetchOps()]).finally(() => setLoading(false));
  }, [fetchAgents, fetchOps]);

  const handleRegister = async () => {
    if (!newAgent.name) return;
    setRegistering(true);
    setError(null);
    try {
      const result = await trpc.agents.register.mutate(newAgent);
      setRegisteredKey(result.apiKey);
      await fetchAgents();
    } catch (err: any) {
      setError(err.message || '注册失败');
    } finally {
      setRegistering(false);
    }
  };

  const handleDeactivate = async (id: string, name: string) => {
    try {
      await trpc.agents.deactivate.mutate({ id });
      await fetchAgents();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">智能体管理</h1>
            <p className="text-gray-500 mt-1">管理 AI 智能体的注册、权限和操作日志</p>
          </div>
          <button
            onClick={() => { setShowRegister(true); setRegisteredKey(null); setError(null); }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            + 注册智能体
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Agent List */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h2 className="font-semibold text-gray-900">已注册智能体 ({agents.length})</h2>
              </div>
              {loading ? (
                <div className="p-8 text-center text-gray-400">加载中...</div>
              ) : agents.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <p>暂无智能体</p>
                  <p className="text-sm mt-1">点击"注册智能体"添加第一个</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {agents.map((agent) => (
                    <div
                      key={agent.id}
                      className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${selectedAgent === agent.id ? 'bg-blue-50' : ''}`}
                      onClick={() => setSelectedAgent(selectedAgent === agent.id ? null : agent.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${agent.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                          <div>
                            <div className="font-medium text-gray-900">{agent.name}</div>
                            <div className="text-sm text-gray-500">
                              {agent.description || '无描述'} · {agent.permissionLevel === 'user' ? '用户权限' : '智能体权限'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                            {agent.capabilities?.join(', ') || 'task_crud'}
                          </span>
                          {agent.isActive && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeactivate(agent.id, agent.name); }}
                              className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                            >
                              停用
                            </button>
                          )}
                        </div>
                      </div>

                      {selectedAgent === agent.id && (
                        <div className="mt-3 pt-3 border-t border-gray-100 text-sm text-gray-600">
                          <div className="grid grid-cols-2 gap-2">
                            <div><span className="text-gray-400">ID:</span> {agent.id}</div>
                            <div><span className="text-gray-400">权限级别:</span> {agent.permissionLevel}</div>
                            <div><span className="text-gray-400">创建时间:</span> {new Date(agent.createdAt).toLocaleString()}</div>
                            <div><span className="text-gray-400">最后活跃:</span> {agent.lastSeenAt ? new Date(agent.lastSeenAt).toLocaleString() : '从未'}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Operations */}
          <div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h2 className="font-semibold text-gray-900">最近操作</h2>
              </div>
              <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                {recentOps.length === 0 ? (
                  <div className="p-4 text-center text-gray-400 text-sm">暂无操作记录</div>
                ) : (
                  recentOps.map((op) => (
                    <div key={op.id} className="p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900">{op.agentName || op.agentId}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${op.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {op.success ? '成功' : '失败'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {op.action} {op.target && `→ ${op.target.substring(0, 8)}...`}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {new Date(op.createdAt).toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Register Dialog */}
        {showRegister && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
              <h3 className="text-lg font-semibold mb-4">注册新智能体</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">名称 *</label>
                  <input
                    type="text"
                    value={newAgent.name}
                    onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="例如: Trae AI Assistant"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                  <input
                    type="text"
                    value={newAgent.description}
                    onChange={(e) => setNewAgent({ ...newAgent, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="智能体的用途和能力"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">权限级别</label>
                  <select
                    value={newAgent.permissionLevel}
                    onChange={(e) => setNewAgent({ ...newAgent, permissionLevel: e.target.value as 'user' | 'agent' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="agent">智能体（创建者隔离 + 全局只读）</option>
                    <option value="user">用户（最高权限）</option>
                  </select>
                </div>

                {registeredKey && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm font-medium text-green-800">注册成功！</p>
                    <p className="text-xs text-green-600 mt-1">
                      API Key: <code className="bg-green-100 px-1 rounded break-all">{registeredKey}</code>
                    </p>
                    <p className="text-xs text-red-500 mt-1">⚠️ 请立即保存 API Key，关闭后无法再次查看</p>
                  </div>
                )}

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => { setShowRegister(false); setRegisteredKey(null); setError(null); }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleRegister}
                    disabled={!newAgent.name || registering}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {registering ? '注册中...' : '注册'}
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
