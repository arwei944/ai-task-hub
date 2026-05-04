'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CheckSquare,
  Bot,
  Link2,
  Puzzle,
  BookOpen,
  Store,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Brain,
  FolderKanban,
  Info,
  GitBranch,
  Activity,
  Bell,
  Wrench,
  Rocket,
  FileText,
  GanttChart,
  Network,
  MessageSquare,
} from 'lucide-react';
import { ThemeToggle } from './theme-toggle';
import { LanguageSwitcher } from './language-switcher';
import { useProjectContext } from '@/lib/project-context';
import type { LucideIcon } from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const systemNavItems: NavItem[] = [
  { href: '/workflows', label: '工作流管理', icon: GitBranch },
  { href: '/observability', label: '可观测性', icon: Activity },
  { href: '/integrations', label: '集成管理', icon: Link2 },
  { href: '/deployments', label: '部署管理', icon: Rocket },
  { href: '/notifications', label: '通知管理', icon: Bell },
  { href: '/ops', label: '运维面板', icon: Wrench },
  { href: '/plugins', label: '插件', icon: Puzzle },
];

const secondaryNavItems: NavItem[] = [
  { href: '/plugin-market', label: '插件市场', icon: Store },
  { href: '/feedback', label: '反馈中心', icon: MessageSquare },
  { href: '/api-docs', label: 'API 文档', icon: BookOpen },
  { href: '/releases', label: '版本记录', icon: BookOpen },
  { href: '/about', label: '关于', icon: Info },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [systemExpanded, setSystemExpanded] = useState(false);
  const { currentProjectId, isProjectContext } = useProjectContext();

  const isActive = (href: string) =>
    pathname === href || (href !== '/' && pathname.startsWith(href));

  // Project-internal nav items (only shown when inside a project)
  const projectNavItems: NavItem[] = isProjectContext && currentProjectId
    ? [
        { href: `/project-hub/${currentProjectId}`, label: '概览', icon: LayoutDashboard },
        { href: `/project-hub/${currentProjectId}/tasks`, label: '任务', icon: CheckSquare },
        { href: `/project-hub/${currentProjectId}/team`, label: '工作台', icon: Bot },
        { href: `/project-hub/${currentProjectId}/docs`, label: '文档', icon: FileText },
        { href: `/project-hub/${currentProjectId}/workflows`, label: '工作流', icon: GitBranch },
        { href: `/project-hub/${currentProjectId}/dependencies`, label: '依赖关系', icon: Network },
        { href: `/project-hub/${currentProjectId}/deployments`, label: '部署', icon: Rocket },
        { href: `/project-hub/${currentProjectId}/notifications`, label: '通知', icon: Bell },
        { href: `/project-hub/${currentProjectId}/activity`, label: '活动', icon: Activity },
      ]
    : [];

  return (
    <aside
      className={`hidden md:flex flex-col h-screen sticky top-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-200 ${
        collapsed ? 'w-[60px]' : 'w-[220px]'
      }`}
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 h-14 border-b border-gray-200 dark:border-gray-800 shrink-0">
        <Brain className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
        {!collapsed && (
          <span className="font-bold text-gray-900 dark:text-gray-100 text-sm whitespace-nowrap">
            AI Task Hub
          </span>
        )}
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {/* Global: 我的项目 - always visible */}
        <Link
          href="/project-hub"
          title={collapsed ? '我的项目' : undefined}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            pathname === '/project-hub' || isProjectContext
              ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
              : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'
          }`}
        >
          <FolderKanban className={`w-[18px] h-[18px] shrink-0 ${pathname === '/project-hub' || isProjectContext ? 'text-blue-600 dark:text-blue-400' : ''}`} strokeWidth={1.8} />
          {!collapsed && <span className="whitespace-nowrap">我的项目</span>}
        </Link>

        {/* Project-internal navigation (when inside a project) */}
        {(projectNavItems?.length ?? 0) > 0 && (
          <>
            <div className="!my-2 border-t border-gray-100 dark:border-gray-800" />
            {projectNavItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                      : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'
                  }`}
                >
                  <Icon className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-blue-600 dark:text-blue-400' : ''}`} strokeWidth={1.8} />
                  {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
                </Link>
              );
            })}
          </>
        )}

        {/* Divider */}
        <div className="!my-3 border-t border-gray-100 dark:border-gray-800" />

        {/* System Management (collapsible) */}
        {!collapsed ? (
          <button
            onClick={() => setSystemExpanded(!systemExpanded)}
            className="flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            <span className="whitespace-nowrap">系统管理</span>
            <ChevronDown className={`w-4 h-4 shrink-0 transition-transform duration-200 ${systemExpanded ? 'rotate-180' : ''}`} />
          </button>
        ) : (
          <div className="px-3 py-1">
            <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">系统</span>
          </div>
        )}

        {systemExpanded && (
          <>
            {systemNavItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                      : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'
                  }`}
                >
                  <Icon className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-blue-600 dark:text-blue-400' : ''}`} strokeWidth={1.8} />
                  {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
                </Link>
              );
            })}
          </>
        )}

        {/* Divider */}
        <div className="!my-3 border-t border-gray-100 dark:border-gray-800" />

        {/* Secondary nav */}
        {secondaryNavItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <Icon className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-blue-600 dark:text-blue-400' : ''}`} strokeWidth={1.8} />
              {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
            </Link>
          );
        })}
      </div>

      {/* Footer: controls */}
      <div className="shrink-0 border-t border-gray-200 dark:border-gray-800 px-2 py-3 space-y-2">
        {!collapsed && (
          <div className="flex items-center gap-2 px-3">
            <LanguageSwitcher />
          </div>
        )}
        <div className="flex items-center gap-2 px-3">
          <ThemeToggle />
          {!collapsed && <span className="text-xs text-gray-400">主题</span>}
        </div>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="shrink-0 flex items-center justify-center h-8 border-t border-gray-200 dark:border-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  );
}
