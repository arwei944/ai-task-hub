'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Brain,
} from 'lucide-react';
import { ThemeToggle } from './theme-toggle';
import { LanguageSwitcher } from './language-switcher';
import { useProjectContext } from '@/lib/project-context';
import {
  getSidebarItems,
  getGroupedItems,
  getProjectNavItems,
  NAV_GROUPS,
  type NavGroup,
  type NavItem,
} from '@/config/navigation';

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<NavGroup>>(
    new Set(['core', 'collaboration'])
  );
  const { currentProjectId, isProjectContext } = useProjectContext();

  const isActive = (href: string) =>
    pathname === href || (href !== '/' && pathname.startsWith(href));

  const sidebarItems = getSidebarItems();
  const groupedItems = getGroupedItems(sidebarItems);
  const projectNavItems = isProjectContext && currentProjectId
    ? getProjectNavItems(currentProjectId)
    : [];

  const toggleGroup = (group: NavGroup) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  const renderNavItem = (item: NavItem) => {
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
  };

  const sortedGroups = (Object.entries(groupedItems) as [NavGroup, NavItem[]][])
    .filter(([, items]) => items.length > 0)
    .sort((a, b) => NAV_GROUPS[a[0]].order - NAV_GROUPS[b[0]].order);

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
        {/* Project-internal navigation */}
        {projectNavItems.length > 0 && (
          <>
            {projectNavItems.map(renderNavItem)}
            <div className="!my-3 border-t border-gray-100 dark:border-gray-800" />
          </>
        )}

        {/* Grouped navigation */}
        {sortedGroups.map(([group, items]) => (
          <div key={group}>
            {/* Group header */}
            {!collapsed ? (
              <button
                onClick={() => toggleGroup(group)}
                className="flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                <span className="whitespace-nowrap">{NAV_GROUPS[group].label}</span>
                <ChevronDown className={`w-4 h-4 shrink-0 transition-transform duration-200 ${expandedGroups.has(group) ? 'rotate-180' : ''}`} />
              </button>
            ) : (
              <div className="px-3 py-1">
                <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  {NAV_GROUPS[group].label}
                </span>
              </div>
            )}

            {/* Group items */}
            {(collapsed || expandedGroups.has(group)) && items.map(renderNavItem)}
          </div>
        ))}
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
