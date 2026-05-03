'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, Plus, Settings, Mail } from 'lucide-react';

export default function ProjectNotificationsPage() {
  const params = useParams();
  const projectId = params?.id as string;
  const [loading, setLoading] = useState(true);

  useEffect(() => { setLoading(false); }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">通知管理</h1>
          <p className="text-gray-500 text-sm mt-1">管理项目相关的通知和提醒</p>
        </div>
        <Button><Plus className="w-4 h-4 mr-2" />新建通知规则</Button>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-lg" />)}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">暂无通知规则</p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
              通知系统将在后续版本中深度集成到项目管理流程中
            </p>
            <p className="text-gray-400 dark:text-gray-500 text-xs mt-2">
              项目 ID: {projectId}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
