'use client';

import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/lib/trpc/client';

interface WorkflowStep {
  id: string;
  name: string;
  type: 'ai-analyze' | 'create-task' | 'update-status' | 'send-notification' | 'wait';
  config: Record<string, unknown>;
  onError?: 'continue' | 'fail';
}

interface Workflow {
  id: string;
  name: string;
  description: string | null;
  trigger: string | null;
  triggerConfig: string | null;
  steps: WorkflowStep[];
  variables: Record<string, unknown> | null;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface Execution {
  id: string;
  workflowId: string;
  status: string;
  triggeredBy: string | null;
  startedAt: string | null;
  completedAt: string | null;
  result?: Record<string, unknown> | null;
  context?: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  workflow?: { id: string; name: string } | null;
}

const STEP_TYPE_OPTIONS = [
  { value: 'create-task', label: '创建任务' },
  { value: 'update-status', label: '更新状态' },
  { value: 'ai-analyze', label: 'AI 分析' },
  { value: 'send-notification', label: '发送通知' },
  { value: 'wait', label: '等待' },
] as const;

const STEP_TYPE_BADGE: Record<string, string> = {
  'ai-analyze': 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  'create-task': 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  'update-status': 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  'send-notification': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  'wait': 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

const STEP_TYPE_LABEL: Record<string, string> = {
  'ai-analyze': 'AI 分析',
  'create-task': '创建任务',
  'update-status': '更新状态',
  'send-notification': '发送通知',
  'wait': '等待',
};

const EXECUTION_STATUS_BADGE: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  running: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  cancelled: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

const EXECUTION_STATUS_LABEL: Record<string, string> = {
  pending: '等待中',
  running: '运行中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
};

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export default function AgentWorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedWorkflowId, setExpandedWorkflowId] = useState<string | null>(null);
  const [executionsMap, setExecutionsMap] = useState<Record<string, Execution[]>>({});
  const [loadingExecutions, setLoadingExecutions] = useState<string | null>(null);
  const [runningWorkflowId, setRunningWorkflowId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    steps: [{ id: generateId(), name: '', type: 'create-task' as WorkflowStep['type'] }],
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchWorkflows = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await trpc.workflows.list.query({});
      setWorkflows(data.items ?? []);
    } catch (err: any) {
      console.error('Failed to fetch workflows:', err);
      setError(err.message || '加载工作流失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchWorkflows(); }, [fetchWorkflows]);

  const handleRun = async (workflowId: string) => {
    setRunningWorkflowId(workflowId);
    try {
      await trpc.workflows.run.mutate({ workflowId });
      if (expandedWorkflowId === workflowId) fetchExecutions(workflowId);
    } catch (err: any) {
      console.error('Failed to run workflow:', err);
      alert(err.message || '执行工作流失败');
    } finally {
      setRunningWorkflowId(null);
    }
  };

  const fetchExecutions = async (workflowId: string) => {
    setLoadingExecutions(workflowId);
    try {
      const data = await trpc.workflows.listExecutions.query({ workflowId });
      setExecutionsMap((prev) => ({ ...prev, [workflowId]: data.items ?? [] }));
    } catch (err: any) {
      console.error('Failed to fetch executions:', err);
    } finally {
      setLoadingExecutions(null);
    }
  };

  const toggleExecutions = (workflowId: string) => {
    if (expandedWorkflowId === workflowId) {
      setExpandedWorkflowId(null);
    } else {
      setExpandedWorkflowId(workflowId);
      if (!executionsMap[workflowId]) fetchExecutions(workflowId);
    }
  };

  const addStep = () => {
    setCreateForm((prev) => ({ ...prev, steps: [...prev.steps, { id: generateId(), name: '', type: 'create-task' }] }));
  };

  const removeStep = (stepId: string) => {
    if (createForm.steps.length <= 1) return;
    setCreateForm((prev) => ({ ...prev, steps: prev.steps.filter((s) => s.id !== stepId) }));
  };

  const updateStep = (stepId: string, field: 'name' | 'type', value: string) => {
    setCreateForm((prev) => ({ ...prev, steps: prev.steps.map((s) => (s.id === stepId ? { ...s, [field]: value } : s)) }));
  };

  const handleCreate = async () => {
    if (!createForm.name.trim()) { setCreateError('请输入工作流名称'); return; }
    const validSteps = createForm.steps.filter((s) => s.name.trim());
    if (validSteps.length === 0) { setCreateError('请至少添加一个有效步骤'); return; }
    setCreating(true);
    setCreateError(null);
    try {
      await trpc.workflows.create.mutate({
        name: createForm.name.trim(),
        description: createForm.description.trim() || undefined,
        steps: validSteps.map((s) => ({ id: s.id, name: s.name.trim(), type: s.type, config: {} })),
      });
      setShowCreateModal(false);
      setCreateForm({ name: '', description: '', steps: [{ id: generateId(), name: '', type: 'create-task' }] });
      fetchWorkflows();
    } catch (err: any) {
      console.error('Failed to create workflow:', err);
      setCreateError(err.message || '创建工作流失败');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Agent 工作流</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">编排多步骤 AI Agent 自动化流程</p>
          </div>
          <button onClick={() => { setShowCreateModal(true); setCreateError(null); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">+ 创建工作流</button>
        </div>
        {loading ? (
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-12 text-center text-gray-400">加载中...</div>
        ) : error ? (
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-12 text-center">
            <p className="text-red-500">{error}</p>
            <button onClick={fetchWorkflows} className="mt-2 text-sm text-blue-600 hover:underline">重试</button>
          </div>
        ) : workflows.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-12 text-center">
            <p className="text-gray-400 text-lg">暂无工作流</p>
            <p className="text-gray-400 text-sm mt-1">点击&quot;创建工作流&quot;添加第一个</p>
          </div>
        ) : (
          <div className="space-y-4">
            {workflows.map((wf) => (
              <div key={wf.id} className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-lg">{wf.name}</h2>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${wf.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>{wf.isActive ? '已启用' : '未启用'}</span>
                        {wf.trigger && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">{wf.trigger}</span>}
                      </div>
                      {wf.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{wf.description}</p>}
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      <button onClick={() => toggleExecutions(wf.id)} className="px-3 py-1.5 text-xs font-medium border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">查看执行历史</button>
                      <button onClick={() => handleRun(wf.id)} disabled={runningWorkflowId === wf.id} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${runningWorkflowId === wf.id ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' : 'bg-green-600 text-white hover:bg-green-700'}`}>{runningWorkflowId === wf.id ? '执行中...' : '执行'}</button>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">步骤 ({wf.steps.length})</h3>
                    <div className="space-y-2">
                      {wf.steps.map((step, i) => (
                        <div key={step.id} className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-500 dark:text-gray-400 shrink-0">{i + 1}</div>
                          <span className="text-sm text-gray-900 dark:text-gray-100 font-medium">{step.name || step.type}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${STEP_TYPE_BADGE[step.type] || 'bg-gray-100 text-gray-600'}`}>{STEP_TYPE_LABEL[step.type] || step.type}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {expandedWorkflowId === wf.id && (
                  <div className="border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 p-5">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">执行历史</h3>
                    {loadingExecutions === wf.id ? (<p className="text-sm text-gray-400">加载中...</p>) : !executionsMap[wf.id] || executionsMap[wf.id].length === 0 ? (<p className="text-sm text-gray-400">暂无执行记录</p>) : (
                      <div className="space-y-2">
                        {executionsMap[wf.id].map((exec) => (
                          <div key={exec.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                            <div className="flex items-center gap-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${EXECUTION_STATUS_BADGE[exec.status] || 'bg-gray-100 text-gray-600'}`}>{EXECUTION_STATUS_LABEL[exec.status] || exec.status}</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">{new Date(exec.createdAt).toLocaleString()}</span>
                            </div>
                            {exec.error && <span className="text-xs text-red-500 truncate max-w-[200px]">{exec.error}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg p-6 mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">创建工作流</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">名称 <span className="text-red-500">*</span></label>
                <input type="text" value={createForm.name} onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" placeholder="例如: 每日任务分析" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">描述</label>
                <textarea value={createForm.description} onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none" rows={2} placeholder="工作流描述（可选）" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">步骤</label>
                  <button type="button" onClick={addStep} className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400">+ 添加步骤</button>
                </div>
                <div className="space-y-2">
                  {createForm.steps.map((step, i) => (
                    <div key={step.id} className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-5 shrink-0">{i + 1}</span>
                      <input type="text" value={step.name} onChange={(e) => updateStep(step.id, 'name', e.target.value)} className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" placeholder="步骤名称" />
                      <select value={step.type} onChange={(e) => updateStep(step.id, 'type', e.target.value)} className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                        {STEP_TYPE_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                      </select>
                      {createForm.steps.length > 1 && (<button type="button" onClick={() => removeStep(step.id)} className="text-gray-400 hover:text-red-500 text-sm shrink-0">x</button>)}
                    </div>
                  ))}
                </div>
              </div>
              {createError && (<div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg"><p className="text-sm text-red-700 dark:text-red-400">{createError}</p></div>)}
              <div className="flex gap-3 pt-2">
                <button onClick={() => { setShowCreateModal(false); setCreateError(null); }} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">取消</button>
                <button onClick={handleCreate} disabled={creating} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">{creating ? '创建中...' : '创建'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
