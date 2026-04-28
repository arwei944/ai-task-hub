'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { trpc } from '@/lib/trpc/client';

const STATUS_LABELS: Record<string, string> = {
  todo: '待办',
  in_progress: '进行中',
  done: '已完成',
  closed: '已关闭',
  deleted: '已删除',
};

const PRIORITY_LABELS: Record<string, string> = {
  urgent: '紧急',
  high: '高',
  medium: '中',
  low: '低',
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-green-100 text-green-800',
};

export function ListView() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchTasks = async () => {
    try {
      const query: any = { page, pageSize: 20 };
      if (search) query.search = search;
      if (statusFilter !== 'all') query.status = [statusFilter];
      const data = await trpc.tasks.list.query(query);
      setTasks(data.items);
      setTotal(data.total);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [page, statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchTasks();
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      await trpc.tasks.updateStatus.mutate({ id: taskId, status: newStatus as any });
      fetchTasks();
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1">
          <Input
            placeholder="搜索任务..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <Button type="submit" variant="secondary">
            搜索
          </Button>
        </form>
        <Select value={statusFilter} onValueChange={(v) => { if (v) { setStatusFilter(v); setPage(1); } }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="状态筛选" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="todo">待办</SelectItem>
            <SelectItem value="in_progress">进行中</SelectItem>
            <SelectItem value="done">已完成</SelectItem>
            <SelectItem value="closed">已关闭</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">标题</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>优先级</TableHead>
              <TableHead>进度</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>截止日期</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  暂无任务
                </TableCell>
              </TableRow>
            ) : (
              tasks.map((task: any) => (
                <TableRow key={task.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{task.title}</p>
                      {task.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{task.description}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{STATUS_LABELS[task.status] ?? task.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-xs ${PRIORITY_COLORS[task.priority] ?? ''}`}>
                      {PRIORITY_LABELS[task.priority] ?? task.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-secondary rounded-full h-2">
                        <div
                          className="bg-primary rounded-full h-2"
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">{task.progress}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs">{task.type}</span>
                  </TableCell>
                  <TableCell>
                    {task.dueDate ? (
                      <span className="text-xs">{new Date(task.dueDate).toLocaleDateString('zh-CN')}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {task.status === 'todo' && (
                        <Button size="sm" variant="outline" onClick={() => handleStatusChange(task.id, 'in_progress')}>
                          开始
                        </Button>
                      )}
                      {task.status === 'in_progress' && (
                        <Button size="sm" variant="outline" onClick={() => handleStatusChange(task.id, 'done')}>
                          完成
                        </Button>
                      )}
                      {task.status === 'done' && (
                        <Button size="sm" variant="outline" onClick={() => handleStatusChange(task.id, 'todo')}>
                          重开
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">共 {total} 条</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            上一页
          </Button>
          <span className="text-sm py-1">第 {page} 页</span>
          <Button size="sm" variant="outline" disabled={tasks.length < 20} onClick={() => setPage(page + 1)}>
            下一页
          </Button>
        </div>
      </div>
    </div>
  );
}
