// ============================================================
// Ops Layout - /ops
// ============================================================
//
// Ops panel layout with sub-navigation sidebar for 7 views:
// Overview, Topology, Linkage, Events, Workflows, AI, Notifications
// ============================================================

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Network,
  Link2,
  Radio,
  GitBranch,
  Brain,
  Bell,
  ArrowLeft,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface OpsNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const opsNavItems: OpsNavItem[] = [
  { href: '/ops', label: '总览', icon: LayoutDashboard },
  { href: '/ops/topology', label: '积木拓扑', icon: Network },
  { href: '/ops/linkage', label: '联动追踪', icon: Link2 },
  { href: '/ops/events', label: '事件流', icon: Radio },
  { href: '/ops/workflows', label: '工作流', icon: GitBranch },
  { href: '/ops/ai', label: 'AI 服务', icon: Brain },
  { href: '/ops/notifications', label: '通知系统', icon: Bell },
  { href: '/ops/interventions', label: '手动干预', icon: Wrench },
];

export default function OpsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (href: string) => {
    if (href === '/ops') return pathname === '/ops';
    return pathname.startsWith(href);
  };

  return (
    <div className="flex h-full">
      {/* Ops sub-navigation sidebar */}
      <aside
        className={`hidden md:flex flex-col h-screen sticky top-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-200 ${
          collapsed ? 'w-[52px]' : 'w-[180px]'
        }`}
        role="navigation"
        aria-label="Ops navigation"
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-3 h-14 border-b border-gray-200 dark:border-gray-800 shrink-0">
          <LayoutDashboard className="w-4 h-4 text-orange-500 shrink-0" />
          {!collapsed && (
            <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm whitespace-nowrap">
              运维面板
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
          {opsNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-orange-500 dark:text-orange-400' : ''}`} strokeWidth={1.8} />
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
