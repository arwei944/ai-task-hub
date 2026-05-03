'use client';

import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/lib/trpc/client';
import {
  FolderKanban, Clock, CheckCircle2, AlertTriangle, Bot,
  ArrowRight, Activity, BarChart3, Layers,
} from 'lucide-react';

const PHASE_LABELS: Record<string, { label: string; color: string }> = {
  requirements: { label: '需求整理', color: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
  planning: { label: '任务规划', color: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300' },
  architecture: { label: '架构设计', color: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' },
  implementation: { label: '编码实施', color: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' },
  testing: { label: '测试验证', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300' },
  deployment: { label: '部署上线', color: 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300' },
  completed: { label: '已完成', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
};

const CLIENT_ICONS: Record<string, string> = {
  trae: '🟦', cursor: '🟩', windsurf: '🟨', vscode: '🟪',
  claude: '🟧', chatgpt: '🟢', mcp: '⚪', api: '🔴',
};

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  phase: string;
  priority: string;
  techStack: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count: { tasks: number; activities: number };
  creator: { id: string; name: string; clientType: string } | null;
}

interface Activity {
  id: string;
  action: string;
  phase: string | null;
  title: string;
  createdAt: Date;
  agent: { id: string; name: string; clientType: string } | null;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    try {
      const result = await trpc.plugins.list.query();
      // Use direct API call for projects
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      }
    } catch {
      // Fallback: empty
    }
  }, []);

  useEffect(() => {
    fetchProjects().finally(() => setLoading(false));
  }, [fetchProjects]);

  const selectProject = async (id: string) => {
    setSelectedProject(id);
    try {
      const [actRes, sumRes] = await Promise.all([
        fetch(`/api/projects/${id}/activities`),
        fetch(`/api/projects/${id}/summary`),
      ]);
      if (actRes.ok) setActivities((await actRes.json()).activities || []);
      if (sumRes.ok) setSummary(await sumRes.json());
    } catch { /* ignore */ }
  };

  if (loading) {
    return <div className="p-6 text-center text-gray-400">加载中...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <FolderKanban className="w-6 h-6 text-blue-600" />
            项目管理
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">AI 智能体驱动的项目全生命周期管理</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Project List */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1">
              <Layers className="w-4 h-4" /> 项目列表
            </h2>
            {projects.length === 0 ? (
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 text-center">
                <Bot className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">暂无项目</p>
                <p className="text-xs text-gray-400 mt-1">通过 MCP 连接的 AI 智能体创建项目</p>
                <button
                  onClick={() => window.location.href = '/projects/create'}
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
                >
                  <FolderKanban className="w-4 h-4" />
                  创建项目
                </button>
              </div>
            ) : projects.map((p) => (
              <button
                key={p.id}
                onClick={() => selectProject(p.id)}
                className={`w-full text-left p-4 rounded-xl border transition-colors ${
                  selectedProject === p.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <h3 className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{p.name}</h3>
                    {p.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{p.description}</p>}
                    <div className="flex items-center gap-2 mt-1.5">
                      {PHASE_LABELS[p.phase] && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${PHASE_LABELS[p.phase].color}`}>
                          {PHASE_LABELS[p.phase].label}
                        </span>
                      )}
                      {p.creator && (
                        <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                          {CLIENT_ICONS[p.creator.clientType] || '⚪'} {p.creator.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <div className="text-xs text-gray-400">{p._count.tasks} 任务</div>
                    <div className="text-xs text-gray-400">{p._count.activities} 活动</div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Project Detail */}
          <div className="lg:col-span-2 space-y-4">
            {!selectedProject ? (
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-12 text-center">
                <Activity className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-gray-500">选择一个项目查看详情</h3>
                <p className="text-sm text-gray-400 mt-1">项目详情、活动时间线、阶段进度</p>
              </div>
            ) : (
              <>
                {/* Summary Cards */}
                {summary && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                      <div className="text-xs text-gray-400 mb-1">总体进度</div>
                      <div className="text-2xl font-bold text-blue-600">{summary.overallProgress}%</div>
                    </div>
                    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                      <div className="text-xs text-gray-400 mb-1">任务完成率</div>
                      <div className="text-2xl font-bold text-green-600">{summary.taskStats.completionRate}%</div>
                    </div>
                    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                      <div className="text-xs text-gray-400 mb-1">进行中</div>
                      <div className="text-2xl font-bold text-yellow-600">{summary.taskStats.inProgress}</div>
                    </div>
                    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                      <div className="text-xs text-gray-400 mb-1">参与 Agent</div>
                      <div className="text-2xl font-bold text-purple-600">{summary.agents.length}</div>
                    </div>
                  </div>
                )}

                {/* Phase Progress */}
                {summary && (
                  <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
                    <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-1">
                      <BarChart3 className="w-4 h-4" /> 阶段进度
                    </h3>
                    <div className="space-y-2">
                      {Object.entries(PHASE_LABELS).map(([phase, info]) => {
                        const stats = summary.taskStats.byPhase[phase] || { total: 0, done: 0 };
                        const isActive = summary.project.phase === phase;
                        return (
                          <div key={phase} className="flex items-center gap-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full w-20 text-center shrink-0 ${info.color}`}>
                              {info.label}
                            </span>
                            <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${isActive ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                                style={{ width: `${stats.total > 0 ? (stats.done / stats.total) * 100 : 0}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-400 w-16 text-right shrink-0">
                              {stats.done}/{stats.total}
                            </span>
                            {isActive && <ArrowRight className="w-3 h-3 text-blue-500 shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Activity Timeline */}
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
                  <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-1">
                    <Clock className="w-4 h-4" /> 活动时间线
                  </h3>
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {activities.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-4">暂无活动记录</p>
                    ) : activities.map((act) => (
                      <div key={act.id} className="flex items-start gap-3">
                        <div className="mt-1 shrink-0">
                          {act.agent ? (
                            <span title={`${act.agent.name} (${act.agent.clientType})`}>
                              {CLIENT_ICONS[act.agent.clientType] || '⚪'}
                            </span>
                          ) : (
                            <CheckCircle2 className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 dark:text-gray-100">{act.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {act.phase && PHASE_LABELS[act.phase] && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${PHASE_LABELS[act.phase].color}`}>
                                {PHASE_LABELS[act.phase].label}
                              </span>
                            )}
                            <span className="text-[10px] text-gray-400">
                              {new Date(act.createdAt).toLocaleString('zh-CN')}
                            </span>
                            {act.agent && (
                              <span className="text-[10px] text-gray-400">
                                {act.agent.name} · {act.agent.clientType}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
