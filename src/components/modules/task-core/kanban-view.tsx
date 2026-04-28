'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/lib/trpc/client';
import { TaskDetailDrawer } from './task-detail-drawer';

const COLUMNS = [
  { id: 'todo', title: '待办', color: 'bg-slate-500' },
  { id: 'in_progress', title: '进行中', color: 'bg-blue-500' },
  { id: 'done', title: '已完成', color: 'bg-green-500' },
  { id: 'closed', title: '已关闭', color: 'bg-gray-400' },
] as const;

const PRIORITY_STYLES: Record<string, string> = {
  urgent: 'bg-red-100 text-red-800 border-red-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-green-100 text-green-800 border-green-200',
};

const PRIORITY_LABELS: Record<string, string> = {
  urgent: '紧急',
  high: '高',
  medium: '中',
  low: '低',
};

interface TaskItem {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  progress: number;
  type: string;
  dueDate: string | null;
  _count: { subTasks: number };
  tags: { tag: { id: string; name: string; color: string } }[];
}

export function KanbanView() {
  const [tasks, setTasks] = useState<Record<string, TaskItem[]>>({
    todo: [],
    in_progress: [],
    done: [],
    closed: [],
  });
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    async function fetchTasks() {
      try {
        const data = await trpc.tasks.list.query({ pageSize: 100 });
        const grouped: Record<string, TaskItem[]> = {
          todo: [],
          in_progress: [],
          done: [],
          closed: [],
        };
        for (const task of data.items) {
          const status = task.status as keyof typeof grouped;
          if (grouped[status]) {
            grouped[status].push(task as TaskItem);
          }
        }
        setTasks(grouped);
      } catch (error) {
        console.error('Failed to fetch tasks:', error);
      }
    }
    fetchTasks();
  }, []);

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      await trpc.tasks.updateStatus.mutate({ id: taskId, status: newStatus as any });
      // Refresh
      const data = await trpc.tasks.list.query({ pageSize: 100 });
      const grouped: Record<string, TaskItem[]> = { todo: [], in_progress: [], done: [], closed: [] };
      for (const task of data.items) {
        const status = task.status as keyof typeof grouped;
        if (grouped[status]) grouped[status].push(task as TaskItem);
      }
      setTasks(grouped);
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const getNextStatus = (current: string): string | null => {
    const transitions: Record<string, string | null> = {
      todo: 'in_progress',
      in_progress: 'done',
      done: 'todo',
      closed: null,
    };
    return transitions[current] ?? null;
  };

  return (
    <>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {COLUMNS.map((col) => (
        <div key={col.id} className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <div className={`h-3 w-3 rounded-full ${col.color}`} />
            <h3 className="font-semibold text-sm">{col.title}</h3>
            <Badge variant="secondary" className="text-xs">
              {tasks[col.id]?.length ?? 0}
            </Badge>
          </div>

          <div className="space-y-2 min-h-[200px]">
            {(tasks[col.id] ?? []).map((task) => {
              const nextStatus = getNextStatus(task.status);
              return (
                <Card
                  key={task.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => { setSelectedTask(task); setDrawerOpen(true); }}
                >
                  <CardHeader className="p-3 pb-1">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-sm font-medium leading-tight">
                        {task.title}
                      </CardTitle>
                      <Badge
                        variant="outline"
                        className={`text-[10px] shrink-0 ${PRIORITY_STYLES[task.priority] ?? ''}`}
                      >
                        {PRIORITY_LABELS[task.priority] ?? task.priority}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 space-y-2">
                    {task.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {task.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                      {task.tags?.map((t) => (
                        <Badge key={t.tag.id} variant="outline" className="text-[10px]">
                          {t.tag.name}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{task.type}</span>
                      {task._count.subTasks > 0 && (
                        <span>子任务: {task._count.subTasks}</span>
                      )}
                      {task.dueDate && (
                        <span>{new Date(task.dueDate).toLocaleDateString('zh-CN')}</span>
                      )}
                    </div>
                    {task.progress > 0 && task.progress < 100 && (
                      <div className="w-full bg-secondary rounded-full h-1.5">
                        <div
                          className="bg-primary rounded-full h-1.5 transition-all"
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                    )}
                    {nextStatus && (
                      <p className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100">
                        点击 → {COLUMNS.find((c) => c.id === nextStatus)?.title}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>

    <TaskDetailDrawer
      task={selectedTask}
      open={drawerOpen}
      onClose={() => { setDrawerOpen(false); setSelectedTask(null); }}
      onStatusChange={async (taskId, newStatus) => {
        await handleStatusChange(taskId, newStatus);
        setDrawerOpen(false);
        setSelectedTask(null);
      }}
    />
    </>
  );
}
