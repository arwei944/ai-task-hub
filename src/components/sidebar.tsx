'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CheckSquare,
  Bot,
  Building2,
  Link2,
  Puzzle,
  BookOpen,
  Settings,
  Store,
  SlidersHorizontal,
  Workflow,
  Rocket,
  ChevronLeft,
  ChevronRight,
  Brain,
  FolderKanban,
  Info,
  MessageSquare,
  GitBranch,
  Activity,
  Bell,
  Wrench,
} from 'lucide-react';
import { ThemeToggle } from './theme-toggle';
import { LanguageSwitcher } from './language-switcher';
import type { LucideIcon } from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const mainNavItems: NavItem[] = [
  { href: '/dashboard', label: '仪表盘', icon: LayoutDashboard },
  { href: '/feedback', label: '反馈中心', icon: MessageSquare },
  { href: '/workflows', label: '工作流管理', icon: GitBranch },
  { href: '/observability', label: '可观测性', icon: Activity },
  { href: '/tasks', label: '任务', icon: CheckSquare },
  { href: '/project-hub', label: '项目中心', icon: FolderKanban },
  { href: '/agents', label: '智能体', icon: Bot },
  { href: '/workspaces', label: '工作区', icon: Building2 },
  { href: '/integrations', label: '集成', icon: Link2 },
  { href: '/deployments', label: '部署管理', icon: Rocket },
  { href: '/notifications', label: '通知管理', icon: Bell },
  { href: '/ops', label: '运维面板', icon: Wrench },
  { href: '/plugins', label: '插件', icon: Puzzle },
];

const secondaryNavItems: NavItem[] = [
  { href: '/plugin-market', label: '插件市场', icon: Store },
  { href: '/dashboard-settings', label: '仪表盘设置', icon: SlidersHorizontal },
  { href: '/api-docs', label: 'API 文档', icon: BookOpen },
  { href: '/releases', label: '版本记录', icon: BookOpen },
  { href: '/about', label: '关于', icon: Info },
  { href: '/settings', label: '设置', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (href: string) =>
    pathname === href || (href !== '/' && pathname.startsWith(href));

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

      {/* Main nav */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {mainNavItems.map((item) => {
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
