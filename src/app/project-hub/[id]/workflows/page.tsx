// ============================================================
// Workflows Management Page - /project-hub/[id]/workflows
// ============================================================
//
// Workflow template management for the project.
// v4.2.0: Enhanced with workflow template cards.
// ============================================================

'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GitBranch, Plus, Play, Clock, CheckCircle, Code2, TestTube, GitPullRequest, MessageSquare, Package } from 'lucide-react';

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: string;
  steps: number;
  enabled: boolean;
}

const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'code-review',
    name: '代码审查流程',
    description: '自动化代码审查流程，包括静态分析、安全扫描和人工审查环节',
    icon: <Code2 className="w-5 h-5" />,
    category: '质量保障',
    steps: 4,
    enabled: false,
  },
  {
    id: 'deploy-pipeline',
    name: '部署流水线',
    description: '从代码提交到生产部署的完整 CI/CD 流水线，支持多环境管理',
    icon: <GitBranch className="w-5 h-5" />,
    category: 'DevOps',
    steps: 6,
    enabled: false,
  },
  {
    id: 'test-automation',
    name: '测试自动化',
    description: '自动化测试套件，包括单元测试、集成测试和端到端测试',
    icon: <TestTube className="w-5 h-5" />,
    category: '质量保障',
    steps: 5,
    enabled: false,
  },
  {
    id: 'requirement-approval',
    name: '需求变更审批',
    description: '需求变更的审批流程，支持多级审批和影响分析',
    icon: <MessageSquare className="w-5 h-5" />,
    category: '项目管理',
    steps: 3,
    enabled: false,
  },
  {
    id: 'release-management',
    name: '发布管理',
    description: '版本发布管理流程，包括版本号管理、发布检查清单和回滚机制',
    icon: <Package className="w-5 h-5" />,
    category: 'DevOps',
    steps: 5,
    enabled: false,
  },
];

export default function ProjectWorkflowsPage() {
  const params = useParams();
  const projectId = params?.id as string;
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState(WORKFLOW_TEMPLATES);

  useEffect(() => { setLoading(false); }, []);

  const toggleTemplate = (id: string) => {
    setTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t)),
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">工作流管理</h1>
          <p className="text-gray-500 text-sm mt-1">管理项目相关的自动化工作流</p>
        </div>
        <Button><Plus className="w-4 h-4 mr-2" />新建工作流</Button>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          {/* Workflow Templates */}
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">工作流模板</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((template) => (
                <Card
                  key={template.id}
                  className={`transition-all ${template.enabled ? 'border-blue-300 dark:border-blue-700 bg-blue-50/30 dark:bg-blue-950/10' : ''}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          template.enabled
                            ? 'bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                        }`}>
                          {template.icon}
                        </div>
                        <div>
                          <CardTitle className="text-sm font-semibold">{template.name}</CardTitle>
                          <Badge variant="outline" className="text-[10px] mt-0.5">{template.category}</Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">
                      {template.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">{template.steps} 个步骤</span>
                      <Button
                        size="sm"
                        variant={template.enabled ? 'default' : 'outline'}
                        onClick={() => toggleTemplate(template.id)}
                      >
                        {template.enabled ? (
                          <>
                            <CheckCircle className="w-3 h-3 mr-1" />
                            已启用
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3 mr-1" />
                            启用
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Active Workflows */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                最近执行记录
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-400 py-4 text-center">
                启用工作流模板后，执行记录将显示在此处
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
