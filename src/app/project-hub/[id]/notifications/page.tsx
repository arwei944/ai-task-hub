// ============================================================
// Notifications Management Page - /project-hub/[id]/notifications
// ============================================================
//
// Notification settings and recent notifications for the project.
// v4.2.0: Enhanced with toggle switches and notification list.
// ============================================================

'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Plus, Settings, Mail, Flag, Bot, FileText, GitBranch, Clock, CheckCircle, AlertTriangle } from 'lucide-react';

interface NotificationSetting {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
}

interface NotificationItem {
  id: string;
  title: string;
  description: string;
  type: 'info' | 'warning' | 'success';
  time: string;
  read: boolean;
}

export default function ProjectNotificationsPage() {
  const params = useParams();
  const projectId = params?.id as string;
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<NotificationSetting[]>([
    {
      id: 'milestone-due',
      name: '里程碑到期提醒',
      description: '当里程碑即将到期或已逾期时发送通知',
      icon: <Flag className="w-4 h-4 text-blue-500" />,
      enabled: true,
    },
    {
      id: 'task-status-change',
      name: '任务状态变更',
      description: '当任务状态发生变更时发送通知',
      icon: <CheckCircle className="w-4 h-4 text-emerald-500" />,
      enabled: true,
    },
    {
      id: 'agent-work-log',
      name: '智能体工作日志',
      description: '当智能体提交工作日志时发送通知',
      icon: <Bot className="w-4 h-4 text-violet-500" />,
      enabled: false,
    },
    {
      id: 'dependency-change',
      name: '依赖变更通知',
      description: '当项目依赖关系发生变更时发送通知',
      icon: <GitBranch className="w-4 h-4 text-amber-500" />,
      enabled: true,
    },
  ]);
  const [recentNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => { setLoading(false); }, []);

  const toggleSetting = (id: string) => {
    setSettings((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">通知管理</h1>
          <p className="text-gray-500 text-sm mt-1">管理项目相关的通知和提醒</p>
        </div>
        <Button><Plus className="w-4 h-4 mr-2" />新建通知规则</Button>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="w-4 h-4 text-gray-400" />
                通知设置
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {settings.map((setting) => (
                  <div
                    key={setting.id}
                    className="flex items-center justify-between py-3 px-4 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                        {setting.icon}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{setting.name}</p>
                        <p className="text-xs text-gray-400">{setting.description}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleSetting(setting.id)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        setting.enabled
                          ? 'bg-blue-500'
                          : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          setting.enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="w-4 h-4 text-gray-400" />
                最近通知
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentNotifications.length === 0 ? (
                <div className="flex flex-col items-center py-8 gap-3">
                  <Bell className="w-12 h-12 text-gray-300 dark:text-gray-600" />
                  <p className="text-sm text-gray-400">暂无通知</p>
                  <p className="text-xs text-gray-400">开启通知设置后，通知将显示在此处</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className="flex items-center justify-between py-3 px-4 rounded-lg border border-gray-200 dark:border-gray-800"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${
                          notification.type === 'warning' ? 'bg-amber-500' :
                          notification.type === 'success' ? 'bg-emerald-500' :
                          'bg-blue-500'
                        }`} />
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{notification.title}</p>
                          <p className="text-xs text-gray-400">{notification.description}</p>
                        </div>
                      </div>
                      <span className="text-xs text-gray-400">{notification.time}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
