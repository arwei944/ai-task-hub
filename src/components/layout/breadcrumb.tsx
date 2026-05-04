'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';

/** Map of path segments to display labels */
const SEGMENT_LABELS: Record<string, string> = {
  'project-hub': '项目',
  'tasks': '任务',
  'workflows': '工作流',
  'agents': '智能体',
  'plugins': '插件',
  'settings': '设置',
  'notifications': '通知',
  'deployments': '部署',
  'integrations': '集成',
  'ops': '运维',
  'observability': '可观测性',
  'dashboard': '仪表盘',
  'api-docs': 'API 文档',
  'plugin-market': '插件市场',
  'feedback': '反馈',
  'releases': '版本记录',
  'about': '关于',
  'admin': '管理',
  'users': '用户',
  'modules': '模块',
  'templates': '模板',
  'timeline': '时间线',
  'dependencies': '依赖关系',
  'docs': '文档',
  'team': '工作台',
  'activity': '活动',
  'linkage': '联动',
  'events': '事件',
  'topology': '拓扑',
  'interventions': '干预',
  'ai': 'AI',
  'dashboard-settings': '仪表盘设置',
  'agent-workflows': 'Agent 工作流',
  'workspaces': '工作区',
  'login': '登录',
};

interface BreadcrumbItem {
  label: string;
  href: string;
}

export function Breadcrumb() {
  const pathname = usePathname();

  // Don't show breadcrumb on home page
  if (pathname === '/') return null;

  const segments = pathname.split('/').filter(Boolean);
  const items: BreadcrumbItem[] = [];

  let currentPath = '';
  for (const segment of segments) {
    currentPath += `/${segment}`;
    // Skip dynamic segments (e.g., [id])
    if (segment.startsWith('[') && segment.endsWith(']')) {
      const label = segment.slice(1, -1);
      items.push({ label: `#${label}`, href: currentPath });
    } else {
      items.push({
        label: SEGMENT_LABELS[segment] ?? segment,
        href: currentPath,
      });
    }
  }

  // Don't show if only 1 segment (top-level pages are self-explanatory)
  if (items.length <= 1) return null;

  return (
    <nav className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 py-2 px-1" aria-label="Breadcrumb">
      <Link href="/" className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
        <Home className="w-3.5 h-3.5" />
      </Link>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={item.href} className="flex items-center gap-1">
            <ChevronRight className="w-3 h-3 text-gray-300 dark:text-gray-600" />
            {isLast ? (
              <span className="font-medium text-gray-700 dark:text-gray-200">{item.label}</span>
            ) : (
              <Link href={item.href} className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
