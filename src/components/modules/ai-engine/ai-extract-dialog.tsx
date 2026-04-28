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
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { trpc } from '@/lib/trpc/client';

interface AIExtractDialogProps {
  onCreated?: () => void;
}

export function AIExtractDialog({ onCreated }: AIExtractDialogProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [results, setResults] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);

  const handleExtract = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const data = await trpc.ai.extractTasks.mutate({ text: text.trim() });
      setResults(data);
    } catch (error) {
      console.error('Failed to extract tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (task: any) => {
    setCreating(task.title);
    try {
      await trpc.tasks.create.mutate({
        title: task.title,
        description: task.description,
        priority: task.priority,
        type: task.type,
        tags: task.tags,
        source: 'ai',
      });
      // Remove from results
      setResults((prev) => prev?.filter((t) => t.title !== task.title) ?? null);
      onCreated?.();
    } catch (error) {
      console.error('Failed to create task:', error);
    } finally {
      setCreating(null);
    }
  };

  const handleCreateAll = async () => {
    if (!results) return;
    for (const task of results) {
      try {
        await trpc.tasks.create.mutate({
          title: task.title,
          description: task.description,
          priority: task.priority,
          type: task.type,
          tags: task.tags,
          source: 'ai',
        });
      } catch (error) {
        console.error(`Failed to create task "${task.title}":`, error);
      }
    }
    setResults(null);
    setText('');
    setOpen(false);
    onCreated?.();
  };

  const handleClose = () => {
    setOpen(false);
    setResults(null);
    setText('');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger>
        <Button variant="outline">AI 提取任务</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>AI 任务提取</DialogTitle>
          <DialogDescription>
            粘贴文本内容，AI 会自动识别其中的任务、行动项和待办事项。
          </DialogDescription>
        </DialogHeader>

        {!results ? (
          <div className="space-y-4">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="粘贴会议记录、文档内容、聊天记录等文本...&#10;&#10;例如：&#10;明天需要完成用户认证模块的开发，优先级比较高。&#10;后天要修复登录页面的 bug。&#10;下周五前需要写完 API 文档。"
              rows={8}
            />
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                取消
              </Button>
              <Button onClick={handleExtract} disabled={!text.trim() || loading}>
                {loading ? 'AI 分析中...' : '提取任务'}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                识别到 {results.length} 个任务
              </p>
              <Button size="sm" onClick={handleCreateAll}>
                全部创建
              </Button>
            </div>

            <div className="space-y-2">
              {results.map((task, i) => (
                <Card key={i}>
                  <CardHeader className="p-3 pb-1">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-sm font-medium">{task.title}</CardTitle>
                      <div className="flex gap-1 shrink-0">
                        <Badge variant="outline" className="text-[10px]">
                          {Math.round(task.confidence * 100)}%
                        </Badge>
                        {task.priority && (
                          <Badge variant="secondary" className="text-[10px]">
                            {task.priority}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  {task.description && (
                    <CardContent className="p-3 pt-0">
                      <p className="text-xs text-muted-foreground">{task.description}</p>
                      <div className="flex gap-1 mt-2">
                        {task.tags?.map((tag: string) => (
                          <Badge key={tag} variant="outline" className="text-[10px]">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <Button
                        size="sm"
                        className="mt-2"
                        onClick={() => handleCreateTask(task)}
                        disabled={creating === task.title}
                      >
                        {creating === task.title ? '创建中...' : '创建此任务'}
                      </Button>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setResults(null)}>
                重新提取
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
