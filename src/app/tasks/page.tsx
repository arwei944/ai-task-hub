'use client';

import { useState, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KanbanView } from '@/components/modules/task-core/kanban-view';
import { ListView } from '@/components/modules/task-core/list-view';
import { CreateTaskDialog } from '@/components/modules/task-core/create-task-dialog';
import { AIExtractDialog } from '@/components/modules/ai-engine/ai-extract-dialog';
import { AIAssistantPanel } from '@/components/modules/ai-engine/ai-assistant-panel';
import { useSSE } from '@/lib/hooks/use-sse';

export default function TasksPage() {
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [refreshKey, setRefreshKey] = useState(0);
  const [sseToast, setSseToast] = useState<string | null>(null);

  const handleTaskCreated = () => {
    setRefreshKey((k) => k + 1);
  };

  // SSE real-time updates
  const handleSSEEvent = useCallback((event: any) => {
    if (event.type?.startsWith('task.')) {
      setRefreshKey((k) => k + 1);
      const labels: Record<string, string> = {
        'task.created': '🆕 新任务已创建',
        'task.updated': '✏️ 任务已更新',
        'task.deleted': '🗑️ 任务已删除',
        'task.status_changed': '🔄 任务状态已变更',
        'task.priority_changed': '⚡ 任务优先级已变更',
        'task.completed': '✅ 任务已完成',
      };
      const label = labels[event.type] ?? `📋 ${event.type}`;
      setSseToast(label);
      setTimeout(() => setSseToast(null), 3000);
    }
  }, []);

  useSSE({
    channels: ['tasks'],
    onEvent: handleSSEEvent,
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">任务管理</h1>
            <Badge variant="secondary">M3</Badge>
            {sseToast && (
              <span className="text-sm text-blue-600 animate-pulse">{sseToast}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <AIExtractDialog onCreated={handleTaskCreated} />
            <CreateTaskDialog onCreated={handleTaskCreated} />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-6">
        <Tabs value={view} onValueChange={(v) => setView(v as 'kanban' | 'list')}>
          <TabsList>
            <TabsTrigger value="kanban">看板视图</TabsTrigger>
            <TabsTrigger value="list">列表视图</TabsTrigger>
          </TabsList>
          <TabsContent value="kanban" className="mt-6">
            <KanbanView key={refreshKey} />
          </TabsContent>
          <TabsContent value="list" className="mt-6">
            <ListView key={refreshKey} />
          </TabsContent>
        </Tabs>
        <AIAssistantPanel />
      </main>
    </div>
  );
}
