// ============================================================
// Templates Page - /project-hub/templates
// ============================================================
//
// Template center placeholder for Phase 3.
// Shows static template cards for common project types.
// ============================================================

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  LayoutTemplate,
  Code2,
  Smartphone,
  Palette,
  Lock,
} from 'lucide-react';

// ---- Static template data ----

const templates = [
  {
    id: 'software-dev',
    name: '软件开发',
    description: '适用于 Web 应用、后端服务、微服务等软件开发项目，包含需求分析、开发、测试、部署等标准阶段。',
    icon: Code2,
    color: 'blue' as const,
    tags: ['Web', '后端', '微服务'],
    phases: 6,
  },
  {
    id: 'mobile-app',
    name: '移动应用',
    description: '适用于 iOS/Android 移动应用开发，包含 UI 设计、原生开发、跨平台适配、应用商店发布等阶段。',
    icon: Smartphone,
    color: 'violet' as const,
    tags: ['iOS', 'Android', 'Flutter'],
    phases: 5,
  },
  {
    id: 'product-design',
    name: '产品设计',
    description: '适用于产品设计项目，包含用户研究、原型设计、交互设计、视觉设计、用户测试等阶段。',
    icon: Palette,
    color: 'rose' as const,
    tags: ['UX', 'UI', '原型'],
    phases: 5,
  },
];

const colorClasses = {
  blue: {
    bg: 'bg-blue-100 dark:bg-blue-950',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800',
  },
  violet: {
    bg: 'bg-violet-100 dark:bg-violet-950',
    text: 'text-violet-600 dark:text-violet-400',
    border: 'border-violet-200 dark:border-violet-800',
  },
  rose: {
    bg: 'bg-rose-100 dark:bg-rose-950',
    text: 'text-rose-600 dark:text-rose-400',
    border: 'border-rose-200 dark:border-rose-800',
  },
};

// ---- Component ----

export default function TemplatesPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">模板中心</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          从预置模板快速创建项目
        </p>
      </div>

      {/* Phase notice */}
      <Card className="border-dashed border-blue-300 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
        <CardContent className="py-4 flex items-center gap-3">
          <Lock className="w-5 h-5 text-blue-500 shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-700 dark:text-blue-300">模板系统将在 Phase 3 实现</p>
            <p className="text-xs text-blue-500 dark:text-blue-400 mt-0.5">
              当前展示为预览状态，完整功能包括自定义模板、模板市场、团队模板共享等。
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Template cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => {
          const Icon = template.icon;
          const colors = colorClasses[template.color];

          return (
            <Card
              key={template.id}
              className={`hover:shadow-md transition-shadow ${colors.border}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${colors.text}`} />
                  </div>
                  <div>
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    <p className="text-xs text-gray-400 mt-0.5">{template.phases} 个阶段</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                  {template.description}
                </p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {template.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-[10px]">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="w-full" disabled>
                  <LayoutTemplate className="w-3.5 h-3.5 mr-1.5" />
                  即将推出
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
