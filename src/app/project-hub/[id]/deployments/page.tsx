// ============================================================
// Deployments Management Page - /project-hub/[id]/deployments
// ============================================================
//
// Deployment and release management for the project.
// v4.2.0: Enhanced with environment cards and deployment history.
// ============================================================

'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Rocket, Plus, Globe, Server, Monitor, Shield, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface Environment {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  status: 'active' | 'inactive' | 'deploying';
  lastDeploy?: string;
  color: string;
}

const ENVIRONMENTS: Environment[] = [
  {
    id: 'dev',
    name: '开发环境',
    icon: <Monitor className="w-5 h-5" />,
    description: '日常开发和调试使用的环境',
    status: 'active',
    lastDeploy: '2025-05-02 14:30',
    color: 'blue',
  },
  {
    id: 'staging',
    name: '测试环境',
    icon: <Server className="w-5 h-5" />,
    description: '集成测试和预发布验证环境',
    status: 'active',
    lastDeploy: '2025-05-01 10:00',
    color: 'amber',
  },
  {
    id: 'production',
    name: '生产环境',
    icon: <Shield className="w-5 h-5" />,
    description: '面向用户的生产部署环境',
    status: 'active',
    lastDeploy: '2025-04-28 08:00',
    color: 'emerald',
  },
];

function getStatusIcon(status: string) {
  switch (status) {
    case 'active':
      return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    case 'deploying':
      return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-red-500" />;
    default:
      return <Clock className="w-4 h-4 text-gray-400" />;
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'active':
      return '运行中';
    case 'deploying':
      return '部署中';
    case 'failed':
      return '失败';
    default:
      return '未知';
  }
}

export default function ProjectDeploymentsPage() {
  const params = useParams();
  const projectId = params?.id as string;
  const [loading, setLoading] = useState(true);

  useEffect(() => { setLoading(false); }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">部署管理</h1>
          <p className="text-gray-500 text-sm mt-1">管理项目的部署和发布</p>
        </div>
        <Button><Plus className="w-4 h-4 mr-2" />新建部署</Button>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          {/* Environment Cards */}
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">环境管理</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {ENVIRONMENTS.map((env) => (
                <Card key={env.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-${env.color}-100 dark:bg-${env.color}-950 text-${env.color}-600 dark:text-${env.color}-400`}>
                          {env.icon}
                        </div>
                        <div>
                          <CardTitle className="text-sm font-semibold">{env.name}</CardTitle>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {getStatusIcon(env.status)}
                            <span className="text-xs text-gray-500">{getStatusLabel(env.status)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{env.description}</p>
                    {env.lastDeploy && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">最近部署: {env.lastDeploy}</span>
                        <Button size="sm" variant="outline">部署</Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Deployment History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                部署历史
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { version: 'v1.2.0', env: '生产环境', status: 'success', time: '2025-04-28 08:00', user: 'Agent-Deployer' },
                  { version: 'v1.2.0-rc1', env: '测试环境', status: 'success', time: '2025-04-27 16:30', user: 'Agent-Tester' },
                  { version: 'v1.1.9', env: '生产环境', status: 'failed', time: '2025-04-26 09:15', user: 'Agent-Deployer' },
                ].map((deploy, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-3 px-4 rounded-lg border border-gray-200 dark:border-gray-800"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(deploy.status === 'success' ? 'active' : 'failed')}
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {deploy.version}
                          <Badge variant="outline" className="ml-2 text-[10px]">{deploy.env}</Badge>
                        </p>
                        <p className="text-xs text-gray-400">由 {deploy.user} 部署</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-gray-400">{deploy.time}</span>
                      <Badge
                        variant={deploy.status === 'success' ? 'default' : 'destructive'}
                        className={deploy.status === 'success' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : ''}
                      >
                        {deploy.status === 'success' ? '成功' : '失败'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
