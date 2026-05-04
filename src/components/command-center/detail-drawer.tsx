'use client';

import { useEffect, useState, useCallback } from 'react';
import { trpc } from '@/lib/trpc/client';
import { useToast } from '@/components/ui/toast';

interface DetailDrawerProps {
  item: { type: 'task' | 'doc' | 'agent'; id: string } | null;
  projectId?: string;
  onClose: () => void;
}

export function DetailDrawer({ item, projectId, onClose }: DetailDrawerProps) {
  const [taskData, setTaskData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { success, error: toastError } = useToast();

  const fetchTask = useCallback(async () => {
    if (!item || item.type !== 'task') return;
    try {
      setIsLoading(true);
      // 获取项目任务列表，从中找到目标任务
      const tasks = await trpc.projectHub.tasks.list.query({ projectId: projectId! });
      const task = (tasks as any)?.find?.((t: any) => t.id === item.id);
      setTaskData(task || null);
    } catch (err) {
      console.error('[DetailDrawer] Failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [item, projectId]);

  useEffect(() => {
    fetchTask();
  }, [fetchTask]);

  // Esc 关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!item) return null;

  const isOpen = item !== null;

  return (
    <>
      {/* 遮罩（可选，轻量） */}
      {isOpen && <div className="fixed inset-0 z-40 bg-black/10" onClick={onClose} />}

      {/* 抽屉 */}
      <div
        className={`fixed right-0 top-0 h-full w-96 max-w-full z-50 bg-card border-l shadow-2xl transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {item.type === 'task' ? '📋 任务详情' : item.type === 'doc' ? '📄 文档' : '🤖 智能体'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground"
          >
            ✕
          </button>
        </div>

        {/* 内容 */}
        <div className="p-4 overflow-y-auto h-[calc(100%-60px)]">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-muted-foreground animate-pulse text-sm">加载中...</div>
            </div>
          ) : item.type === 'task' && taskData ? (
            <div className="space-y-4">
              {/* 标题 */}
              <div>
                <h3 className="text-lg font-semibold">{taskData.title}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    taskData.status === 'done' ? 'bg-green-500/10 text-green-500' :
                    taskData.status === 'in_progress' ? 'bg-yellow-500/10 text-yellow-500' :
                    'bg-gray-500/10 text-gray-500'
                  }`}>
                    {taskData.status === 'done' ? '已完成' : taskData.status === 'in_progress' ? '进行中' : '待办'}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    taskData.priority === 'high' || taskData.priority === 'urgent' ? 'bg-red-500/10 text-red-500' :
                    taskData.priority === 'medium' ? 'bg-yellow-500/10 text-yellow-500' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {taskData.priority}
                  </span>
                  {taskData.type && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{taskData.type}</span>
                  )}
                </div>
              </div>

              {/* 描述 */}
              {taskData.description && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-1">描述</h4>
                  <p className="text-sm leading-relaxed">{taskData.description}</p>
                </div>
              )}

              {/* 元信息 */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2 rounded-lg bg-muted/30">
                  <span className="text-muted-foreground">创建时间</span>
                  <div className="font-medium mt-0.5">
                    {taskData.createdAt ? new Date(taskData.createdAt).toLocaleString('zh-CN') : '-'}
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-muted/30">
                  <span className="text-muted-foreground">更新时间</span>
                  <div className="font-medium mt-0.5">
                    {taskData.updatedAt ? new Date(taskData.updatedAt).toLocaleString('zh-CN') : '-'}
                  </div>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-2 pt-2">
                {taskData.status === 'todo' && (
                  <button
                    onClick={async () => {
                      try {
                        await trpc.projectHub.tasks.updateStatus.mutate({ id: taskData.id, status: 'in_progress' });
                        success('任务已开始', taskData.title);
                        fetchTask();
                      } catch (err) {
                        toastError('操作失败', '无法开始任务');
                      }
                    }}
                    className="flex-1 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    开始任务
                  </button>
                )}
                {taskData.status === 'in_progress' && (
                  <button
                    onClick={async () => {
                      try {
                        await trpc.projectHub.tasks.updateStatus.mutate({ id: taskData.id, status: 'done' });
                        success('任务已完成', taskData.title);
                        fetchTask();
                      } catch (err) {
                        toastError('操作失败', '无法完成任务');
                      }
                    }}
                    className="flex-1 py-2 text-sm rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors"
                  >
                    标记完成
                  </button>
                )}
                <button
                  onClick={async () => {
                    if (confirm('确定删除此任务？')) {
                      try {
                        await trpc.projectHub.tasks.delete.mutate({ id: taskData.id });
                        success('任务已删除', taskData.title);
                        onClose();
                      } catch (err) {
                        toastError('删除失败', '无法删除任务');
                      }
                    }
                  }}
                  className="py-2 px-4 text-sm rounded-lg border hover:bg-muted transition-colors text-red-500"
                >
                  删除
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <div className="text-3xl mb-2">📭</div>
              <div className="text-sm">内容未找到</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
