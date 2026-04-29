'use client';

import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/lib/trpc/client';
import { useSSE } from '@/lib/hooks/use-sse';

interface StatusCount {
  todo: number;
  in_progress: number;
  done: number;
  closed: number;
}

interface TaskItem {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  createdAt: string;
}

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  level: string;
  isRead: boolean;
  createdAt: string;
}

interface DailyTrend {
  date: string;
  created: number;
  completed: number;
  total: number;
}

export default function DashboardPage() {
  return <DashboardContent />;
}

function DashboardContent() {
  const [statusCounts, setStatusCounts] = useState<StatusCount>({ todo: 0, in_progress: 0, done: 0, closed: 0 });
  const [recentTasks, setRecentTasks] = useState<TaskItem[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<TaskItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dailyTrends, setDailyTrends] = useState<DailyTrend[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [counts, tasksRes, notifs, unread, trends] = await Promise.all([
        trpc.tasks.statusCounts.query(),
        trpc.tasks.list.query({ pageSize: 10, sortBy: 'createdAt', sortOrder: 'desc' }),
        trpc.notifications.list.query({ limit: 10 }),
        trpc.notifications.unreadCount.query(),
        trpc.stats.dailyTrends.query({ days: 14 }),
      ]);

      setStatusCounts(counts as unknown as StatusCount);
      setRecentTasks((tasksRes as any).items ?? []);
      setNotifications(notifs.notifications);
      setUnreadCount(unread);
      setDailyTrends(trends as unknown as DailyTrend[]);

      const now = new Date();
      const overdue = ((tasksRes as any).items ?? []).filter(
        (t: TaskItem) => t.dueDate && new Date(t.dueDate) < now && t.status !== 'done' && t.status !== 'closed',
      );
      setOverdueTasks(overdue);
    } catch (err: any) {
      console.error('Dashboard fetch error:', err);
    }
  }, []);

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  // SSE real-time refresh
  useSSE({
    channels: ['tasks', 'notifications'],
    onEvent: (event) => {
      if (event.type?.startsWith('task.') || event.type?.startsWith('notification.')) {
        fetchData();
      }
    },
  });

  const totalTasks = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const completionRate = totalTasks > 0 ? Math.round(((statusCounts.done + statusCounts.closed) / totalTasks) * 100) : 0;

  const statusColors: Record<string, string> = {
    todo: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    done: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
    closed: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
  };

  const statusLabels: Record<string, string> = {
    todo: '待办', in_progress: '进行中', done: '已完成', closed: '已关闭',
  };

  const levelColors: Record<string, string> = {
    info: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    warning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300',
    error: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
    success: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  };

  // Mini bar chart data
  const maxCreated = Math.max(...dailyTrends.map(d => d.created), 1);

  if (loading) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6 flex items-center justify-center text-gray-400">加载中...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">仪表盘</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">任务概览与数据分析</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="总任务数" value={totalTasks} color="text-gray-900 dark:text-gray-100" />
          <StatCard label="完成率" value={`${completionRate}%`} color="text-green-600 dark:text-green-400" />
          <StatCard label="进行中" value={statusCounts.in_progress} color="text-blue-600 dark:text-blue-400" />
          <StatCard label="超期任务" value={overdueTasks.length} color="text-red-600 dark:text-red-400" />
        </div>

        {/* Daily Trend Mini Chart */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-5 mb-6">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">📈 近 14 天趋势</h2>
          <div className="flex items-end gap-1 h-24">
            {dailyTrends.map((d) => (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex gap-0.5 items-end" style={{ height: '80px' }}>
                  <div
                    className="flex-1 bg-blue-400 dark:bg-blue-600 rounded-t-sm transition-all"
                    style={{ height: `${(d.created / maxCreated) * 100}%`, minHeight: d.created > 0 ? '4px' : '0' }}
                    title={`创建: ${d.created}`}
                  />
                  <div
                    className="flex-1 bg-green-400 dark:bg-green-600 rounded-t-sm transition-all"
                    style={{ height: `${(d.completed / maxCreated) * 100}%`, minHeight: d.completed > 0 ? '4px' : '0' }}
                    title={`完成: ${d.completed}`}
                  />
                </div>
                <span className="text-[10px] text-gray-400">{d.date.slice(5)}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-400 dark:bg-blue-600" /> 创建</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-400 dark:bg-green-600" /> 完成</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Status + Recent Tasks */}
          <div className="lg:col-span-2 space-y-6">
            {/* Status Distribution */}
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-5">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">状态分布</h2>
              <div className="space-y-3">
                {Object.entries(statusCounts).map(([status, count]) => {
                  const pct = totalTasks > 0 ? Math.round((count / totalTasks) * 100) : 0;
                  return (
                    <div key={status} className="flex items-center gap-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${statusColors[status]}`}>
                        {statusLabels[status]}
                      </span>
                      <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            status === 'todo' ? 'bg-gray-400 dark:bg-gray-500' :
                            status === 'in_progress' ? 'bg-blue-500 dark:bg-blue-600' :
                            status === 'done' ? 'bg-green-500 dark:bg-green-600' : 'bg-purple-500 dark:bg-purple-600'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-600 dark:text-gray-400 w-16 text-right">{count} ({pct}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent Tasks */}
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-5">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">最近任务</h2>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {recentTasks.length === 0 ? (
                  <div className="py-4 text-center text-gray-400 text-sm">暂无任务</div>
                ) : (
                  recentTasks.map((task) => (
                    <div key={task.id} className="py-3 flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-gray-100 text-sm">{task.title}</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {new Date(task.createdAt).toLocaleDateString()}
                          {task.dueDate && ` · 截止: ${new Date(task.dueDate).toLocaleDateString()}`}
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${statusColors[task.status] || 'bg-gray-100'}`}>
                        {statusLabels[task.status] || task.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Panel */}
          <div className="space-y-6">
            {/* Risk Alerts */}
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-5">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">⚠️ 风险预警</h2>
              {overdueTasks.length === 0 ? (
                <div className="py-4 text-center text-gray-400 text-sm">暂无风险</div>
              ) : (
                <div className="space-y-2">
                  {overdueTasks.slice(0, 5).map((task) => (
                    <div key={task.id} className="p-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                      <div className="text-sm font-medium text-red-800 dark:text-red-300">{task.title}</div>
                      <div className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                        截止: {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '未知'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notifications */}
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">🔔 通知</h2>
                {unreadCount > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">{unreadCount} 未读</span>
                )}
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-[400px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="py-4 text-center text-gray-400 text-sm">暂无通知</div>
                ) : (
                  notifications.map((notif) => (
                    <div key={notif.id} className="py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{notif.title}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${levelColors[notif.level] || 'bg-gray-100'}`}>
                          {notif.level}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{notif.message}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{new Date(notif.createdAt).toLocaleString()}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-4">
      <div className="text-sm text-gray-500 dark:text-gray-400">{label}</div>
      <div className={`text-3xl font-bold mt-1 ${color}`}>{value}</div>
    </div>
  );
}
