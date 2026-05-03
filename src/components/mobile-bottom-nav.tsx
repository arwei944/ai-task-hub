'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FolderKanban, CheckSquare, Bot, Puzzle, Settings } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface BottomNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const bottomNavItems: BottomNavItem[] = [
  { href: '/project-hub', label: '项目', icon: FolderKanban },
  { href: '/tasks', label: '任务', icon: CheckSquare },
  { href: '/agents', label: '智能体', icon: Bot },
  { href: '/plugins', label: '插件', icon: Puzzle },
  { href: '/settings', label: '设置', icon: Settings },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 safe-area-inset-bottom"
      role="navigation"
      aria-label="Bottom navigation"
    >
      <div className="flex items-center justify-around h-16 px-2">
        {bottomNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1 rounded-lg transition-colors ${
                isActive
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-400 dark:text-gray-500 active:text-gray-600 dark:active:text-gray-300'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="w-5 h-5" strokeWidth={1.8} />
              <span className="text-[10px] font-medium leading-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
