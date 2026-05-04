'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { trpc } from '@/lib/trpc/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Plus, Circle, Clock, CheckCircle2, Trash2, AlertCircle,
  ChevronDown, ChevronUp, ArrowUpCircle, ArrowDownCircle,
} from 'lucide-react';

interface TaskItem {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  progress: number;
  createdAt: string;
  dueDate?: string;
}

const COLUMNS = [
  { key: 'todo', label: '待办', icon: Circle, color: 'text-gray-400', bg: 'bg-gray-50 dark:bg-gray-900/50' },
  { key: 'in_progress', label: '进行中', icon: Clock, color: 'text-blue-500', bg: 'bg-blue-50/50 dark:bg-blue-950/20' },
  { key: 'done', label: '已完成', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50/50 dark:bg-emerald-950/20' },
];

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

export default function ProjectTasksPage() {
  const params = useParams();
  const projectId = params?.id as string;
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({ total: 0, todo: 0, in_progress: 0, done: 0, closed: 0 });
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState('medium');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [mobileColumn, setMobileColumn] = useState<string>('todo');

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const data = await trpc.projectHub.tasks.list.query({ projectId });
      setTasks((data as { items?: unknown[] })?.items || []);
      const s = await trpc.projectHub.tasks.stats.query({ projectId });
      setStats(s as Record<string, unknown>);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      await trpc.projectHub.tasks.create.mutate({
        projectId,
        title: newTitle.trim(),
        description: newDesc.trim() || undefined,
        priority: newPriority as string,
      });
      setNewTitle('');
      setNewDesc('');
      setShowCreateForm(false);
      fetchTasks();
    } catch (err) {
      console.error('Failed to create task:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      await trpc.projectHub.tasks.updateStatus.mutate({ id: taskId, status: newStatus as string });
      fetchTasks();
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  };

  const handleDelete = async (taskId: string) => {
    try {
      await trpc.projectHub.tasks.delete.mutate({ id: taskId });
      fetchTasks();
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  const getColumnTasks = (status: string) => tasks.filter(t => t.status === status);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">任务看板</h1>
          <p className="text-gray-500 text-sm mt-1">
            共 {stats.total} 个任务 · {stats.todo} 待办 · {stats.in_progress} 进行中 · {stats.done} 已完成
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(!showCreateForm)}>
          <Plus className="w-4 h-4 mr-2" />新建任务
        </Button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <input
              placeholder="任务标题"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-700"
              autoFocus
            />
            <textarea
              placeholder="任务描述（可选）"
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-700"
              rows={2}
            />
            <div className="flex items-center gap-3">
              <select
                value={newPriority}
                onChange={e => setNewPriority(e.target.value)}
                className="px-3 py-1.5 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-700"
              >
                <option value="urgent">紧急</option>
                <option value="high">高</option>
                <option value="medium">中</option>
                <option value="low">低</option>
              </select>
              <div className="flex-1" />
              <Button variant="ghost" size="sm" onClick={() => setShowCreateForm(false)}>取消</Button>
              <Button size="sm" onClick={handleCreate} disabled={creating || !newTitle.trim()}>
                {creating ? '创建中...' : '创建'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Kanban Board */}
      {loading ? (
        <div className="animate-pulse grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-64 bg-gray-100 dark:bg-gray-800 rounded-lg" />)}
        </div>
      ) : (
        <>
          {/* Mobile column selector */}
          <div className="flex md:hidden gap-2">
            {COLUMNS.map(col => {
              const Icon = col.icon;
              const count = getColumnTasks(col.key).length;
              return (
                <button
                  key={col.key}
                  onClick={() => setMobileColumn(col.key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                    mobileColumn === col.key
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                      : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {col.label}
                  <span className="text-xs opacity-70">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Desktop: 3 columns, Mobile: single column */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {COLUMNS.map(col => {
              const colTasks = getColumnTasks(col.key);
              const Icon = col.icon;
              // On mobile, only show the selected column
              const isHiddenOnMobile = col.key !== mobileColumn;
              return (
                <div
                  key={col.key}
                  className={`rounded-xl p-3 ${col.bg} ${isHiddenOnMobile ? 'hidden md:block' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <Icon className={`w-4 h-4 ${col.color}`} />
                    <span className="text-sm font-medium">{col.label}</span>
                    <Badge variant="secondary" className="ml-auto text-xs">{colTasks.length}</Badge>
                  </div>
                  <div className="space-y-2 min-h-[200px]">
                    {colTasks.length === 0 ? (
                      <p className="text-center text-gray-400 text-xs py-8">暂无任务</p>
                    ) : (
                      colTasks.map(task => (
                        <Card key={task.id} className="shadow-sm hover:shadow-md transition-shadow">
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-medium leading-tight flex-1">{task.title}</p>
                              <Badge className={`text-[10px] px-1.5 py-0 ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium}`}>
                                {task.priority === 'urgent' ? '紧急' : task.priority === 'high' ? '高' : task.priority === 'medium' ? '中' : '低'}
                              </Badge>
                            </div>
                            {task.description && (
                              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</p>
                            )}
                            <div className="flex items-center gap-1 mt-2">
                              {/* Move left */}
                              {col.key !== 'todo' && (
                                <button
                                  onClick={() => handleStatusChange(task.id, col.key === 'done' ? 'in_progress' : 'todo')}
                                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                  title="向左移动"
                                >
                                  <ChevronUp className="w-3 h-3 text-gray-400" />
                                </button>
                              )}
                              {/* Move right */}
                              {col.key !== 'done' && (
                                <button
                                  onClick={() => handleStatusChange(task.id, col.key === 'todo' ? 'in_progress' : 'done')}
                                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                  title="向右移动"
                                >
                                  <ChevronDown className="w-3 h-3 text-gray-400" />
                                </button>
                              )}
                              <div className="flex-1" />
                              {/* Delete */}
                              <button
                                onClick={() => handleDelete(task.id)}
                                className="p-1 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                                title="删除"
                              >
                                <Trash2 className="w-3 h-3 text-gray-400 hover:text-red-500" />
                              </button>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
