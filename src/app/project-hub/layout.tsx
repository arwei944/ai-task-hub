// ============================================================
// Project Hub Layout - /project-hub
// ============================================================
//
// Project management center layout with sub-navigation sidebar
// for: Overview, Templates
// ============================================================

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  LayoutTemplate,
  FolderKanban,
  ArrowLeft,
  GanttChart,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface ProjectHubNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const projectHubNavItems: ProjectHubNavItem[] = [
  { href: '/project-hub', label: '项目总览', icon: LayoutDashboard },
  { href: '/project-hub/templates', label: '模板中心', icon: LayoutTemplate },
  { href: '/project-hub/timeline', label: '时间线', icon: GanttChart },
];

export default function ProjectHubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (href: string) => {
    if (href === '/project-hub') return pathname === '/project-hub';
    return pathname.startsWith(href);
  };

  return (
    <div className="flex h-full">
      {/* Project Hub sub-navigation sidebar */}
      <aside
        className={`hidden md:flex flex-col h-screen sticky top-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-200 ${
          collapsed ? 'w-[52px]' : 'w-[180px]'
        }`}
        role="navigation"
        aria-label="Project Hub navigation"
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-3 h-14 border-b border-gray-200 dark:border-gray-800 shrink-0">
          <FolderKanban className="w-4 h-4 text-blue-500 shrink-0" />
          {!collapsed && (
            <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm whitespace-nowrap">
              项目管理中心
            </span>
          )}
        </div>

        {/* Back link */}
        <div className="px-2 pt-2">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
            {!collapsed && <span>返回主面板</span>}
          </Link>
        </div>

        {/* Nav items */}
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {projectHubNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-blue-500 dark:text-blue-400' : ''}`} strokeWidth={1.8} />
                {!collapsed && <span className="whitespace-nowrap text-[13px]">{item.label}</span>}
              </Link>
            );
          })}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="shrink-0 flex items-center justify-center h-8 border-t border-gray-200 dark:border-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-xs"
          aria-label={collapsed ? '展开' : '收起'}
        >
          {collapsed ? '›' : '‹'}
        </button>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1400px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
