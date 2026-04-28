'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { trpc } from '@/lib/trpc/client';

interface AIDecomposeDialogProps {
  taskId: string;
  taskTitle: string;
  taskDescription?: string | null;
  onCreated?: () => void;
}

export function AIDecomposeDialog({ taskId, taskTitle, taskDescription, onCreated }: AIDecomposeDialogProps) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const handleDecompose = async () => {
    setLoading(true);
    try {
      const data = await trpc.ai.decomposeTask.mutate({
        title: taskTitle,
        description: taskDescription ?? undefined,
      });
      setResult(data);
    } catch (error) {
      console.error('Failed to decompose task:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubTasks = async () => {
    if (!result?.subTasks) return;
    setCreating(true);
    try {
      for (const sub of result.subTasks) {
        await trpc.tasks.create.mutate({
          title: sub.title,
          description: sub.description,
          priority: sub.priority,
          parentTaskId: taskId,
          source: 'ai',
        });
      }
      setOpen(false);
      setResult(null);
      onCreated?.();
    } catch (error) {
      console.error('Failed to create subtasks:', error);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button variant="outline" size="sm">AI 拆解</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>AI 任务拆解</DialogTitle>
          <DialogDescription>
            将「{taskTitle}」拆解为可执行的子任务。
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            <Card>
              <CardHeader className="p-3">
                <CardTitle className="text-sm">原始任务</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <p className="text-sm">{taskTitle}</p>
                {taskDescription && (
                  <p className="text-xs text-muted-foreground mt-1">{taskDescription}</p>
                )}
              </CardContent>
            </Card>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button onClick={handleDecompose} disabled={loading}>
                {loading ? 'AI 分析中...' : '开始拆解'}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            {result.reasoning && (
              <div className="bg-muted p-3 rounded-md">
                <p className="text-xs font-medium mb-1">拆解理由</p>
                <p className="text-xs text-muted-foreground">{result.reasoning}</p>
              </div>
            )}

            <div className="space-y-2">
              {result.subTasks.map((sub: any, i: number) => (
                <Card key={i}>
                  <CardHeader className="p-3 pb-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-mono">#{sub.order + 1}</span>
                        <CardTitle className="text-sm font-medium">{sub.title}</CardTitle>
                      </div>
                      <div className="flex gap-1">
                        {sub.priority && (
                          <Badge variant="secondary" className="text-[10px]">
                            {sub.priority}
                          </Badge>
                        )}
                        {sub.estimatedEffort && (
                          <Badge variant="outline" className="text-[10px]">
                            {sub.estimatedEffort}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <p className="text-xs text-muted-foreground">{sub.description}</p>
                    {sub.dependencies && sub.dependencies.length > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        依赖: #{sub.dependencies.map((d: number) => d + 1).join(', #')}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setResult(null)}>
                重新拆解
              </Button>
              <Button onClick={handleCreateSubTasks} disabled={creating}>
                {creating ? '创建中...' : `创建 ${result.subTasks.length} 个子任务`}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
