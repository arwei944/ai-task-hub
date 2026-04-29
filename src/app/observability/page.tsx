'use client';

import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/lib/trpc/client';
import { Activity, BarChart3, Clock, CheckCircle, XCircle, Zap, Brain, Bot, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface ObservabilityStats { totalExecutions: number; totalSteps: number; successRate: number; avgDurationMs: number; totalSOLOCalls: number; soloSuccessRate: number; }
interface ExecutionRecord { id: string; workflowName: string; status: string; durationMs: number; stepsCompleted: number; totalSteps: number; startedAt: string; }
interface StepPerformanceRecord { stepType: string; label: string; totalCalls: number; avgDurationMs: number; failureRate: number; successCount: number; failCount: number; }
interface SOLOCallRecord { id: string; mode: string; subAgent: string; prompt: string; durationMs: number; success: boolean; tokensUsed: number; startedAt: string; }

function formatDuration(ms: number): string { if (ms < 1000) return `${ms}ms`; if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`; return `${(ms / 60000).toFixed(1)}m`; }
function formatPercent(value: number): string { return `${(value * 100).toFixed(1)}%`; }
function timeAgo(isoString: string): string { const diff = Date.now() - new Date(isoString).getTime(); const minutes = Math.floor(diff / 60000); if (minutes < 1) return '刚刚'; if (minutes < 60) return `${minutes} 分钟前`; const hours = Math.floor(minutes / 60); if (hours < 24) return `${hours} 小时前`; return `${Math.floor(hours / 24)} 天前`; }

const EXECUTION_STATUS_BADGE: Record<string, string> = { pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', running: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', completed: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', failed: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', cancelled: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' };
const EXECUTION_STATUS_LABEL: Record<string, string> = { pending: '等待中', running: '运行中', completed: '已完成', failed: '失败', cancelled: '已取消' };
const SOLO_MODE_BADGE: Record<string, string> = { mcp: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', rest: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', pull: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' };
const SOLO_AGENT_LABEL: Record<string, string> = { explore: '探索', plan: '规划', general_purpose: '通用' };

export default function ObservabilityPage() {
  const [stats, setStats] = useState<ObservabilityStats | null>(null);
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
  const [stepPerformance, setStepPerformance] = useState<StepPerformanceRecord[]>([]);
  const [soloCalls, setSoloCalls] = useState<SOLOCallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'executions' | 'steps' | 'solo'>('executions');

  const fetchAll = useCallback(async () => {
    try { setLoading(true); setError(null);
      const [statsData, execData, stepData, soloData] = await Promise.all([
        trpc.workflows.getObservabilityStats.query(), trpc.workflows.getRecentExecutions.query({ limit: 10 }),
        trpc.workflows.getStepPerformance.query(), trpc.workflows.getSOLOCallHistory.query({ limit: 10 }),
      ]);
      setStats(statsData); setExecutions(execData.items ?? []); setStepPerformance(stepData.items ?? []); setSoloCalls(soloData.items ?? []);
    } catch (err: any) { console.error('Failed to fetch observability data:', err); setError(err.message || '加载失败'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1"><Activity className="w-7 h-7 text-blue-500" /><h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">可观测性面板</h1></div>
          <p className="text-gray-500 dark:text-gray-400">工作流执行监控、步骤性能分析和 SOLO 调用追踪</p>
        </div>
        {loading ? (<div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-12 text-center text-gray-400">加载中...</div>) : error ? (<div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-12 text-center"><p className="text-red-500">{error}</p><button onClick={fetchAll} className="mt-2 text-sm text-blue-600 hover:underline">重试</button></div>) : (<>
          {stats && (<div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard title="总执行次数" value={stats.totalExecutions.toString()} icon={<BarChart3 className="w-5 h-5" />} subtitle={`${stats.totalSteps} 个步骤`} color="blue" />
            <StatCard title="成功率" value={formatPercent(stats.successRate)} icon={<CheckCircle className="w-5 h-5" />} subtitle={stats.successRate >= 0.9 ? '运行良好' : '需要关注'} color={stats.successRate >= 0.9 ? 'green' : 'yellow'} trend={stats.successRate >= 0.9 ? 'up' : 'down'} />
            <StatCard title="平均耗时" value={formatDuration(stats.avgDurationMs)} icon={<Clock className="w-5 h-5" />} subtitle="每次执行" color="purple" />
            <StatCard title="SOLO 调用" value={stats.totalSOLOCalls.toString()} icon={<Brain className="w-5 h-5" />} subtitle={`成功率 ${formatPercent(stats.soloSuccessRate)}`} color="indigo" trend="up" />
          </div>)}
          <div className="flex gap-1 mb-4 bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-1">
            {([ { key: 'executions' as const, label: '最近执行', icon: Activity }, { key: 'steps' as const, label: '步骤性能', icon: Zap }, { key: 'solo' as const, label: 'SOLO 调用', icon: Bot } ]).map((tab) => { const Icon = tab.icon; return (<button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 justify-center ${activeTab === tab.key ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}><Icon className="w-4 h-4" />{tab.label}</button>); })}
          </div>
          {activeTab === 'executions' && (<div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden"><div className="p-4 border-b border-gray-200 dark:border-gray-800"><h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">最近执行记录</h2></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-gray-200 dark:border-gray-800"><th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">工作流</th><th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">状态</th><th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">耗时</th><th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">步骤</th><th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">时间</th></tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-800">{executions.map((exec) => (<tr key={exec.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50"><td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{exec.workflowName}</td><td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${EXECUTION_STATUS_BADGE[exec.status] || 'bg-gray-100 text-gray-600'}`}>{EXECUTION_STATUS_LABEL[exec.status] || exec.status}</span></td><td className="px-4 py-3 text-gray-600 dark:text-gray-400">{formatDuration(exec.durationMs)}</td><td className="px-4 py-3"><span className={exec.stepsCompleted === exec.totalSteps ? 'text-green-600' : 'text-orange-600'}>{exec.stepsCompleted}/{exec.totalSteps}</span></td><td className="px-4 py-3 text-gray-500 text-xs">{timeAgo(exec.startedAt)}</td></tr>))}</tbody></table></div></div>)}
          {activeTab === 'steps' && (<div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden"><div className="p-4 border-b border-gray-200 dark:border-gray-800"><h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">步骤类型性能分析</h2></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-gray-200 dark:border-gray-800"><th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">步骤类型</th><th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">调用次数</th><th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">平均耗时</th><th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">成功率</th><th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">失败</th></tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-800">{stepPerformance.map((step) => (<tr key={step.stepType} className="hover:bg-gray-50 dark:hover:bg-gray-800/50"><td className="px-4 py-3"><div className="flex items-center gap-2"><span className="font-medium text-gray-900 dark:text-gray-100">{step.label}</span><span className="text-xs text-gray-400">{step.stepType}</span></div></td><td className="px-4 py-3 text-gray-600 dark:text-gray-400">{step.totalCalls}</td><td className="px-4 py-3 text-gray-600 dark:text-gray-400">{formatDuration(step.avgDurationMs)}</td><td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"><div className={`h-full rounded-full ${step.failureRate === 0 ? 'bg-green-500' : step.failureRate < 0.05 ? 'bg-blue-500' : 'bg-orange-500'}`} style={{ width: `${(1 - step.failureRate) * 100}%` }} /></div><span className="text-xs text-gray-600 dark:text-gray-400">{formatPercent(1 - step.failureRate)}</span></div></td><td className="px-4 py-3">{step.failCount > 0 ? <span className="text-xs text-red-600 font-medium">{step.failCount}</span> : <span className="text-xs text-gray-400">0</span>}</td></tr>))}</tbody></table></div></div>)}
          {activeTab === 'solo' && (<div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden"><div className="p-4 border-b border-gray-200 dark:border-gray-800"><h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">SOLO 调用历史</h2></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-gray-200 dark:border-gray-800"><th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">模式</th><th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">智能体</th><th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">提示词</th><th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">耗时</th><th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Tokens</th><th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">结果</th><th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">时间</th></tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-800">{soloCalls.map((call) => (<tr key={call.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50"><td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SOLO_MODE_BADGE[call.mode] || 'bg-gray-100 text-gray-600'}`}>{call.mode.toUpperCase()}</span></td><td className="px-4 py-3 text-gray-600 dark:text-gray-400">{SOLO_AGENT_LABEL[call.subAgent] || call.subAgent}</td><td className="px-4 py-3 text-gray-900 dark:text-gray-100 max-w-[200px] truncate">{call.prompt}</td><td className="px-4 py-3 text-gray-600 dark:text-gray-400">{formatDuration(call.durationMs)}</td><td className="px-4 py-3 text-gray-600 dark:text-gray-400">{call.tokensUsed.toLocaleString()}</td><td className="px-4 py-3">{call.success ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />}</td><td className="px-4 py-3 text-gray-500 text-xs">{timeAgo(call.startedAt)}</td></tr>))}</tbody></table></div></div>)}
        </>)}
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, subtitle, color, trend }: { title: string; value: string; icon: React.ReactNode; subtitle: string; color: 'blue' | 'green' | 'yellow' | 'purple' | 'indigo'; trend?: 'up' | 'down' }) {
  const colorClasses: Record<string, { bg: string; icon: string; border: string }> = { blue: { bg: 'bg-blue-50 dark:bg-blue-950/30', icon: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800' }, green: { bg: 'bg-green-50 dark:bg-green-950/30', icon: 'text-green-600 dark:text-green-400', border: 'border-green-200 dark:border-green-800' }, yellow: { bg: 'bg-yellow-50 dark:bg-yellow-950/30', icon: 'text-yellow-600 dark:text-yellow-400', border: 'border-yellow-200 dark:border-yellow-800' }, purple: { bg: 'bg-purple-50 dark:bg-purple-950/30', icon: 'text-purple-600 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-800' }, indigo: { bg: 'bg-indigo-50 dark:bg-indigo-950/30', icon: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-200 dark:border-indigo-800' } };
  const c = colorClasses[color];
  return (<div className={`rounded-xl border p-4 ${c.bg} ${c.border}`}><div className="flex items-center justify-between mb-2"><span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</span><span className={c.icon}>{icon}</span></div><div className="flex items-end gap-2"><span className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</span>{trend === 'up' && <ArrowUpRight className="w-4 h-4 text-green-500 mb-1" />}{trend === 'down' && <ArrowDownRight className="w-4 h-4 text-red-500 mb-1" />}</div><p className="text-xs text-gray-500 mt-1">{subtitle}</p></div>);
}
