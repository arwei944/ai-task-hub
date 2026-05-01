'use client';

import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/lib/trpc/client';
import {
  GitBranch, Plus, Play, Pause, ChevronRight, Bot, Wrench, Brain, Shield,
  Clock, CheckCircle, XCircle, Zap, Database, MessageSquare, Code, FileText, Search,
} from 'lucide-react';

// --- Types ---

interface WorkflowStep {
  id: string;
  name: string;
  type: string;
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
  createdAt: Date;
  updatedAt: Date;
}

interface Execution {
  id: string;
  workflowId: string;
  status: string;
  triggeredBy: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  result?: Record<string, unknown> | null;
  context?: string | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
  workflow?: { id: string; name: string } | null;
}

// --- Constants ---

const STEP_TYPE_OPTIONS = [
  { value: 'create-task', label: '创建任务', icon: CheckCircle },
  { value: 'update-status', label: '更新状态', icon: Zap },
  { value: 'ai-analyze', label: 'AI 分析', icon: Brain },
  { value: 'send-notification', label: '发送通知', icon: MessageSquare },
  { value: 'wait', label: '等待', icon: Clock },
  { value: 'http-request', label: 'HTTP 请求', icon: Code },
  { value: 'data-transform', label: '数据转换', icon: Database },
  { value: 'condition', label: '条件判断', icon: GitBranch },
  { value: 'loop', label: '循环', icon: Wrench },
  { value: 'code-execute', label: '代码执行', icon: Code },
  { value: 'file-read', label: '读取文件', icon: FileText },
  { value: 'file-write', label: '写入文件', icon: FileText },
] as const;

const STEP_TYPE_BADGE: Record<string, string> = {
  'ai-analyze': 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  'create-task': 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  'update-status': 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  'send-notification': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  'wait': 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  'http-request': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300',
  'data-transform': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300',
  'condition': 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  'loop': 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300',
  'code-execute': 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300',
  'file-read': 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300',
  'file-write': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
};

const STEP_TYPE_LABEL: Record<string, string> = {
  'ai-analyze': 'AI 分析',
  'create-task': '创建任务',
  'update-status': '更新状态',
  'send-notification': '发送通知',
  'wait': '等待',
  'http-request': 'HTTP 请求',
  'data-transform': '数据转换',
  'condition': '条件判断',
  'loop': '循环',
  'code-execute': '代码执行',
  'file-read': '读取文件',
  'file-write': '写入文件',
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

type TabKey = 'workflows' | 'agents' | 'skills' | 'memory' | 'rules';

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: 'workflows', label: '工作流', icon: GitBranch },
  { key: 'agents', label: '智能体', icon: Bot },
  { key: 'skills', label: '技能库', icon: Wrench },
  { key: 'memory', label: '记忆', icon: Brain },
  { key: 'rules', label: '规则组合', icon: Shield },
];

// --- Helpers ---

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

// --- Placeholder Component ---

function PlaceholderTab({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-16 text-center">
      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
        <Zap className="w-8 h-8 text-gray-400" />
      </div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">{title}</h2>
      <p className="text-gray-500 dark:text-gray-400 mb-4">{description}</p>
      <span className="inline-block px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-lg text-sm font-medium">
        即将推出
      </span>
    </div>
  );
}

// --- Page ---

export default function WorkflowsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('workflows');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">工作流管理</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">编排自动化流程、智能体、技能和规则</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 justify-center ${
                  activeTab === tab.key
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        {activeTab === 'workflows' && <WorkflowsTab />}
        {activeTab === 'agents' && <PlaceholderTab title="智能体管理" description="管理和配置 AI 智能体，设置其能力、权限和协作方式" />}
        {activeTab === 'skills' && <PlaceholderTab title="技能库" description="浏览和管理可复用的技能模块，为智能体扩展能力" />}
        {activeTab === 'memory' && <PlaceholderTab title="记忆管理" description="查看和管理智能体的记忆存储，包括长期记忆和工作记忆" />}
        {activeTab === 'rules' && <PlaceholderTab title="规则组合" description="配置反馈规则和自动化策略，定义工作流的干预逻辑" />}
      </div>
    </div>
  );
}

// --- Workflows Tab ---

function WorkflowsTab() {
  // Data state
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedWorkflowId, setExpandedWorkflowId] = useState<string | null>(null);
  const [executionsMap, setExecutionsMap] = useState<Record<string, Execution[]>>({});
  const [loadingExecutions, setLoadingExecutions] = useState<string | null>(null);

  // Running state per workflow
  const [runningWorkflowId, setRunningWorkflowId] = useState<string | null>(null);

  // Create form state
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    steps: [{ id: generateId(), name: '', type: 'create-task' as string }],
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // --- Data fetching ---

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

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  // --- Handlers ---

  const handleRun = async (workflowId: string) => {
    setRunningWorkflowId(workflowId);
    try {
      await trpc.workflows.run.mutate({ workflowId });
      if (expandedWorkflowId === workflowId) {
        fetchExecutions(workflowId);
      }
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
      const executions = data.items ?? [];
      setExecutionsMap((prev) => ({ ...prev, [workflowId]: executions }));
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
      if (!executionsMap[workflowId]) {
        fetchExecutions(workflowId);
      }
    }
  };

  // --- Create form handlers ---

  const addStep = () => {
    setCreateForm((prev) => ({
      ...prev,
      steps: [...prev.steps, { id: generateId(), name: '', type: 'create-task' }],
    }));
  };

  const removeStep = (stepId: string) => {
    if (createForm.steps.length <= 1) return;
    setCreateForm((prev) => ({
      ...prev,
      steps: prev.steps.filter((s) => s.id !== stepId),
    }));
  };

  const updateStep = (stepId: string, field: 'name' | 'type', value: string) => {
    setCreateForm((prev) => ({
      ...prev,
      steps: prev.steps.map((s) => (s.id === stepId ? { ...s, [field]: value } : s)),
    }));
  };

  const handleCreate = async () => {
    if (!createForm.name.trim()) {
      setCreateError('请输入工作流名称');
      return;
    }
    const validSteps = createForm.steps.filter((s) => s.name.trim());
    if (validSteps.length === 0) {
      setCreateError('请至少添加一个有效步骤');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      await trpc.workflows.create.mutate({
        name: createForm.name.trim(),
        description: createForm.description.trim() || undefined,
        steps: validSteps.map((s) => ({
          id: s.id,
          name: s.name.trim(),
          type: s.type as 'create-task' | 'update-status' | 'ai-analyze' | 'send-notification' | 'wait' | 'parallel-group' | 'condition' | 'foreach' | 'invoke-agent' | 'http-request' | 'transform' | 'approval',
          config: {},
        })),
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

  // --- Render ---

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <GitBranch className="w-4 h-4" />
          <span>{workflows.length} 个工作流</span>
        </div>
        <button
          onClick={() => { setShowCreateModal(true); setCreateError(null); }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          创建工作流
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-12 text-center text-gray-400">
          加载中...
        </div>
      ) : error ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-12 text-center">
          <p className="text-red-500">{error}</p>
          <button onClick={fetchWorkflows} className="mt-2 text-sm text-blue-600 hover:underline">重试</button>
        </div>
      ) : workflows.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-12 text-center">
          <GitBranch className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-lg">暂无工作流</p>
          <p className="text-gray-400 text-sm mt-1">点击"创建工作流"添加第一个自动化流程</p>
        </div>
      ) : (
        <div className="space-y-4">
          {workflows.map((wf) => (
            <div
              key={wf.id}
              className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden"
            >
              {/* Workflow Header */}
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <GitBranch className="w-4 h-4 text-blue-500 shrink-0" />
                      <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-lg">{wf.name}</h2>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${wf.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                        {wf.isActive ? '已启用' : '未启用'}
                      </span>
                      {wf.trigger && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                          {wf.trigger}
                        </span>
                      )}
                    </div>
                    {wf.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{wf.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4 shrink-0">
                    <button
                      onClick={() => toggleExecutions(wf.id)}
                      className="px-3 py-1.5 text-xs font-medium border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      执行历史
                    </button>
                    <button
                      onClick={() => handleRun(wf.id)}
                      disabled={runningWorkflowId === wf.id}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 ${
                        runningWorkflowId === wf.id
                          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                          : 'bg-green-600 text-white hover:bg-green-700'
                      }`}
                    >
                      {runningWorkflowId === wf.id ? (
                        <>
                          <Clock className="w-3 h-3" />
                          执行中...
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3" />
                          执行
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Steps */}
                <div className="mt-4 space-y-2">
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    步骤 ({wf.steps.length})
                  </h3>
                  <div className="space-y-2">
                    {wf.steps.map((step, i) => (
                      <div key={step.id} className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-500 dark:text-gray-400 shrink-0">
                          {i + 1}
                        </div>
                        <span className="text-sm text-gray-900 dark:text-gray-100 font-medium">{step.name || step.type}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STEP_TYPE_BADGE[step.type] || 'bg-gray-100 text-gray-600'}`}>
                          {STEP_TYPE_LABEL[step.type] || step.type}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Execution History (collapsible) */}
              {expandedWorkflowId === wf.id && (
                <div className="border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 p-5">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">执行历史</h3>
                  {loadingExecutions === wf.id ? (
                    <p className="text-sm text-gray-400">加载中...</p>
                  ) : !executionsMap[wf.id] || executionsMap[wf.id].length === 0 ? (
                    <p className="text-sm text-gray-400">暂无执行记录</p>
                  ) : (
                    <div className="space-y-2">
                      {executionsMap[wf.id].map((exec) => (
                        <div
                          key={exec.id}
                          className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
                        >
                          <div className="flex items-center gap-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${EXECUTION_STATUS_BADGE[exec.status] || 'bg-gray-100 text-gray-600'}`}>
                              {EXECUTION_STATUS_LABEL[exec.status] || exec.status}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(exec.createdAt).toLocaleString()}
                            </span>
                          </div>
                          {exec.error && (
                            <span className="text-xs text-red-500 truncate max-w-[200px]">{exec.error}</span>
                          )}
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

      {/* Create Workflow Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg p-6 mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">创建工作流</h3>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  placeholder="例如: 每日任务分析"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">描述</label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none"
                  rows={2}
                  placeholder="工作流描述（可选）"
                />
              </div>

              {/* Steps */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    步骤 <span className="text-xs text-gray-400 font-normal">（支持 12 种步骤类型）</span>
                  </label>
                  <button
                    type="button"
                    onClick={addStep}
                    className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  >
                    + 添加步骤
                  </button>
                </div>
                <div className="space-y-2">
                  {createForm.steps.map((step, i) => (
                    <div key={step.id} className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-5 shrink-0">{i + 1}</span>
                      <input
                        type="text"
                        value={step.name}
                        onChange={(e) => updateStep(step.id, 'name', e.target.value)}
                        className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        placeholder="步骤名称"
                      />
                      <select
                        value={step.type}
                        onChange={(e) => updateStep(step.id, 'type', e.target.value)}
                        className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      >
                        {STEP_TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      {createForm.steps.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeStep(step.id)}
                          className="text-gray-400 hover:text-red-500 text-sm shrink-0"
                        >
                          x
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Error */}
              {createError && (
                <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-700 dark:text-red-400">{createError}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setShowCreateModal(false); setCreateError(null); }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {creating ? '创建中...' : '创建'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
